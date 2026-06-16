// Client-side 게시 게이트 검증 — src/lib/mapper.ts의 canPublish()와 동일 로직
// UI에서 즉시 피드백 제공
import type { Listing } from "@/lib/types";

export interface CanPublishResult {
  ok: boolean;
  reasons: string[];
}

export function canPublishClient(listing: Listing): CanPublishResult {
  const reasons: string[] = [];
  if (!listing.agent || !listing.agent.verified) {
    reasons.push("중개사 미검증");
  }
  if (!listing.priceManwon || listing.priceManwon <= 0) {
    reasons.push("가격 누락");
  }
  if (!listing.areaM2 || listing.areaM2 <= 0) {
    reasons.push("면적 누락");
  }
  if (!listing.addressText || listing.addressText.startsWith("추출 실패")) {
    reasons.push("주소 누락");
  }
  if (listing.confidence < 0.5) {
    reasons.push("추출 신뢰도 낮음");
  }
  return { ok: reasons.length === 0, reasons };
}

// 면적 단위 변환 (㎡ ↔ 평)
export const PYEONG_TO_M2 = 3.305785;
export const M2_TO_PYEONG = 0.3025;

export function m2ToPyeong(m2: number): number {
  return Math.round(m2 * M2_TO_PYEONG * 10) / 10;
}

export function pyeongToM2(p: number): number {
  return Math.round(p * PYEONG_TO_M2 * 10) / 10;
}

// SVG → lat/lng 역변환 (latLngToSvg의 역함수)
// src/lib/regions.ts의 latLngToSvg() 참고
export function svgToLatLng(x: number, y: number): { lat: number; lng: number } {
  const minLat = 33.18;
  const maxLat = 33.6;
  const minLng = 126.15;
  const maxLng = 126.96;
  const lng = ((x - 85) / 840) * (maxLng - minLng) + minLng;
  const lat = ((590 + 30 - y) / 510) * (maxLat - minLat) + minLat;
  // clamp
  return {
    lat: Math.max(minLat, Math.min(maxLat, lat)),
    lng: Math.max(minLng, Math.min(maxLng, lng)),
  };
}

export function fmtManwon(m: number): string {
  if (m >= 10000) {
    return `${(m / 10000).toLocaleString("ko-KR", { maximumFractionDigits: 1 })}억`;
  }
  return `${m.toLocaleString("ko-KR")}만원`;
}

export function fmtTimeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
