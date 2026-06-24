// TamnaIndex — Gemini 기반 권위/SEO 글 생성기 (SEO·AEO·GEO 구조 강제 + 품질 게이트)
import type { Article, AuthoritySpec } from "./articles";
import { slugExists } from "./articles";

const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const SITE = "탐라인덱스(tamna-iota.vercel.app)";
const AUTHOR = "탐라인덱스 편집팀";
const DISCLAIMER =
  "\n\n---\n\n> 본 글은 일반적인 정보 제공을 목적으로 하며, 법령·세율·허가구역 등은 시점에 따라 변동될 수 있습니다. 실제 거래 전 관할 지자체·전문가(공인중개사·세무사)에게 최신 사항을 반드시 확인하세요.";

interface GenResult {
  title?: string;
  slug?: string;
  metaDescription?: string;
  keywords?: string[];
  lead?: string;
  bodyMarkdown?: string;
  faq?: { q: string; a: string }[];
  related?: { regions?: string[]; propertyTypes?: string[]; themes?: string[] };
  sources?: string[];
}

function asciiSlug(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

async function callGemini(prompt: string): Promise<GenResult | null> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 미설정");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.5,
          // maxOutputTokens 미지정(모델 기본 상한). 낮게 캡 씌우면 thinking 토큰이
          // 예산을 먹어 긴 권위 글이 잘려 빈응답이 됨 → 캡 없이 사용.
        },
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return null;
      try {
        return JSON.parse(text) as GenResult;
      } catch {
        return null;
      }
    }
    if ([429, 500, 503].includes(res.status)) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      continue;
    }
    throw new Error(`Gemini ${res.status}`);
  }
  return null;
}

function buildPrompt(opts: { title?: string; keyword: string; brief?: string; keywords?: string[] }): string {
  return `너는 한국 최고의 SEO/AEO/GEO 콘텐츠 전략가이자 제주 부동산 전문 에디터다.
구글·네이버 검색과 AI 답변엔진(ChatGPT·Gemini·Perplexity)이 모두 좋아하는 권위 있는 한국어 글을 쓴다.

[주제] ${opts.title ?? opts.keyword}
[핵심 키워드] ${opts.keyword}
${opts.keywords?.length ? `[연관 키워드] ${opts.keywords.join(", ")}` : ""}
${opts.brief ? `[반드시 다룰 내용] ${opts.brief}` : ""}

작성 원칙:
- 사이트는 ${SITE} — 제주 부동산 영상/블로그 매물을 지도로 모아 보여주는 플랫폼. 글 안에서 자연스럽게 1~2회 우리 사이트로 매물을 찾아보라고 연결.
- answer-first: lead(첫 요약)에 핵심 답을 2~3문장으로 먼저 제시.
- bodyMarkdown: 마크다운. ## 소제목 5~7개(질문형/키워드 자연 포함), 각 소제목 아래 2~4문단. 필요시 표(|)·리스트 사용. 헤비키워드와 롱테일 키워드를 과하지 않게 자연스럽게 녹일 것(키워드 스터핑 금지). 총 1500자 이상.
- faq: 실제로 많이 검색하는 질문형 4~6개, 답은 2~4문장으로 간결·정확.
- 세금/규제/법령 수치는 단정 대신 "변동 가능, 확인 필요"로 안전하게. 추정·과장 금지.
- 한국어. 신뢰감 있는 정보형 톤.

JSON 하나만 출력(설명/마크다운 펜스 금지):
{"title":str,"slug":"영문-소문자-하이픈(ascii만)","metaDescription":"140~160자 한국어, 핵심키워드 포함","keywords":[str],"lead":str,"bodyMarkdown":str,"faq":[{"q":str,"a":str}],"related":{"regions":[str],"propertyTypes":[str],"themes":[str]},"sources":[str]}`;
}

function passesGate(g: GenResult): boolean {
  if (!g.title || !g.metaDescription || !g.bodyMarkdown) return false;
  if (g.bodyMarkdown.length < 1200) return false;
  if (!Array.isArray(g.faq) || g.faq.length < 3) return false;
  if (g.metaDescription.length < 50) return false;
  return true;
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base || "guide";
  if (!(await slugExists(slug))) return slug;
  for (let i = 2; i < 50; i++) {
    const s = `${slug}-${i}`;
    if (!(await slugExists(s))) return s;
  }
  return `${slug}-${Date.now()}`;
}

function finalize(
  g: GenResult,
  opts: {
    type: "authority" | "auto";
    cluster: string;
    intent: string;
    fixedSlug?: string;
    fallbackKeywords: string[];
    related?: Article["related"];
  },
  slug: string,
): Article {
  const now = new Date().toISOString();
  const related = {
    regions: opts.related?.regions ?? g.related?.regions ?? [],
    propertyTypes: opts.related?.propertyTypes ?? g.related?.propertyTypes ?? [],
    themes: opts.related?.themes ?? g.related?.themes ?? [],
  };
  return {
    slug,
    title: g.title!.trim(),
    metaDescription: g.metaDescription!.trim().slice(0, 170),
    keywords: (g.keywords?.length ? g.keywords : opts.fallbackKeywords).slice(0, 12),
    cluster: opts.cluster,
    intent: opts.intent,
    type: opts.type,
    lead: (g.lead ?? "").trim(),
    bodyMarkdown: g.bodyMarkdown!.trim() + DISCLAIMER,
    faq: (g.faq ?? []).slice(0, 6),
    related,
    sources: g.sources ?? [],
    author: AUTHOR,
    status: "published",
    publishedAt: now,
    updatedAt: now,
  };
}

// 권위 글 생성 (시드 스펙 기반) — 게이트 실패 시 1회 재생성
export async function generateAuthorityArticle(spec: AuthoritySpec): Promise<Article | null> {
  let g: GenResult | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    g = await callGemini(
      buildPrompt({ title: spec.title, keyword: spec.keywords[0], brief: spec.brief, keywords: spec.keywords }),
    );
    if (g && passesGate(g)) break;
    g = null;
  }
  if (!g) return null;
  g.title = spec.title; // 제목은 스펙 고정(일관성)
  const slug = await uniqueSlug(spec.slug);
  return finalize(
    g,
    {
      type: "authority",
      cluster: spec.cluster,
      intent: spec.intent,
      fixedSlug: spec.slug,
      fallbackKeywords: spec.keywords,
      related: spec.related,
    },
    slug,
  );
}

// 자동 글 생성 (키워드 기반) — 게이트 실패 시 1회 재생성
export async function generateAutoArticle(keyword: string): Promise<Article | null> {
  let g: GenResult | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    g = await callGemini(buildPrompt({ keyword }));
    if (g && passesGate(g)) break;
    g = null;
  }
  if (!g) return null;
  const base = asciiSlug(g.slug || "") || asciiSlug(keyword) || `jeju-${Date.now()}`;
  const slug = await uniqueSlug(base);
  return finalize(
    g,
    { type: "auto", cluster: "자동", intent: "정보/롱테일", fallbackKeywords: [keyword] },
    slug,
  );
}
