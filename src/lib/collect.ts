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

const CANDIDATE_CAP = 120; // 검색으로 수집할 후보 영상 최대 수
const MAX_PROCESS = 25; // 한 번에 AI 구조화/저장할 신규 매물 수 (Vercel Pro 300s 고려)
const PAGES_PER_QUERY = 2; // 쿼리당 페이지네이션 깊이

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

// ── 1) YouTube 검색 (쿼리 다변화 + 페이지네이션) ──
// 단일 쿼리/10건만 보면 매번 같은 영상만 잡히므로,
// 지역·유형별 쿼리 여러 개를 페이지 단위로 깊게 훑어 후보를 넓힌다.
function buildQueries(keyword: string, region: string, light = false): string[] {
  const kw = (keyword || "").trim();
  const base = region && region !== "전체" ? `제주 ${region}` : "제주";
  // light: 읍면동 로테이션용 — 매일 15개를 다 도는 대신 쿼터 절약 (지역당 3쿼리×1페이지)
  if (light) {
    const qs = [
      `${base} 매물`,
      `${base} 단독주택 매매`,
      `${base} 토지 매매`,
    ];
    return [...new Set(qs.filter(Boolean))];
  }
  const qs = [
    `${base} 부동산 ${kw}`.trim(),
    `${base} 매물`,
    `${base} 단독주택 매매`,
    `${base} 전원주택`,
    `${base} 토지 매매`,
    `${base} 상가 매매`,
    `${base} 빌라 매매`,
  ];
  return [...new Set(qs.filter(Boolean))];
}

async function searchPage(
  q: string,
  publishedAfter: string,
  order: string,
  pageToken?: string,
): Promise<{ ids: string[]; next?: string }> {
  let url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=${order}` +
    `&maxResults=50&regionCode=KR&relevanceLanguage=ko` +
    `&publishedAfter=${encodeURIComponent(publishedAfter)}` +
    `&q=${encodeURIComponent(q)}&key=${YT_KEY}`;
  if (pageToken) url += `&pageToken=${pageToken}`;
  const res = await fetch(url);
  if (!res.ok) return { ids: [] };
  const data = await res.json();
  const ids = (data.items || []).map((i: any) => i.id?.videoId).filter(Boolean);
  return { ids, next: data.nextPageToken };
}

async function fetchDetails(ids: string[]): Promise<YtVideo[]> {
  const out: YtVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${chunk.join(",")}&key=${YT_KEY}`;
    const res = await fetch(url);
    if (!res.ok) continue;
    const data = await res.json();
    for (const it of data.items || []) {
      out.push({
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
      });
    }
  }
  return out;
}

async function searchCandidates(
  keyword: string,
  region: string,
  periodDays: number,
  light = false,
): Promise<YtVideo[]> {
  if (!YT_KEY) throw new Error("YOUTUBE_API_KEY 미설정");
  const publishedAfter = new Date(Date.now() - periodDays * 86400000).toISOString();
  const queries = buildQueries(keyword, region, light);
  const pages = light ? 1 : PAGES_PER_QUERY;
  const idSet = new Set<string>();

  for (const q of queries) {
    if (idSet.size >= CANDIDATE_CAP) break;
    let token: string | undefined;
    for (let p = 0; p < pages && idSet.size < CANDIDATE_CAP; p++) {
      // relevance 로 깊게, 첫 쿼리는 최신순도 한 번 섞음
      const order = p === 0 ? "relevance" : "date";
      const { ids, next } = await searchPage(q, publishedAfter, order, token);
      ids.forEach((id) => idSet.add(id));
      if (!next) break;
      token = next;
    }
  }

  return fetchDetails([...idSet].slice(0, CANDIDATE_CAP));
}

// 자막 사용 여부 — 현재 보류(제목+설명만으로 구조화). 재개하려면 true.
const USE_TRANSCRIPT = false;

