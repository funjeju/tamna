// TamnaIndex 결정 레이어 — 매물 연동 어댑터 (가장 중요한 단일 접점)
// 기존 Listing 객체 → 표준 거래객체.property 변환. 필드명이 다른 솔루션은 매핑만 교체하면 됨.
import type { Listing } from "../types";
import type { Deal, DealProperty, DealPurpose } from "./types";
import { emptyDeal } from "./types";

// priceText 등에서 월세(만원) 보강 추출 — "보증금 1000 / 월 50", "1000/50", "월세 50" 등
function parseMonthlyRent(text: string | undefined): number | null {
  if (!text) return null;
  const t = text.replace(/,/g, "");
  // "보증금 X / 월 Y" 또는 "X/Y" (만원 단위 가정)
  const slash = t.match(/(\d+)\s*\/\s*(\d+)/);
  if (slash) return Number(slash[2]) || null;
  const wol = t.match(/월\s*세?\s*(\d+)/);
  if (wol) return Number(wol[1]) || null;
  return null;
}

// 거래 유형 → 목적 추정
function purposeOf(dealType?: string): DealPurpose {
  if (dealType === "전세" || dealType === "월세" || dealType === "임대") return "rent";
  return "buy";
}

export function listingToDeal(listing: Listing): Deal {
  const deal = emptyDeal(purposeOf(listing.dealType));
  const isRent = deal.purpose === "rent";

  const property: DealProperty = {
    address: listing.addressText,
    region: listing.region,
    propertyType: listing.propertyType,
    dealType: listing.dealType,
    areaM2: listing.areaM2,
    areaPyeong: listing.areaPyeong,
    zoning: listing.zoning,
    lat: listing.lat,
    lng: listing.lng,
    gongsiPriceManwon: null, // Phase A(공공데이터)에서 채움
    lawdCd: null, // Phase A 연동 키
  };

  if (isRent) {
    property.depositManwon = listing.priceManwon || undefined; // 보증금
    property.monthlyRentManwon =
      listing.monthlyRentManwon ?? parseMonthlyRent(listing.priceText) ?? undefined;
  } else {
    property.priceManwon = listing.priceManwon || undefined; // 매매가
  }

  deal.property = property;
  return deal;
}

// 사람 정보(소득·현금·주택수 등)는 어댑터가 채우지 않는다 — 사용자 입력 영역.
