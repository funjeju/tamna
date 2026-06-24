// POST /api/chat — 매물 검색 챗봇
// 자연어 질문 → 결정적 어휘 매칭 + 정규식(가격/면적) 파싱 → 기존 /api/listings 조회 →
// 매물에만 근거한 답변 + 카드용 매물 배열 반환. (할루시네이션 방지: 답변은 조회 결과만 근거)
import { NextRequest, NextResponse } from "next/server";
import { buildListingsQuery, formatPrice } from "@/lib/public/format";
import { REGION_NAMES } from "@/lib/regions";
import { PROPERTY_TYPES, DEAL_TYPES, THEMES } from "@/lib/types";
import type { Listing } from "@/lib/types";
import { llmJson } from "@/lib/llm";

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

// ── 가격/면적 정규식 파서 ──
// 금액 토큰 패턴(단위 필수): "3억", "3억5천", "5천만원", "5000만원"
const AMT = String.raw`\d[\d.,]*\s*억(?:\s*\d[\d.,]*\s*천)?(?:\s*\d[\d.,]*\s*만)?원?|\d[\d.,]*\s*천만?\s*원?|\d[\d.,]*\s*만\s*원?`;

function parseAmountKRW(s: string): number | null {
  // 문자열 어디에 있든 첫 금액 토큰을 찾아서 파싱 (앞에 텍스트가 있어도 동작)
  const span = s.match(new RegExp(AMT));
  if (!span) return null;
  const t = span[0];
  const m = t.match(/(?:(\d+(?:\.\d+)?)\s*억)?\s*(?:(\d+(?:\.\d+)?)\s*천)?\s*(?:(\d+(?:,\d{3})*)\s*만)?/);
  if (!m) return null;
  const eok = m[1] ? parseFloat(m[1]) : 0;
  const cheon = m[2] ? parseFloat(m[2]) : 0;
  const man = m[3] ? parseInt(m[3].replace(/,/g, ""), 10) : 0;
  const total = Math.round(eok * 10000 + cheon * 1000 + man);
  return total > 0 ? total : null;
}
function parsePriceRegex(msg: string): { priceMin: number | null; priceMax: number | null } {
  let priceMin: number | null = null;
  let priceMax: number | null = null;
  // 범위: "2억~4억", "2억에서 4억"
  const range = msg.match(new RegExp(`(${AMT})\\s*(?:~|-|–|에서|부터)\\s*(${AMT})`));
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

// ── LLM(의도) 보강: 자유로운 표현·암시된 조건·자유 키워드 추출 ──
interface LlmIntent {
  regions?: string[];
  propertyTypes?: string[];
  dealTypes?: string[];
  themes?: string[];
  priceMin?: number | null;
  priceMax?: number | null;
  areaMin?: number | null;
  areaMax?: number | null;
  q?: string | null;
  sort?: string | null;
  offtopic?: boolean;
}

async function llmIntent(message: string): Promise<LlmIntent | null> {
  const prompt = `제주 부동산 검색 챗봇의 질의를 구조화 필터로 변환한다. JSON 하나만 출력.

[메시지] ${message}

규칙:
- regions: 다음 중에서만 골라 배열(없으면 []): ${REGION_NAMES.join(", ")}
- propertyTypes: 다음 중에서만(없으면 []): ${(PROPERTY_TYPES as string[]).join(", ")}
- dealTypes: 다음 중에서만(없으면 []): ${(DEAL_TYPES as string[]).join(", ")}
- themes: 다음 중에서만(없으면 []): ${(THEMES as string[]).join(", ")}
- priceMin/priceMax: 만원 단위 정수 또는 null. 예) "3억 이하" → priceMax 30000.
- areaMin/areaMax: 평 단위 정수 또는 null.
- q: 위 분류로 안 잡히는 핵심 자유 키워드 1개(예: 신축, 리모델링, 마당, 주차) 또는 null.
- sort: "price_asc"(싼순) | "price_desc"(비싼순) | "area"(넓은순) | null.
- offtopic: 제주 매물 검색과 무관한 잡담/질문이면 true, 아니면 false.
- 추측으로 지역·유형을 지어내지 말 것. 메시지에 근거가 있을 때만.

출력 JSON: {"regions":[],"propertyTypes":[],"dealTypes":[],"themes":[],"priceMin":null,"priceMax":null,"areaMin":null,"areaMax":null,"q":null,"sort":null,"offtopic":false}`;
  try {
    return await llmJson<LlmIntent>({ role: "intent", prompt, retries: 2 });
  } catch {
    return null;
  }
}

// ── 자연어 → 필터 (결정적 어휘/정규식 + LLM 보강을 병합) ──
async function parseQuery(message: string): Promise<ParsedFilters> {
  const vocab = extractVocab(message);
  const price = parsePriceRegex(message);
  const area = parseAreaRegex(message);
  const sort = parseSort(message);

  // LLM 의도(실패해도 규칙 결과로 동작)
  const llm = await llmIntent(message);
  const pick = <T>(whitelist: readonly string[], arr?: string[]): string[] =>
    Array.isArray(arr) ? arr.filter((x) => whitelist.includes(x)) : [];

  // 결정적 결과 우선, 비었으면 LLM으로 채움
  const regions = vocab.regions.length ? vocab.regions : pick(REGION_NAMES, llm?.regions);
  const propertyTypes = vocab.propertyTypes.length
    ? vocab.propertyTypes
    : pick(PROPERTY_TYPES as string[], llm?.propertyTypes);
  const dealTypes = vocab.dealTypes.length ? vocab.dealTypes : pick(DEAL_TYPES as string[], llm?.dealTypes);
  const themes = vocab.themes.length ? vocab.themes : pick(THEMES as string[], llm?.themes);
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  const llmSort = ["price_asc", "price_desc", "area"].includes(llm?.sort ?? "")
    ? (llm!.sort as ParsedFilters["sort"])
    : null;
  const q = typeof llm?.q === "string" && llm.q.trim() ? llm.q.trim().slice(0, 30) : null;

  const matchedAny =
    regions.length || propertyTypes.length || dealTypes.length || themes.length ||
    price.priceMin || price.priceMax || area.areaMin || area.areaMax || q;

  return {
    regions,
    propertyTypes,
    dealTypes,
    themes,
    priceMin: price.priceMin ?? num(llm?.priceMin),
    priceMax: price.priceMax ?? num(llm?.priceMax),
    areaMin: area.areaMin ?? num(llm?.areaMin),
    areaMax: area.areaMax ?? num(llm?.areaMax),
    q,
    sort: sort ?? llmSort,
    // 아무 조건도 없고 LLM이 잡담이라 판단하면 offtopic
    offtopic: !matchedAny && llm?.offtopic === true,
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

  // 조건이 하나도 안 잡히면(인사·잡담 포함) 전체를 덤프하지 않고 안내
  if (!hasAny) {
    return NextResponse.json({
      reply:
        "지역·가격·유형으로 찾아드려요. 예: \"애월 바다뷰 3억 이하 단독주택\", \"한림 토지 매매\", \"급매 전원주택\".",
      listings: [],
      filters: null,
      totalCount: 0,
    });
  }

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
