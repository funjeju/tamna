// TamnaIndex 결정 엔진 확장 — 양도세·재산세·증여세(간이)·전세인상·부대비용. 단위 만원.
// ⚠️ 세금은 간이 추정(참고용). 세율·공제는 기준일 태깅, 정밀계산은 별도 세금엔진(다음 단계).
const round = (n: number, d = 0) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

export const TAX_ASOF = "2024-01-01"; // 세율표 기준(확인필요, RAG/전문가 검증 대상)

interface Band {
  upTo: number;
  rate: number;
  deduct: number;
} // 만원, %, 누진공제 만원
function progressive(baseManwon: number, bands: Band[]): { taxManwon: number; ratePct: number } {
  if (baseManwon <= 0) return { taxManwon: 0, ratePct: 0 };
  const b = bands.find((x) => baseManwon <= x.upTo) ?? bands[bands.length - 1];
  return { taxManwon: round(baseManwon * (b.rate / 100) - b.deduct), ratePct: b.rate };
}

// ── 양도소득세 (간이) ── 소득세 기본세율 + 장기보유특별공제(일반) + 지방소득세 10%
const INCOME_BANDS: Band[] = [
  { upTo: 1400, rate: 6, deduct: 0 },
  { upTo: 5000, rate: 15, deduct: 126 },
  { upTo: 8800, rate: 24, deduct: 576 },
  { upTo: 15000, rate: 35, deduct: 1544 },
  { upTo: 30000, rate: 38, deduct: 1994 },
  { upTo: 50000, rate: 40, deduct: 2594 },
  { upTo: 100000, rate: 42, deduct: 3594 },
  { upTo: Infinity, rate: 45, deduct: 6594 },
];
export function ltSpecialDeductPct(holdYears: number): number {
  if (holdYears < 3) return 0;
  return Math.min(30, 6 + (holdYears - 3) * 2); // 일반: 3년 6%, 연 2%, 최대 30%
}
export function capitalGainsTax(p: {
  acquireManwon: number;
  transferManwon: number;
  expenseManwon?: number;
  holdYears: number;
}) {
  const gain = p.transferManwon - p.acquireManwon - (p.expenseManwon ?? 0);
  if (gain <= 0) {
    return { gainManwon: round(gain), ltsdManwon: 0, taxableManwon: 0, incomeTaxManwon: 0, localTaxManwon: 0, totalManwon: 0 };
  }
  const ltsd = round(gain * (ltSpecialDeductPct(p.holdYears) / 100));
  const taxable = Math.max(0, gain - ltsd - 250); // 기본공제 250만
  const inc = progressive(taxable, INCOME_BANDS).taxManwon;
  const local = round(inc * 0.1);
  return {
    gainManwon: round(gain),
    ltsdManwon: ltsd,
    taxableManwon: round(taxable),
    incomeTaxManwon: round(inc),
    localTaxManwon: local,
    totalManwon: round(inc + local),
  };
}

// ── 증여세 (간이) ── 관계별 공제 + 누진세율
const GIFT_BANDS: Band[] = [
  { upTo: 10000, rate: 10, deduct: 0 },
  { upTo: 50000, rate: 20, deduct: 1000 },
  { upTo: 100000, rate: 30, deduct: 6000 },
  { upTo: 300000, rate: 40, deduct: 16000 },
  { upTo: Infinity, rate: 50, deduct: 46000 },
];
export type GiftRelation = "spouse" | "lineal" | "minor" | "other";
const GIFT_DEDUCT: Record<GiftRelation, number> = { spouse: 60000, lineal: 5000, minor: 2000, other: 1000 };
export function giftTax(giftManwon: number, relation: GiftRelation) {
  const deduct = GIFT_DEDUCT[relation];
  const taxable = Math.max(0, giftManwon - deduct);
  const r = progressive(taxable, GIFT_BANDS);
  return { deductManwon: deduct, taxableManwon: round(taxable), taxManwon: r.taxManwon, ratePct: r.ratePct };
}

// ── 재산세 (주택, 간이) ── 과표 = 공시가 × 공정시장가액비율(60%)
const PROPERTY_FMV = 0.6;
const PROPERTY_BANDS: Band[] = [
  { upTo: 6000, rate: 0.1, deduct: 0 },
  { upTo: 15000, rate: 0.15, deduct: 3 },
  { upTo: 30000, rate: 0.25, deduct: 18 },
  { upTo: Infinity, rate: 0.4, deduct: 63 },
];
export function propertyTax(gongsiManwon: number) {
  const base = round(gongsiManwon * PROPERTY_FMV);
  const r = progressive(base, PROPERTY_BANDS);
  return { baseManwon: base, taxManwon: r.taxManwon, ratePct: r.ratePct };
}

// ── 전월세 인상 상한(5%) ──
export function rentIncreaseCap(currentManwon: number, capPct = 5) {
  return { capManwon: round(currentManwon * (1 + capPct / 100)), increaseManwon: round(currentManwon * (capPct / 100)) };
}

// ── 매수 부대비용(간이 추정) ── 취득세는 별도. 인지세·채권할인·법무비 대략.
export function purchaseExtraCosts(priceManwon: number) {
  // 인지세(구간 정액, 만원)
  const eok = priceManwon / 10000;
  let stamp = 0;
  if (eok <= 1) stamp = 0; // 1억 이하 비과세(주택 표준)
  else if (eok <= 10) stamp = 15;
  else stamp = 35;
  const bond = round(priceManwon * 0.002); // 국민주택채권 할인 대략 0.2%
  const judicial = 40; // 법무사 보수 추정 정액
  return {
    stampManwon: stamp,
    bondManwon: bond,
    judicialManwon: judicial,
    totalManwon: round(stamp + bond + judicial),
  };
}
