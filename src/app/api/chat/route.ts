// POST /api/chat — 매물 검색 챗봇
// 자연어 질문 → Gemini로 구조화 필터 추출 → 기존 /api/listings 조회 →
// 매물에만 근거한 답변 + 카드용 매물 배열 반환. (할루시네이션 방지: 답변은 조회 결과만 근거)
import { NextRequest, NextResponse } from "next/server";
import { buildListingsQuery, formatPrice } from "@/lib/public/format";
import { REGION_NAMES } from "@/lib/regions";
import { PROPERTY_TYPES, DEAL_TYPES, THEMES } from "@/lib/types";
import type { Listing } from "@/lib/types";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const CARD_LIMIT = 4;

interface ParsedFilters {
  regions: string[];
  propertyTypes: string[];
  dealTypes: string[];
  priceMin: number | null;
  priceMax: number | null;
  areaMin: number | null;
  areaMax: number | null;
  themes: string[];
  q: string | null;
  sort: "latest" | "price_asc" | "price_desc" | "area" | null;
  offtopic: boolean;
}

const EMPTY: ParsedFilters = {
  regions: [], propertyTypes: [], dealTypes: [], priceMin: null, priceMax: null,
  areaMin: null, areaMax: null, themes: [], q: null, sort: null, offtopic: false,
};

