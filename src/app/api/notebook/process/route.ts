// POST /api/notebook/process — 실장님 수첩: 음성/텍스트 → 전사 + 상담 항목 추출
// multipart(audio) → OpenAI 전사 → 추출 / application/json({text}) → 추출만.
// 데이터는 저장하지 않고 즉시 처리해 반환(PII 안전).
import { NextRequest, NextResponse } from "next/server";
import { llmJson } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const OPENAI_KEY = process.env.OPENAI_API_KEY?.replace(/^﻿/, "").trim();
const STT_MODEL = (process.env.LLM_MODEL_STT || "whisper-1").replace(/^﻿/, "").trim();

export interface ConsultExtract {
  customerName: string;
  contact: string;
  consultType: string; // 매수/매도/임차/투자/일반
  region: string;
  propertyType: string;
  dealType: string;
  budgetText: string; // 예산/자금 메모(원문 표현)
  conditions: string[]; // 희망조건
  interested: string[]; // 관심 매물
  nextActions: string[]; // 다음 액션
  summary: string;
}

async function transcribe(file: File): Promise<string> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY 미설정");
  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  form.append("model", STT_MODEL);
  form.append("language", "ko");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_KEY}` },
    body: form,
  });
  if (!res.ok) throw new Error(`전사 실패 ${res.status}`);
  const data = await res.json();
  return (data.text as string) ?? "";
}

function extractPrompt(transcript: string): string {
  return `너는 부동산 중개사무소의 상담 보조다. 아래 상담 녹취(또는 메모)에서 항목을 추출해 JSON 하나만 출력하라.
없는 항목은 빈 문자열/빈 배열로. 추측으로 지어내지 말 것.

[상담 내용]
${transcript.slice(0, 6000)}

출력 JSON:
{"customerName":str,"contact":str,"consultType":"매수|매도|임차|투자|일반","region":str,"propertyType":str,"dealType":"매매|전세|월세|",
"budgetText":str,"conditions":[str],"interested":[str],"nextActions":[str],"summary":str}`;
}

export async function POST(req: NextRequest) {
  try {
    let transcript = "";
    const ct = req.headers.get("content-type") || "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("audio");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "audio 파일 필요" }, { status: 400 });
      }
      transcript = await transcribe(file);
    } else {
      const body = await req.json().catch(() => ({}));
      transcript = typeof body?.text === "string" ? body.text : "";
    }
    if (!transcript.trim()) {
      return NextResponse.json({ error: "내용이 비어 있습니다." }, { status: 400 });
    }
    const extracted = await llmJson<ConsultExtract>({ role: "generate", prompt: extractPrompt(transcript) });
    return NextResponse.json({ transcript, extracted: extracted ?? null });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message ?? e).slice(0, 160) }, { status: 500 });
  }
}