// ── 2-a) 고정댓글 (핀된 댓글 1개) ──
async function getPinnedComment(videoId: string): Promise<string> {
  if (!YT_KEY) return "";
  try {
    const url =
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet` +
      `&videoId=${videoId}&maxResults=20&key=${YT_KEY}`;
    const res = await fetchT(url, 8000);
    if (!res.ok) return "";
    const data = await res.json();
    const pinned = (data.items || []).find(
      (it: any) => it.snippet?.topLevelComment?.snippet?.likeCount >= 0 &&
        it.snippet?.canReply !== undefined,
    );
    // 가장 상단 댓글(핀 여부와 무관하게 상위 댓글이 주로 중개사 정보)
    const top = (data.items || [])[0];
    const text = top?.snippet?.topLevelComment?.snippet?.textDisplay ?? "";
    return text.slice(0, 1000);
  } catch {
    return "";
  }
}

// ── 2) 자막 (SocialKit, 실패 시 빈 문자열) ──
async function getTranscript(videoId: string): Promise<string> {
  if (!USE_TRANSCRIPT || !SOCIALKIT) return "";
  try {
    const videoUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
    const url = `https://api.socialkit.dev/youtube/transcript?access_key=${SOCIALKIT}&video_url=${videoUrl}`;
    const res = await fetchT(url, 10000);
    if (!res.ok) return "";
    const data = await res.json();
    const t =
      data?.data?.transcript ??
      data?.transcript ??
      data?.data?.text ??
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
[상단댓글] ${(v as any).pinnedComment ?? ""}

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
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  });

  // 과부하(503)/레이트리밋(429)/일시오류(500)는 backoff 재시도
  let res: Response | null = null;
  let lastErr = "";
  for (let attempt = 0; attempt < 4; attempt++) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (res.ok) break;
    if ([429, 500, 503].includes(res.status)) {
      lastErr = `${res.status}`;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1) + Math.random() * 800));
      continue;
    }
    throw new Error(`Gemini 실패 ${res.status}: ${(await res.text()).slice(0, 120)}`);
  }
  if (!res || !res.ok)
    throw new Error(`Gemini 과부하 재시도 실패 (${lastErr})`);
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
  light?: boolean;
  maxProcess?: number; // 이 실행에서 구조화·저장할 신규 매물 상한 (미지정 시 MAX_PROCESS)
}) {
  const startedAt = new Date();
  const items: CollectionJobItem[] = [];
  let processed = 0;
  let failed = 0;

  const candidates = await searchCandidates(opts.keyword, opts.region, opts.periodDays, opts.light);
  const existing = await loadKeySet("listings", "videoId");
  const optOuts = await loadKeySet("optOuts", "key");

  // 신규(미수집·비옵트아웃)만 선별 → 같은 영상 재처리 방지
  const fresh = candidates.filter(
    (v) =>
      !existing.has(v.videoId) &&
      !optOuts.has(v.videoId) &&
      !optOuts.has(v.channelId),
  );
  const dupCount = candidates.length - fresh.length;
  if (dupCount > 0) {
    items.push({
      videoId: `${dupCount}건`,
      step: "dedupe",
      source: "youtube",
      status: "skip",
      detail: `이미 수집/옵트아웃이라 건너뜀 (후보 ${candidates.length}건 중)`,
    });
  }

  const cap = Math.max(1, opts.maxProcess ?? MAX_PROCESS);
  const toProcess = fresh.slice(0, cap);

  for (const v of toProcess) {
    try {
      const [transcript, pinnedComment] = await Promise.all([
        getTranscript(v.videoId),
        getPinnedComment(v.videoId),
      ]);
      const vWithComment = { ...v, pinnedComment };
      const s = await structure(vWithComment as any, transcript);
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
    found: candidates.length,
    processed,
    failed,
    items: JSON.stringify(items),
    startedAt,
    finishedAt: new Date(),
  };
  const ref = await adminDb.collection("collectionJobs").add(job);
  return { id: ref.id, ...job, items };
}
