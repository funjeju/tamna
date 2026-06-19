// TamnaIndex — 네이버 블로그 수집 파이프라인
// 네이버 Search API → 블로그 본문 파싱 → Gemini 구조화 → Kakao 지오코딩 → Firestore 저장
import { adminDb } from "./firebase";
import { JEJU_REGIONS, REGION_NAMES } from "./regions";
import { THEMES, PROPERTY_TYPES, DEAL_TYPES } from "./types";

const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const KAKAO_REST = process.env.KAKAO_REST_KEY;

const MAX_SEARCH = 100; // 네이버 API 최대
const MAX_PROCESS = 20;

interface NaverBlogItem {
  postId: string;
  blogId: string;
  title: string;
  description: string;
  link: string;          // 원문 링크
  mobileUrl: string;     // 파싱용
  blogName: string;
  publishedAt: string;
  thumbnailUrl: string;
  images: string[];      // 본문 이미지 최대 3장
}

interface Structured {
  isListing: boolean;
  propertyType: string;
  dealType: string;
  priceManwon: number;
  priceText: string;
  areaM2: number | null;
  areaPyeong: number | null;
  zoning: string | null;
  addressText: string;
  region: string;
  summary: string;
  highlights: string[];
  keywords: string[];
  themes: string[];
  confidence: number;
}