// ── Gemini로 자연어 → 필터 ──
async function parseQuery(message: string): Promise<ParsedFilters> {
  if (!GEMINI_KEY) {
    // 키 없으면 메시지를 그대로 자유 검색어로
    return { ...EMPTY, q: message.slice(0, 40) };
  }
  const prompt = `너는 제주 부동산 매물 검색 질의를 구조화 필터로 변환하는 파서다.
사용자 메시지를 분석해 JSON 하나만 출력해라. 설명/마크다운 금지.

[사용자 메시지] ${message}

규칙:
- regions: 다음 중 해당하는 지역명 배열(없으면 []). 후보: ${REGION_NAMES.join(", ")}
- propertyTypes: 다음 중 배열(없으면 []). 후보: ${PROPERTY_TYPES.join(", ")}
- dealTypes: 다음 중 배열(없으면 []). 후보: ${DEAL_TYPES.join(", ")}
- priceMin/priceMax: 만원 단위 정수 또는 null. 예: "3억 이하" → priceMax 30000, priceMin null. "2억~4억" → priceMin 20000, priceMax 40000. "5천만원 이하" → priceMax 5000.
- areaMin/areaMax: 평 단위 정수 또는 null. 예: "30평 이상" → areaMin 30.
- themes: 다음 중 배열(없으면 []). 후보: ${THEMES.join(", ")}
- q: 위 필터로 안 잡히는 가장 핵심적인 자유 키워드 한 단어(예: 바다뷰, 돌집, 신축). 없으면 null.
- sort: "싼/저렴/낮은가격"이면 "price_asc", "비싼/높은가격"이면 "price_desc", "넓은/큰"이면 "area", 그 외 null.
- offtopic: 제주 매물 검색과 무관한 질문(인사 제외 잡담, 일반 상식 등)이면 true, 아니면 false.

출력 JSON 스키마:
{"regions":[str],"propertyTypes":[str],"dealTypes":[str],"priceMin":int|null,"priceMax":int|null,"areaMin":int|null,"areaMax":int|null,"themes":[str],"q":str|null,"sort":str|null,"offtopic":bool}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
      }),
    });
    if (!res.ok) return { ...EMPTY, q: message.slice(0, 40) };
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { ...EMPTY, q: message.slice(0, 40) };
    const p = JSON.parse(text);
    // 화이트리스트 정제
    return {
      regions: arr(p.regions).filter((x) => REGION_NAMES.includes(x)),
      propertyTypes: arr(p.propertyTypes).filter((x) => (PROPERTY_TYPES as string[]).includes(x)),
      dealTypes: arr(p.dealTypes).filter((x) => (DEAL_TYPES as string[]).includes(x)),
      priceMin: num(p.priceMin),
      priceMax: num(p.priceMax),
      areaMin: num(p.areaMin),
      areaMax: num(p.areaMax),
      themes: arr(p.themes).filter((x) => (THEMES as string[]).includes(x)),
      q: typeof p.q === "string" && p.q.trim() ? p.q.trim().slice(0, 40) : null,
      sort: ["latest", "price_asc", "price_desc", "area"].includes(p.sort) ? p.sort : null,
      offtopic: p.offtopic === true,
    };
  } catch {
    return { ...EMPTY, q: message.slice(0, 40) };
  }
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

// ── 조건 요약 문구 (답변용, 결과에만 근거) ──
function describe(f: ParsedFilters): string {
  const parts: string[] = [];
  if (f.regions.length) parts.push(f.regions.join("·"));
  if (f.dealTypes.length) parts.push(f.dealTypes.join("·"));
  if (f.propertyTypes.length) parts.push(f.propertyTypes.join("·"));
  if (f.themes.length) parts.push(f.themes.join("·"));
  if (f.priceMin && f.priceMax) parts.push(`${formatPrice(f.priceMin)}~${formatPrice(f.priceMax)}`);
  else if (f.priceMax) parts.push(`${formatPrice(f.priceMax)} 이하`);
  else if (f.priceMin) parts.push(`${formatPrice(f.priceMin)} 이상`);
  if (f.areaMin && f.areaMax) parts.push(`${f.areaMin}~${f.areaMax}평`);
  else if (f.areaMin) parts.push(`${f.areaMin}평 이상`);
  else if (f.areaMax) parts.push(`${f.areaMax}평 이하`);
  if (f.q) parts.push(`'${f.q}'`);
  return parts.join(" · ");
}

export async function POST(req: NextRequest) {
  let message = "";
  try {
    const body = await req.json();
    message = String(body?.message ?? "").trim();
  } catch {
    /* noop */
  }
  if (!message) {
    return NextResponse.json({ reply: "어떤 매물을 찾으세요? 지역·가격·유형을 알려주세요.", listings: [], filters: null });
  }

  const f = await parseQuery(message);

  if (f.offtopic) {
    return NextResponse.json({
      reply: "저는 제주 매물 검색을 도와드려요. 예를 들어 \"애월 바다뷰 3억 이하 단독주택\"처럼 지역·가격·유형을 말씀해 주세요.",
      listings: [],
      filters: null,
    });
  }

  const hasAny =
    f.regions.length || f.propertyTypes.length || f.dealTypes.length ||
    f.themes.length || f.priceMin || f.priceMax || f.areaMin || f.areaMax || f.q;

  // 매물 조회 — 기존 /api/listings 재사용
  const path = buildListingsQuery({
    regions: f.regions,
    propertyTypes: f.propertyTypes,
    dealTypes: f.dealTypes,
    themes: f.themes,
    q: f.q ?? undefined,
    priceMin: f.priceMin ?? undefined,
    priceMax: f.priceMax ?? undefined,
    areaMin: f.areaMin ?? undefined,
    areaMax: f.areaMax ?? undefined,
    sort: f.sort ?? "latest",
    status: "published",
    limit: 60,
  });

  let all: Listing[] = [];
  try {
    const res = await fetch(`${req.nextUrl.origin}${path}`, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      all = (data.listings ?? []) as Listing[];
    }
  } catch {
    /* noop */
  }

  const cond = describe(f);
  const top = all.slice(0, CARD_LIMIT);

  let reply: string;
  if (all.length === 0) {
    reply = hasAny
      ? `${cond ? cond + " 조건의 " : ""}매물을 찾지 못했어요. 가격대를 넓히거나 다른 지역으로 바꿔볼까요?`
      : "조건을 좀 더 구체적으로 알려주시면 좋아요. 예: \"한림 단독주택 매매\", \"급매 토지\".";
  } else {
    const more = all.length > top.length ? ` (그 외 ${all.length - top.length}건 더)` : "";
    reply = `${cond ? cond + " — " : ""}${all.length}건을 찾았어요. 아래 카드를 눌러 상세를 확인해 보세요.${more}`;
  }

  return NextResponse.json({
    reply,
    filters: hasAny ? f : null,
    listings: top,
    totalCount: all.length,
  });
}
