// TamnaIndex — LLM 호출 추상화 (OpenAI). 모델은 env로 설정.
//   LLM_MODEL_GENERATE — 글/콘텐츠 생성
//   LLM_MODEL_INTENT   — 의도/파싱
const OPENAI_KEY = process.env.OPENAI_API_KEY?.replace(/^﻿/, "").trim();

export type LLMRole = "generate" | "intent";

export function modelFor(role: LLMRole): string {
  const v = role === "intent" ? process.env.LLM_MODEL_INTENT : process.env.LLM_MODEL_GENERATE;
  return (v || "gpt-5.4-mini").replace(/^﻿/, "").trim();
}

// JSON 응답을 강제·파싱해서 반환. 실패 시 null. (429/5xx는 backoff 재시도)
export async function llmJson<T = unknown>(opts: {
  role: LLMRole;
  system?: string;
  prompt: string;
  retries?: number;
}): Promise<T | null> {
  if (!OPENAI_KEY) throw new Error("OPENAI_API_KEY 미설정");
  const model = modelFor(opts.role);
  const messages = [
    ...(opts.system ? [{ role: "system", content: opts.system }] : []),
    { role: "user", content: opts.prompt },
  ];
  const retries = opts.retries ?? 3;
  let lastErr = "";
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          response_format: { type: "json_object" },
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content;
        if (!text) return null;
        try {
          return JSON.parse(text) as T;
        } catch {
          return null;
        }
      }
      lastErr = `${res.status}: ${(await res.text()).slice(0, 160)}`;
      if ([429, 500, 502, 503].includes(res.status)) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      throw new Error(`OpenAI ${lastErr}`);
    } catch (e) {
      lastErr = String((e as Error)?.message ?? e);
      if (i === retries - 1) throw new Error(`LLM 실패: ${lastErr}`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}
