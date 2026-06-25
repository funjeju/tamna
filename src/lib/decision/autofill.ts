// TamnaIndex 결정 레이어 — 자동입력 (지역 → 규제/LTV/스트레스금리). rule/region 계층.
import { RULES } from "./rules";

// 조정대상지역(규제) 목록 — 제주는 현재 전 지역 비규제. 서울/경기 확장 시 채운다.
const REGULATED_REGIONS = new Set<string>([]);

export interface RegionContext {
  regulated: boolean;
  ltvCapPct: number;
  stressAddRatePct: number;
  dsrLimitPct: number;
  meta: {
    asOf: string;
    source: string;
    verifyRequired: boolean;
  };
}

export function contextForRegion(region?: string, firstTime = false): RegionContext {
  const regulated = region ? REGULATED_REGIONS.has(region) : false;
  const ltvField = firstTime
    ? RULES.ltv.firstTime
    : regulated
      ? RULES.ltv.regulated
      : RULES.ltv.nonRegulated;
  return {
    regulated,
    ltvCapPct: ltvField.value,
    stressAddRatePct: RULES.stressAddRatePct.value,
    dsrLimitPct: RULES.dsrLimitPct.value,
    meta: {
      asOf: ltvField.asOf,
      source: ltvField.source,
      verifyRequired: ltvField.verifyRequired,
    },
  };
}
