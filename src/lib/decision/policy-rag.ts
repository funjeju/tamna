// TamnaIndex 결정 레이어 — 정책값 RAG 갱신 (OpenAI 웹검색으로 최신 조회)
// LLM 기억이 아니라 '검색 결과'에 근거. 실패/범위이탈 시 null → 호출부가 시드 유지.
const OPENAI_KEY = process.env.OPENAI_API_KEY?.replace(/^﻿/, "").trim();
const MODEL = (process.env.LLM_MODEL_GENERATE || "gpt-5.4-mini").replace(/^﻿/, "").trim();

export interface PolicySnapshot {
  ltvNonRegulatedPct: number;
  ltvRegulatedPct: number;
  ltvFirstTimePct: number;
  dsrLimitPct: number;
  stressAddRatePct: number;
  jeonseWolseConvCapPct: number;
  asOf: string; // 자료 기준/조회일 YYYY-MM-DD
  sources: string[];
  notes?: string;
}

const inRange = (n: unknown, lo: number, hi: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= lo && n <= hi;

function validate(p: Record<string, unknown>): PolicySnapshot | null {
  if (
    !inRange(p.ltvNonRegulatedPct, 30, 90) ||
    !inRange(p.ltvRegulatedPct, 20, 80) ||
    !inRange(p.ltvFirstTimePct, 50, 90) ||
    !inRange(p.dsrLimitPct, 30, 60) ||
    !inRange(p.stressAddRatePct, 0, 4) ||
    !inRange(p.jeonseWolseConvCapPct, 2, 12)
  ) {
    return null;
  }
  const asOf = typeof p.asOf === "string" && /\d{4}-\d{2}/.test(p.asOf)
    ? p.asOf
    : new Date().toISOString().slice(0, 10);
  const sources = Array.isArray(p.sources)
    ? (p.sources.filter((s) => typeof s === "string").slice(0, 5) as string[])
    : [];
  return {
    ltvNonRegulatedPct: p.ltvNonRegulatedPct,
    ltvRegulatedPct: p.ltvRegulatedPct,
    ltvFirstTimePct: p.ltvFirstTimePct,
    dsrLimitPct: p.dsrLimitPct,
    stressAddRatePct: p.stressAddRatePct,
    jeonseWolseConvCapPct: p.jeonseWolseConvCapPct,
    asOf,
    sources,
    notes: typeof p.notes === "string" ? p.notes.slice(0, 300) : undefined,
  };
}

function extractJson(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// OpenAI Responses API + web_search 도구로 최신 정책값 조회
export async function fetchLatestPolicy(): Promise<PolicySnapshot | null> {
  if (!OPENAI_KEY) return null;
  const today = new Date().toISOString().slice(0, 10);
  const prompt = `오늘은 ${today}이다. 웹 검색으로 대한민국 부동산 금융/임대차 정책의 '현행' 수치를 확인해서 JSON 하나만 출력하라.
필요 값: 비규제지역 주택담보 LTV 상한(%), 규제(조정대상)지역 LTV 상한(%), 생애최초 LTV 상한(%),
은행권 DSR 한도(%), 스트레스 DSR 가산금리(%p, 현 단계 적용치), 주택임대차 전월세 전환율 상한(%, 기준금리+법정가산 반영).
가능하면 금융위/국토부/법령 등 1차 출처를 sources에 URL로 담아라. 확실치 않으면 가장 신뢰도 높은 현행 보도/고시 기준으로.
출력 JSON 스키마(숫자는 % 값):
{"ltvNonRegulatedPct":num,"ltvRegulatedPct":num,"ltvFirstTimePct":num,"dsrLimitPct":num,"stressAddRatePct":num,"jeonseWolseConvCapPct":num,"asOf":"YYYY-MM-DD","sources":[url],"notes":str}`;

  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        tools: [{ type: "web_search" }],
        input: prompt,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Responses API 출력 텍스트 추출 (output_text 또는 message content)
    const text: string =
      data.output_text ??
      (Array.isArray(data.output)
        ? data.output
            .flatMap((o: { content?: { type?: string; text?: string }[] }) => o.content ?? [])
            .map((c: { text?: string }) => c.text ?? "")
            .join("\n")
        : "");
    const json = extractJson(text);
    if (!json) return null;
    return validate(json);
  } catch {
    return null;
  }
}
