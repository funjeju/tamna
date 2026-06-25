// TamnaIndex — Prisma row → Listing 타입 변환 (JSON 필드 파싱)
import type { Listing as ListingType, Agent as AgentType, CollectionJob as CollectionJobType, PriceHistoryEntry, CollectionJobItem } from "./types";
import type { Listing as PrismaListing, Agent as PrismaAgent, CollectionJob as PrismaCollectionJob } from "@prisma/client";

export function mapListing(
  row: PrismaListing & { agent?: PrismaAgent | null },
  favSet?: Set<string>,
): ListingType {
  return {
    id: row.id,
    videoId: row.videoId,
    videoUrl: row.videoUrl,
    thumbnailUrl: row.thumbnailUrl,
    title: row.title,
    channelId: row.channelId,
    publishedAt: row.publishedAt.toISOString(),
    collectedAt: row.collectedAt.toISOString(),
    propertyType: row.propertyType as ListingType["propertyType"],
    dealType: row.dealType as ListingType["dealType"],
    priceText: row.priceText,
    priceManwon: row.priceManwon,
    monthlyRentManwon: (row as { monthlyRentManwon?: number | null }).monthlyRentManwon ?? null,
    priceHistory: safeParse<PriceHistoryEntry[]>(row.priceHistory, []),
    areaM2: row.areaM2,
    areaPyeong: row.areaPyeong,
    zoning: row.zoning,
    addressText: row.addressText,
    region: row.region,
    lat: row.lat,
    lng: row.lng,
    geohash: row.geohash,
    summary: row.summary,
    highlights: safeParse<string[]>(row.highlights, []),
    keywords: safeParse<string[]>(row.keywords, []),
    themes: safeParse<ListingType["themes"]>(row.themes, []),
    extractionSource: row.extractionSource as ListingType["extractionSource"],
    confidence: row.confidence,
    status: row.status as ListingType["status"],
    reviewedBy: row.reviewedBy,
    publishedAt2: row.publishedAt2?.toISOString() ?? null,
    takedownAt: row.takedownAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    agent: row.agent
      ? {
          id: row.agent.id,
          channelId: row.agent.channelId,
          channelName: row.agent.channelName,
          channelUrl: row.agent.channelUrl,
          name: row.agent.name,
          regNo: row.agent.regNo,
          office: row.agent.office,
          expertise: row.agent.expertise,
          phone: row.agent.phone,
          verified: row.agent.verified,
          optedOut: row.agent.optedOut,
          plan: row.agent.plan as AgentType["plan"],
          createdAt: row.agent.createdAt.toISOString(),
        }
      : null,
    sourceType: ((row as any).sourceType as ListingType["sourceType"]) ?? "youtube",
    images: safeParse<string[]>((row as any).images ?? null, []),
    sourceUrl: (row as any).sourceUrl ?? row.videoUrl,
    isFavorited: favSet ? favSet.has(row.id) : false,
  };
}

export function mapAgent(row: PrismaAgent, listingCount = 0): AgentType {
  return {
    id: row.id,
    channelId: row.channelId,
    channelName: row.channelName,
    channelUrl: row.channelUrl,
    name: row.name,
    regNo: row.regNo,
    office: row.office,
    expertise: row.expertise,
    phone: row.phone,
    verified: row.verified,
    optedOut: row.optedOut,
    plan: row.plan as AgentType["plan"],
    createdAt: row.createdAt.toISOString(),
    listingCount,
  };
}

export function mapCollectionJob(
  row: PrismaCollectionJob,
): CollectionJobType {
  return {
    id: row.id,
    trigger: row.trigger as CollectionJobType["trigger"],
    region: row.region,
    found: row.found,
    processed: row.processed,
    failed: row.failed,
    items: safeParse<CollectionJobItem[]>(row.items, []),
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
  };
}

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

// 게시 게이트 검증 (필수 필드 + 중개사 verified)
export function canPublish(
  row: PrismaListing & { agent?: PrismaAgent | null },
): { ok: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!row.agent || !row.agent.verified) {
    reasons.push("중개사 미검증");
  }
  if (row.priceManwon <= 0) reasons.push("가격 누락");
  if (!row.areaM2 || row.areaM2 <= 0) reasons.push("면적 누락");
  if (!row.addressText || row.addressText.startsWith("추출 실패"))
    reasons.push("주소 누락");
  if (row.confidence < 0.5) reasons.push("추출 신뢰도 낮음");
  return { ok: reasons.length === 0, reasons };
}
