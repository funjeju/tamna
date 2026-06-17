// TamnaIndex — 실제 수집 파이프라인
// YouTube 검색 → 영상 설명/자막 → Gemini 구조화 → Kakao 지오코딩 → Firestore 저장
import { adminDb } from "./firebase";
import { JEJU_REGIONS, REGION_NAMES } from "./regions";
import { THEMES, PROPERTY_TYPES, DEAL_TYPES } from "./types";
import type { CollectionJobItem } from "./types";

const YT_KEY = process.env.YOUTUBE_API_KEY;
const GEMINI_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const KAKAO_REST = process.env.KAKAO_REST_KEY;
const SOCIALKIT = process.env.SOCIALKIT_ACCESS_KEY;

const MAX_VIDEOS = 10; // Vercel Pro (maxDuration 300s) 기준

// 지정 시간 내 응답 없으면 중단하는 fetch
async function fetchT(url: string, ms: number, init?: RequestInit) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

interface YtVideo {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
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

// ── 1) YouTube 검색 ──
async function youtubeSearch(
  keyword: string,
  region: string,
  periodDays: number,
): Promise<YtVideo[]> {
  if (!YT_KEY) throw new Error("YOUTUBE_API_KEY 미설정");
  const publishedAfter = new Date(
    Date.now() - periodDays * 86400000,
  ).toISOString();
  const qParts = ["제주", region && region !== "전체" ? region : "", "부동산", keyword]
    .filter(Boolean)
    .join(" ");
  const searchUrl =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date` +
    `&maxResults=${MAX_VIDEOS}&regionCode=KR&relevanceLanguage=ko` +
    `&publishedAfter=${encodeURIComponent(publishedAfter)}` +
    `&q=${encodeURIComponent(qParts)}&key=${YT_KEY}`;
  const res = await fetch(searchUrl);
  if (!res.ok) throw new Error(`YouTube 검색 실패 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const ids: string[] = (data.items || [])
    .map((i: any) => i.id?.videoId)
    .filter(Boolean);
  if (ids.length === 0) return [];

  // 상세(설명 전문) 조회
  const detailUrl =
    `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${ids.join(",")}&key=${YT_KEY}`;
  const dRes = await fetch(detailUrl);
  const dData = await dRes.json();
  return (dData.items || []).map((it: any): YtVideo => ({
    videoId: it.id,
    title: it.snippet?.title ?? "",
    description: it.snippet?.description ?? "",
    channelId: it.snippet?.channelId ?? "",
    channelTitle: it.snippet?.channelTitle ?? "",
    publishedAt: it.snippet?.publishedAt ?? new Date().toISOString(),
    thumbnailUrl:
      it.snippet?.thumbnails?.high?.url ??
      it.snippet?.thumbnails?.medium?.url ??
      `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
  }));
}

// ── 2) 자막 (SocialKit, 실패 시 빈 문자열) ──
async function getTranscript(videoId: string): Promise<string> {
  if (!SOCIALKIT) return "";
  try {
    const url = `https://api.socialkit.dev/youtube/transcript?access_key=${SOCIALKIT}&url=https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetchT(url, 8000);
    if (!res.ok) return "";
    const data = await res.json();
    const t =
      data?.data?.transcript ??
      data?.transcript ??
      (Array.isArray(data?.data?.segments)
        ? data.data.segments.map((s: any) => s.text).join(" ")
        : "");
    return typeof t === "string" ? t.slice(0, 6000) : "";
  } catch {
    return "";
  }
}

// ── 3) Gemini 구조화 ──
async function structure(v: YtVideo, transcript: string): Promise<Structured | null> {
  if (!GEMINI_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY 미설정");
  const prompt = `너는 제주도 부동산 유튜브 영상을 표준 매물 데이터로 정규화하는 추출기다.
아래 영상 정보를 분석해서 JSON 하나만 출력해라. 설명/마크다운 금지.

[제목] ${v.title}
[설명] ${v.description?.slice(0, 2500)}
[자막] ${transcript?.slice(0, 3000)}

규칙:
- 제주도 실제 부동산 매물 소개 영상이 아니면 isListing=false 로만 응답.
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
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini 실패 ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Structured;
    return parsed;
  } catch {
    return null;
  }
}

// ── 4) Kakao 지오코딩 ──
async function geocode(
  address: string,
  region: string,
): Promise<{ lat: number; lng: number } | null> {
  if (!KAKAO_REST) return regionFallback(region);
  const headers = { Authorization: `KakaoAK ${KAKAO_REST}` };
  try {
    // 주소 검색
    const a = await fetch(
      `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
      { headers },
    );
    const aj = await a.json();
    if (aj.documents?.length) {
      return { lat: parseFloat(aj.documents[0].y), lng: parseFloat(aj.documents[0].x) };
    }
    // 키워드 검색 폴백
    const k = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`,
      { headers },
    );
    const kj = await k.json();
    if (kj.documents?.length) {
      return { lat: parseFloat(kj.documents[0].y), lng: parseFloat(kj.documents[0].x) };
    }
  } catch {
    /* noop */
  }
  return regionFallback(region);
}

function regionFallback(region: string): { lat: number; lng: number } | null {
  const r = JEJU_REGIONS.find((x) => x.name === region);
  if (r) return { lat: r.lat, lng: r.lng };
  return { lat: 33.38, lng: 126.55 }; // 제주 중심
}

function normalizeRegion(region: string, address: string): string {
  if (REGION_NAMES.includes(region)) return region;
  const hit = REGION_NAMES.find((n) => address.includes(n) || region.includes(n));
  return hit ?? "제주시";
}

// ── Firestore 헬퍼 ──
async function loadKeySet(coll: string, field: string): Promise<Set<string>> {
  const snap = await adminDb.collection(coll).get();
  return new Set(snap.docs.map((d) => (d.data() as any)[field]).filter(Boolean));
}

async function upsertAgent(v: YtVideo): Promise<void> {
  const snap = await adminDb
    .collection("agents")
    .where("channelId", "==", v.channelId)
    .limit(1)
    .get();
  if (!snap.empty) return;
  await adminDb.collection("agents").add({
    channelId: v.channelId,
    channelName: v.channelTitle,
    channelUrl: `https://youtube.com/channel/${v.channelId}`,
    name: null,
    regNo: null,
    office: null,
    expertise: null,
    phone: null,
    verified: false,
    optedOut: false,
    plan: "free",
    createdAt: new Date(),
  });
}

// videoId 들로 영상 상세 조회 (변경 감지용)
async function youtubeByIds(ids: string[]): Promise<Map<string, YtVideo>> {
  const map = new Map<string, YtVideo>();
  if (!YT_KEY || ids.length === 0) return map;
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${chunk.join(",")}&key=${YT_KEY}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    for (const it of data.items || []) {
      map.set(it.id, {
        videoId: it.id,
        title: it.snippet?.title ?? "",
        description: it.snippet?.description ?? "",
        channelId: it.snippet?.channelId ?? "",
        channelTitle: it.snippet?.channelTitle ?? "",
        publishedAt: it.snippet?.publishedAt ?? new Date().toISOString(),
        thumbnailUrl:
          it.snippet?.thumbnails?.high?.url ??
          `https://i.ytimg.com/vi/${it.id}/hqdefault.jpg`,
      });
    }
  }
  return map;
}

