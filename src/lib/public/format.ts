// TamnaIndex — 공개 사이트 공용 포맷/표현 유틸
import type { Listing } from "@/lib/types";
import { authHeaders } from "@/lib/authToken";

/** 만원 단위 가격 → "3.2억" / "8,500만" 문자열 */
export function formatPrice(manwon: number, fallbackText?: string): string {
  if (fallbackText && fallbackText.trim()) return fallbackText;
  if (!manwon || manwon <= 0) return "가격 미정";
  if (manwon >= 10000) {
    const uk = manwon / 10000;
    // 정수억이면 "3억", 아니면 "3.2억"
    return Number.isInteger(uk) ? `${uk}억` : `${uk.toFixed(1)}억`;
  }
  return `${manwon.toLocaleString("ko-KR")}만`;
}

/** 면적(평) 표시 */
export function formatArea(pyeong: number | null | undefined): string {
  if (!pyeong || pyeong <= 0) return "면적 미정";
  return Number.isInteger(pyeong)
    ? `${pyeong}평`
    : `${pyeong.toFixed(1)}평`;
}

/** 면적(㎡) 표시 */
export function formatAreaM2(m2: number | null | undefined): string {
  if (!m2 || m2 <= 0) return "";
  return Number.isInteger(m2) ? `${m2}㎡` : `${m2.toFixed(1)}㎡`;
}

/** "방금" / "3분 전" / "5시간 전" / "3일 전" 등 한국어 상대시간 */
export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}개월 전`;
  const year = Math.floor(month / 12);
  return `${year}년 전`;
}

/** 게시 시점으로부터 24시간 이내인지 (방금 게시 배지) */
export function isJustPublished(l: Listing): boolean {
  if (!l.publishedAt2) return false;
  const t = new Date(l.publishedAt2).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 24 * 60 * 60 * 1000;
}

/** 가격인하 이력 유무 */
export function hasPriceDrop(l: Listing): boolean {
  return Array.isArray(l.priceHistory) && l.priceHistory.length > 0;
}

/** 가격인하 차액(만원). 가장 최근 이력 기준. */
export function lastPriceDrop(l: Listing): { from: number; to: number; diff: number } | null {
  if (!hasPriceDrop(l)) return null;
  const hist = [...l.priceHistory].sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
  const prev = hist[hist.length - 1];
  return {
    from: prev.manwon,
    to: l.priceManwon,
    diff: prev.manwon - l.priceManwon,
  };
}

/** 찜 API 호출 헬퍼 (상대 경로 강제) */
export async function toggleFavorite(listingId: string, notifyPriceDrop = false) {
  const res = await fetch("/api/favorites", {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ listingId, notifyPriceDrop }),
  });
  if (!res.ok) throw new Error("favorite request failed");
  return (await res.json()) as { favorited: boolean; notifyPriceDrop?: boolean };
}

/** listings API 쿼리스트링 빌더 */
export function buildListingsQuery(filters: {
  q?: string;
  sourceType?: string;
  propertyTypes?: string[];
  dealTypes?: string[];
  priceMin?: number;
  priceMax?: number;
  areaMin?: number;
  areaMax?: number;
  regions?: string[];
  themes?: string[];
  keywords?: string[];
  sort?: string;
  status?: string;
  limit?: number;
  maxAgeDays?: number;
}): string {
  const sp = new URLSearchParams();
  if (filters.q) sp.set("q", filters.q);
  if (filters.sourceType) sp.set("sourceType", filters.sourceType);
  sp.set("status", filters.status ?? "published");
  if (filters.sort) sp.set("sort", filters.sort);
  if (filters.limit) sp.set("limit", String(filters.limit));
  if (filters.maxAgeDays) sp.set("maxAgeDays", String(filters.maxAgeDays));
  filters.propertyTypes?.forEach((v) => sp.append("propertyTypes", v));
  filters.dealTypes?.forEach((v) => sp.append("dealTypes", v));
  filters.regions?.forEach((v) => sp.append("regions", v));
  filters.themes?.forEach((v) => sp.append("themes", v));
  filters.keywords?.forEach((v) => sp.append("keywords", v));
  if (filters.priceMin !== undefined) sp.set("priceMin", String(filters.priceMin));
  if (filters.priceMax !== undefined) sp.set("priceMax", String(filters.priceMax));
  if (filters.areaMin !== undefined) sp.set("areaMin", String(filters.areaMin));
  if (filters.areaMax !== undefined) sp.set("areaMax", String(filters.areaMax));
  return `/api/listings?${sp.toString()}`;
}
