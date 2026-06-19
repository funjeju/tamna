// POST /api/chat — 매물 검색 챗봇
// 자연어 질문 → 결정적 어휘 매칭 + 정규식(가격/면적) 파싱 → 기존 /api/listings 조회 →
// 매물에만 근거한 답변 + 카드용 매물 배열 반환. (할루시네이션 방지: 답변은 조회 결과만 근거)
import { NextRequest, NextResponse } from "next/server";
import { buildListingsQuery, formatPrice } from "@/lib/public/format";
import { REGION_NAMES } from "@/lib/regions";
import { PROPERTY_TYPES, DEAL_TYPES, THEMES } from "@/lib/types";
import type { Listing } from "@/lib/types";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

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

// ── 닫힌 어휘는 메시지에서 직접 매칭 (LLM보다 정확·빠름) ──
// 지역: "노형·연동" 등은 부분 별칭으로도 매칭
function regionAliases(name: string): string[] {
  const parts = name.split("·").map((s) => s.trim()).filter(Boolean);
  const set = new Set([name, ...parts]);
  if (name === "노형·연동") ["신제주"].forEach((a) => set.add(a));
  return [...set];
}
// 테마 별칭
function themeAliases(name: string): string[] {
  const map: Record<string, string[]> = {
    "세컨하우스": ["세컨하우스", "세컨드하우스", "세컨"],
    "한달살기": ["한달살기", "한달 살기", "한달살이", "한 달 살기"],
    "돌집·구옥": ["돌집", "구옥", "돌담집"],
    "바다뷰": ["바다뷰", "오션뷰", "바다 뷰", "씨뷰"],
    "읍면 단독": ["읍면 단독", "읍면단독"],
    "급매": ["급매", "급처"],
  };
  return map[name] ?? [name];
}

function extractVocab(msg: string) {
  const regions = REGION_NAMES.filter((r) => regionAliases(r).some((a) => msg.includes(a)));
  const propSet = new Set(
    (PROPERTY_TYPES as string[]).filter((p) => msg.includes(p)),
  );
  if (msg.includes("땅")) propSet.add("토지");
  const dealTypes = (DEAL_TYPES as string[]).filter((d) => msg.includes(d));
  const themes = (THEMES as string[]).filter((t) => themeAliases(t).some((a) => msg.includes(a)));
  return { regions, propertyTypes: [...propSet], dealTypes, themes };
}

// ── 가격/면적 정규식 파서 (LLM 폴백 겸 보강) ──
// "3억", "3억5천", "5천만원", "5000만원" → 만원 정수
function parseAmountKRW(s: string): number | null {
  const m = s.match(/(?:(\d+(?:\.\d+)?)\s*억)?\s*(?:(\d+)\s*천)?\s*(?:(\d+(?:,\d{3})*)\s*만)?/);
  if (!m) return null;
  const eok = m[1] ? parseFloat(m[1]) : 0;
  const cheon = m[2] ? parseInt(m[2], 10) : 0;
  const man = m[3] ? parseInt(m[3].replace(/,/g, ""), 10) : 0;
  const total = Math.round(eok * 10000 + cheon * 1000 + man);
  return total > 0 ? total : null;
}
function parsePriceRegex(msg: string): { priceMin: number | null; priceMax: number | null } {
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  // 범위: "2억~4억", "2억에서 4억"
  const range = msg.match(/(\d[\d.억천만,\s]*?)\s*(?:~|-|에서|부터)\s*(\d[\d.억천만,\s]*?만?원?)\s*(?:사이|이내)?/);
  if (range) {
    priceMin = parseAmountKRW(range[1]);
    priceMax = parseAmountKRW(range[2]);
    if (priceMin && priceMax) return { priceMin, priceMax };
  }
  // "N억대" → N억 이상 (N+1)억 미만
  const band = msg.match(/(\d+(?:\.\d+)?)\s*억\s*대/);
  if (band) {
    const n = parseFloat(band[1]);
    return { priceMin: Math.round(n * 10000), priceMax: Math.round((n + 1) * 10000) };
  }
  const amt = parseAmountKRW(msg);
  if (amt) {
    if (/이하|미만|이내|아래|under|밑/.test(msg)) priceMax = amt;
    else if (/이상|초과|넘|over|위/.test(msg)) priceMin = amt;
    else priceMax = amt; // 단순 "3억 매물"이면 상한으로 해석
  }
  return { priceMin, priceMax };
}
function parseAreaRegex(msg: string): { areaMin: number | null; areaMax: number | null } {
  let areaMin: number | null = null;
  let areaMax: number | null = null;
  const m = msg.match(/(\d+)\s*평/);
  if (m) {
    const v = parseInt(m[1], 10);
    if (/이상|넘|초과|위/.test(msg)) areaMin = v;
    else if (/이하|미만|이내|아래/.test(msg)) areaMax = v;
    else areaMin = v;
  }
  return { areaMin, areaMax };
}
function parseSort(msg: string): ParsedFilters["sort"] {
  if (/싸|저렴|낮은|싼|저가/.test(msg)) return "price_asc";
  if (/비싼|높은|고가|비싸/.test(msg)) return "price_desc";
  if (/넓은|큰|대형/.test(msg)) return "area";
  return null;
}

// ── 자연어 → 필터 (어휘는 결정적, 가격/면적은 정규식, LLM은 선택적 보강) ──
async function parseQuery(message: string): Promise<ParsedFilters> {
  const vocab = extractVocab(message);
  const price = parsePriceRegex(message);
  const area = parseAreaRegex(message);
  const sort = parseSort(message);

  return {
    regions: vocab.regions,
    propertyTypes: vocab.propertyTypes,
    dealTypes: vocab.dealTypes,
    themes: vocab.themes,
    priceMin: price.priceMin,
    priceMax: price.priceMax,
    areaMin: area.areaMin,
    areaMax: area.areaMax,
    q: null,
    sort,
    offtopic: false,
  };
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