// HTML 태그 제거
function stripHtml(s: string) {
  return s.replace(/<[^>]+>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

// ── 1) 네이버 블로그 검색 ──
async function searchNaverBlog(query: string, display = 100): Promise<any[]> {
  if (!NAVER_ID || !NAVER_SECRET) throw new Error("NAVER_CLIENT_ID/SECRET 미설정");
  const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
  const res = await fetch(url, {
    headers: {
      "X-Naver-Client-Id": NAVER_ID,
      "X-Naver-Client-Secret": NAVER_SECRET,
    },
  });
  if (!res.ok) throw new Error(`네이버 Search API 실패 ${res.status}`);
  const data = await res.json();
  return data.items || [];
}

// 네이버 블로그 URL에서 blogId, logNo 추출
function parseBlogUrl(link: string): { blogId: string; logNo: string } | null {
  // https://blog.naver.com/blogId/logNo
  const m = link.match(/blog\.naver\.com\/([^/?#]+)\/(\d+)/);
  if (m) return { blogId: m[1], logNo: m[2] };
  // redirect URL
  const m2 = link.match(/blogId=([^&]+).*logNo=(\d+)/);
  if (m2) return { blogId: m2[1], logNo: m2[2] };
  return null;
}

// pstatic.net 이미지 URL 추출 (src/data-src 모두 포함)
function extractNaverImages(html: string, limit = 3): string[] {
  const imgSet = new Set<string>();
  const SKIP = /profile|icon|default|noimg|btn_|bg_|logo/i;
  // pstatic.net 전체 서브도메인 커버 (src, data-src, content 속성 모두)
  const re = /(?:src|data-src|content)=["']?(https?:\/\/[^\s"'<>]*pstatic\.net[^\s"'<>]*)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null && imgSet.size < limit) {
    const url = m[1].replace(/&amp;/g, "&");
    if (!SKIP.test(url)) imgSet.add(url);
  }
  return [...imgSet];
}

function extractOgImage(html: string): string {
  const m = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const url = m?.[1]?.replace(/&amp;/g, "&") ?? "";
  return /profile|noimg|default/i.test(url) ? "" : url;
}

// ── 2) 블로그 본문 파싱 — 이미지 최대 3장 ──
async function parseBlogPost(blogId: string, logNo: string): Promise<{ body: string; images: string[] }> {
  const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";
  const DESKTOP_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

  async function fetchHtml(url: string, ua: string): Promise<string> {
    const res = await fetch(url, {
      headers: {
        "User-Agent": ua,
        "Referer": "https://blog.naver.com/",
        "Accept-Language": "ko-KR,ko;q=0.9",
      },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok ? res.text() : "";
  }

  try {
    const mobileUrl = `https://m.blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;
    const desktopUrl = `https://blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNo}`;

    const mobileHtml = await fetchHtml(mobileUrl, MOBILE_UA);

    // 본문 텍스트 (모바일 HTML 기준)
    const bodyMatch = mobileHtml.match(/class="se-main-container"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
    const body = stripHtml(bodyMatch?.[1] ?? mobileHtml.slice(0, 8000)).slice(0, 3000);

    // 이미지 수집: og:image 우선, 그 다음 본문 이미지
    const imgSet = new Set<string>();
    const ogImg = extractOgImage(mobileHtml);
    if (ogImg) imgSet.add(ogImg);
    for (const u of extractNaverImages(mobileHtml, 3)) {
      if (imgSet.size >= 3) break;
      imgSet.add(u);
    }

    // 모바일에서 이미지 1장도 못 찾으면 데스크탑 재시도
    if (imgSet.size === 0) {
      const desktopHtml = await fetchHtml(desktopUrl, DESKTOP_UA);
      const ogD = extractOgImage(desktopHtml);
      if (ogD) imgSet.add(ogD);
      for (const u of extractNaverImages(desktopHtml, 3)) {
        if (imgSet.size >= 3) break;
        imgSet.add(u);
      }
    }

    return { body, images: [...imgSet].slice(0, 3) };
  } catch {
    return { body: "", images: [] };
  }
}

// ── 3) Gemini 구조화 ──
async function structure(title: string, description: string, body: string): Promise<Structured | null> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 미설정");
  const prompt = `너는 제주도 부동산 블로그 글을 표준 매물 데이터로 정규화하는 추출기다.
아래 정보를 분석해서 JSON 하나만 출력해라. 설명/마크다운 금지.

[제목] ${title}
[요약] ${description.slice(0, 500)}
[본문] ${body.slice(0, 2500)}

규칙:
- 제주도 실제 부동산 매물 소개 글이 아니면 isListing=false 로만 응답.
- propertyType 은 다음 중 하나: ${PROPERTY_TYPES.join(", ")}
- dealType 은 다음 중 하나: ${DEAL_TYPES.join(", ")}
- priceManwon 은 정수(만원 단위). 예: 2억8천 → 28000. 모르면 0.
- region 은 다음 중 가장 가까운 하나: ${REGION_NAMES.join(", ")}
- addressText 는 가능한 한 구체적인 제주 주소(읍면동/리). 모르면 region 기반 추정.
- themes 는 다음 중 0~3개: ${THEMES.join(", ")}
- highlights/keywords 는 한국어 짧은 키워드 배열.
- confidence 는 0~1 사이 추출 신뢰도.

출력 JSON 스키마:
{"isListing":bool,"propertyType":str,"dealType":str,"priceManwon":int,"priceText":str,"areaM2":number|null,"areaPyeong":number|null,"zoning":str|null,"addressText":str,"region":str,"summary":str,"highlights":[str],"keywords":[str],"themes":[str],"confidence":number}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`;
  let res: Response | null = null;
  for (let i = 0; i < 3; i++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
      }),
    });
    if (res.ok) break;
    if ([429, 500, 503].includes(res.status)) {
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
      continue;
    }
    throw new Error(`Gemini 실패 ${res.status}`);
  }
  if (!res || !res.ok) return null;
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try { return JSON.parse(text) as Structured; } catch { return null; }
}

// ── 4) Kakao 지오코딩 ──
async function geocode(address: string, region: string): Promise<{ lat: number; lng: number }> {
  if (KAKAO_REST) {
    try {
      const h = { Authorization: `KakaoAK ${KAKAO_REST}` };
      const a = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, { headers: h });
      const aj = await a.json();
      if (aj.documents?.length) return { lat: parseFloat(aj.documents[0].y), lng: parseFloat(aj.documents[0].x) };
      const k = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`, { headers: h });
      const kj = await k.json();
      if (kj.documents?.length) return { lat: parseFloat(kj.documents[0].y), lng: parseFloat(kj.documents[0].x) };
    } catch { /* noop */ }
  }
  const r = JEJU_REGIONS.find((x) => x.name === region);
  return r ? { lat: r.lat, lng: r.lng } : { lat: 33.38, lng: 126.55 };
}

function normalizeRegion(region: string, address: string): string {
  if (REGION_NAMES.includes(region)) return region;
  const hit = REGION_NAMES.find((n) => address.includes(n) || region.includes(n));
  return hit ?? "제주시";
}

// ── 메인 ──
export async function runBlogCollection() {
  const startedAt = new Date();
  let processed = 0;
  let failed = 0;
  const items: any[] = [];

  // 기수집 postId 세트
  const existSnap = await adminDb.collection("listings").where("sourceType", "==", "blog").get();
  const existIds = new Set(existSnap.docs.map((d) => (d.data() as any).videoId));

  // 쿼리 다변화
  const queries = [
    "제주 부동산 매물",
    "제주 단독주택 매매",
    "제주 토지 매매",
    "제주 전원주택 매매",
    "제주 상가 매매",
  ];

  const rawItems: any[] = [];
  for (const q of queries) {
    try {
      const r = await searchNaverBlog(q, 100);
      rawItems.push(...r);
    } catch { /* noop */ }
  }

  // postId 기준 중복 제거
  const seen = new Set<string>();
  const candidates: NaverBlogItem[] = [];
  for (const it of rawItems) {
    const parsed = parseBlogUrl(it.link);
    if (!parsed) continue;
    const postId = `${parsed.blogId}_${parsed.logNo}`;
    if (seen.has(postId) || existIds.has(postId)) continue;
    seen.add(postId);
    candidates.push({
      postId,
      blogId: parsed.blogId,
      title: stripHtml(it.title),
      description: stripHtml(it.description),
      link: it.link,
      mobileUrl: `https://m.blog.naver.com/PostView.naver?blogId=${parsed.blogId}&logNo=${parsed.logNo}`,
      blogName: it.bloggername || parsed.blogId,
      publishedAt: it.postdate
        ? `${it.postdate.slice(0, 4)}-${it.postdate.slice(4, 6)}-${it.postdate.slice(6, 8)}T00:00:00Z`
        : new Date().toISOString(),
      thumbnailUrl: "",
      images: [],
    });
    if (candidates.length >= MAX_SEARCH) break;
  }

  const toProcess = candidates.slice(0, MAX_PROCESS);

  for (const c of toProcess) {
    try {
      const { body, images } = await parseBlogPost(c.blogId, c.postId.split("_")[1]);
      const s = await structure(c.title, c.description, body);
      if (!s || !s.isListing) {
        items.push({ videoId: c.postId, step: "structuring", source: "ai", status: "skip", detail: "매물 글 아님" });
        continue;
      }

      const region = normalizeRegion(s.region, s.addressText || "");
      const geo = await geocode(s.addressText || `제주 ${region}`, region);
      const thumbUrl = images[0] ?? "";

      // agents 컬렉션 — 블로그 계정 단위
      const agSnap = await adminDb.collection("agents").where("channelId", "==", c.blogId).limit(1).get();
      if (agSnap.empty) {
        await adminDb.collection("agents").add({
          channelId: c.blogId,
          channelName: c.blogName,
          channelUrl: `https://blog.naver.com/${c.blogId}`,
          name: null, regNo: null, office: null, expertise: null, phone: null,
          verified: false, optedOut: false, plan: "free", createdAt: new Date(),
        });
      }

      await adminDb.collection("listings").add({
        videoId: c.postId,             // blog postId를 videoId 필드 재활용
        videoUrl: c.link,
        sourceUrl: c.link,
        sourceType: "blog",
        thumbnailUrl: thumbUrl,
        images: JSON.stringify(images),
        title: c.title,
        channelId: c.blogId,
        publishedAt: new Date(c.publishedAt),
        collectedAt: new Date(),
        propertyType: PROPERTY_TYPES.includes(s.propertyType as any) ? s.propertyType : "기타",
        dealType: DEAL_TYPES.includes(s.dealType as any) ? s.dealType : "매매",
        priceText: s.priceText || (s.priceManwon ? `${s.priceManwon.toLocaleString()}만원` : "가격문의"),
        priceManwon: Math.round(s.priceManwon || 0),
        priceHistory: "[]",
        areaM2: s.areaM2 ?? null,
        areaPyeong: s.areaPyeong ?? (s.areaM2 ? Math.round((s.areaM2 / 3.3058) * 10) / 10 : null),
        zoning: s.zoning ?? null,
        addressText: s.addressText || `제주 ${region}`,
        region,
        lat: geo.lat,
        lng: geo.lng,
        geohash: null,
        summary: s.summary || c.title,
        highlights: JSON.stringify(s.highlights || []),
        keywords: JSON.stringify(s.keywords || []),
        themes: JSON.stringify((s.themes || []).filter((t) => THEMES.includes(t as any))),
        extractionSource: "ai",
        confidence: typeof s.confidence === "number" ? s.confidence : 0.7,
        status: "draft",
        reviewedBy: null,
        publishedAt2: null,
        takedownAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      processed++;
      items.push({ videoId: c.postId, step: "saved", source: "ai", status: "ok", detail: `${region} · ${s.propertyType}` });
    } catch (e: any) {
      failed++;
      items.push({ videoId: c.postId, step: "error", source: "pipeline", status: "fail", detail: String(e?.message || e).slice(0, 200) });
    }
  }

  const job = { trigger: "cron", region: "전체", found: candidates.length, processed, failed, items: JSON.stringify(items), startedAt, finishedAt: new Date() };
  const ref = await adminDb.collection("collectionJobs").add(job);
  return { id: ref.id, ...job, items };
}
