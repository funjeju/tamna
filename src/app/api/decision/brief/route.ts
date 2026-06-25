// POST /api/decision/brief — 자금분석 AI 브리핑 (서버 프록시, 키 은닉)
// 엔진이 계산한 수치만 받아 '의미·행동'을 해석. AI 출력의 숫자는 후검증 → 실패 시 결정론 폴백.
import { NextRequest, NextResponse } from "next/server";
import { llmJson } from "@/lib/llm";
import { LEGAL_DISCLAIMER } from "@/lib/decision/rules";
import {
  buildBriefPrompt,
  validateBrief,
  fallbackBrief,
  type Brief,
  type BriefMetrics,
} from "@/lib/decision/brief";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let m: BriefMetrics | null = null;
  try {
    m = (await req.json()) as BriefMetrics;
  } catch {
    m = null;
  }
  if (!m || (m.kind !== "buy" && m.kind !== "rent")) {
    return NextResponse.json({ error: "metrics 필요" }, { status: 400 });
  }

  let brief: Brief;
  let ai = false;
  try {
    const out = await llmJson<Brief>({ role: "generate", prompt: buildBriefPrompt(m), retries: 2 });
    if (out && out.summary && Array.isArray(out.points) && validateBrief(out, m)) {
      brief = { summary: out.summary, points: out.points.slice(0, 4) };
      ai = true;
    } else {
      brief = fallbackBrief(m); // 검증 탈락(금액 생성/허위 %) → 폴백
    }
  } catch {
    brief = fallbackBrief(m); // AI 실패 → 폴백
  }

  return NextResponse.json({ ...brief, ai, disclaimer: LEGAL_DISCLAIMER });
}