// ── 기존 매물 변경(가격) 재확인 ──
export async function recheckUpdates(limit = 8) {
  const snap = await adminDb.collection("listings").get();
  const rows = snap.docs
    .map((d) => ({ _id: d.id, ...(d.data() as any) }))
    .filter((r) => ["published", "draft"].includes(r.status))
    .sort((a, b) => {
      const at = a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
      const bt = b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
      return at - bt; // 가장 오래 전 확인된 것부터
    })
    .slice(0, limit);

  const vids = await youtubeByIds(rows.map((r) => r.videoId));
  let updated = 0;
  let gone = 0;
  const details: any[] = [];

  for (const r of rows) {
    const v = vids.get(r.videoId);
    if (!v) {
      gone++;
      details.push({ videoId: r.videoId, change: "video_removed" });
      // 영상이 삭제된 경우 표시만 (자동 비공개는 운영자 판단)
      await adminDb.collection("listings").doc(r._id).set({ updatedAt: new Date() }, { merge: true });
      continue;
    }
    const s = await structure(v, "");
    const touch: any = { updatedAt: new Date() };
    let changed = false;
    if (s?.isListing && s.priceManwon > 0 && s.priceManwon !== r.priceManwon) {
      const hist = (() => {
        try {
          return JSON.parse(r.priceHistory || "[]");
        } catch {
          return [];
        }
      })();
      hist.push({ manwon: r.priceManwon, at: new Date().toISOString() });
      touch.priceHistory = JSON.stringify(hist);
      touch.priceManwon = Math.round(s.priceManwon);
      touch.priceText = s.priceText || `${Math.round(s.priceManwon).toLocaleString()}만원`;
      changed = true;
    }
    await adminDb.collection("listings").doc(r._id).set(touch, { merge: true });
    if (changed) {
      updated++;
      details.push({ videoId: r.videoId, change: "price", to: touch.priceManwon });
    }
  }
  return { checked: rows.length, updated, gone, details };
}

// ── 메인 ──
export async function runCollection(opts: {
  region: string;
  periodDays: number;
  keyword: string;
  trigger?: "manual" | "cron";
}) {
  const startedAt = new Date();
  const items: CollectionJobItem[] = [];
  let processed = 0;
  let failed = 0;

  const videos = await youtubeSearch(opts.keyword, opts.region, opts.periodDays);
  const existing = await loadKeySet("listings", "videoId");
  const optOuts = await loadKeySet("optOuts", "key");

  for (const v of videos) {
    try {
      if (existing.has(v.videoId)) {
        items.push({ videoId: v.videoId, step: "dedupe", source: "youtube", status: "skip", detail: "이미 수집됨" });
        continue;
      }
      if (optOuts.has(v.videoId) || optOuts.has(v.channelId)) {
        items.push({ videoId: v.videoId, step: "optout", source: "youtube", status: "skip", detail: "옵트아웃 대상" });
        continue;
      }

      const transcript = await getTranscript(v.videoId);
      const s = await structure(v, transcript);
      if (!s || !s.isListing) {
        items.push({ videoId: v.videoId, step: "structuring", source: "ai", status: "skip", detail: "매물 영상 아님" });
        continue;
      }

      const region = normalizeRegion(s.region, s.addressText || "");
      const geo = await geocode(s.addressText || `제주 ${region}`, region);

      await upsertAgent(v);
      await adminDb.collection("listings").add({
        videoId: v.videoId,
        videoUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        thumbnailUrl: v.thumbnailUrl,
        title: v.title,
        channelId: v.channelId,
        publishedAt: new Date(v.publishedAt),
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
        lat: geo?.lat ?? 33.38,
        lng: geo?.lng ?? 126.55,
        geohash: null,
        summary: s.summary || v.title,
        highlights: JSON.stringify(s.highlights || []),
        keywords: JSON.stringify(s.keywords || []),
        themes: JSON.stringify((s.themes || []).filter((t) => THEMES.includes(t as any))),
        extractionSource: "ai",
        confidence: typeof s.confidence === "number" ? s.confidence : 0.7,
        status: "draft", // 검수 대기
        reviewedBy: null,
        publishedAt2: null,
        takedownAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      existing.add(v.videoId);
      processed++;
      items.push({ videoId: v.videoId, step: "saved", source: "ai", status: "ok", detail: `${region} · ${s.propertyType}` });
    } catch (e: any) {
      failed++;
      items.push({ videoId: v.videoId, step: "error", source: "pipeline", status: "fail", detail: String(e?.message || e).slice(0, 200) });
    }
  }

  const job = {
    trigger: opts.trigger || "manual",
    region: opts.region || "전체",
    found: videos.length,
    processed,
    failed,
    items: JSON.stringify(items),
    startedAt,
    finishedAt: new Date(),
  };
  const ref = await adminDb.collection("collectionJobs").add(job);
  return { id: ref.id, ...job, items };
}
