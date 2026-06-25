// TamnaIndex 결정 레이어 — 규정 데이터 (정책·요율). 코드가 아니라 '데이터'로 분리.
// 원칙: 모든 정책값은 기준일(asOf)·출처(source)·검증필요(verifyRequired)를 달고,
//       추출 시점에 RAG로 최신값을 갱신할 수 있도록 구조만 고정한다. (값은 시드)
// ⚠️ 아래 수치는 '시드(확인필요)'다. 운영 전 RAG 갱신 또는 전문가 확인을 거쳐야 한다.

export interface PolicyValue<T> {
  value: T;
  asOf: string; // 기준일
  source: string; // 근거(법령/고시/기관)
  verifyRequired: boolean; // 추출 시점 RAG/전문가 확인 필요
}

const SEED_ASOF = "2024-01-01";
const seed = <T>(value: T, source: string): PolicyValue<T> => ({
  value,
  asOf: SEED_ASOF,
  source,
  verifyRequired: true,
});

// ── DSR/LTV ──
export const RULES = {
  // 은행권 DSR 한도(%)
  dsrLimitPct: seed(40, "금융위 DSR 규제"),
  // 스트레스 DSR 가산금리(%p) — 시점·차주 단위로 변동
  stressAddRatePct: seed(1.5, "스트레스 DSR 제도"),
  // LTV 상한(%) — 규제/비규제 × 생애최초
  ltv: {
    nonRegulated: seed(70, "비규제지역 LTV"),
    regulated: seed(50, "규제(조정대상)지역 LTV"),
    firstTime: seed(80, "생애최초 LTV 우대"),
  },
  // 전월세 전환율 상한(%) = 한국은행 기준금리 + 대통령령 비율(현 2%)
  jeonseWolseConvCapPct: seed(5.5, "주임법 전월세전환율 상한(기준금리+2%)"),
  // 중개보수 상한 요율표 (거래금액 구간 → 요율%, 상한 만원). 협의 가능, 지자체 조례 상이.
  brokerFeeSale: seed(
    [
      { upToManwon: 5000, ratePct: 0.6, capManwon: 25 },
      { upToManwon: 20000, ratePct: 0.5, capManwon: 80 },
      { upToManwon: 90000, ratePct: 0.4, capManwon: null },
      { upToManwon: 120000, ratePct: 0.5, capManwon: null },
      { upToManwon: 150000, ratePct: 0.6, capManwon: null },
      { upToManwon: Infinity, ratePct: 0.7, capManwon: null },
    ] as BrokerBand[],
    "공인중개사법 매매 중개보수 상한",
  ),
  brokerFeeRent: seed(
    [
      { upToManwon: 5000, ratePct: 0.5, capManwon: 20 },
      { upToManwon: 10000, ratePct: 0.4, capManwon: 30 },
      { upToManwon: 60000, ratePct: 0.3, capManwon: null },
      { upToManwon: 120000, ratePct: 0.4, capManwon: null },
      { upToManwon: 150000, ratePct: 0.5, capManwon: null },
      { upToManwon: Infinity, ratePct: 0.6, capManwon: null },
    ] as BrokerBand[],
    "공인중개사법 임대차 중개보수 상한",
  ),
  // 취득세(주택 매매, 85㎡ 이하 일반 기준). 다주택 중과는 acqSurcharge 참조.
  acquisitionBase: seed(
    {
      under6: 1.0, // 6억 이하 1%
      // 6억~9억: (가액억 × 2/3 − 3)% (1~3% 누진) — 엔진에서 계산
      over9: 3.0, // 9억 초과 3%
      eduTaxRateOfAcq: 0.1, // 지방교육세 = 취득세율의 10%
      ruralTaxOver85: 0.2, // 농특세(85㎡ 초과) 0.2%p
    },
    "지방세법 주택 취득세율",
  ),
  // 다주택·조정지역 중과 취득세율(%)
  acqSurcharge: seed(
    {
      regulated2: 8, // 조정 2주택
      regulated3plus: 12, // 조정 3주택+
      nonReg3: 8, // 비조정 3주택
      nonReg4plus: 12, // 비조정 4주택+
    },
    "지방세법 다주택 취득세 중과",
  ),
} as const;

export interface BrokerBand {
  upToManwon: number;
  ratePct: number;
  capManwon: number | null;
}

// 평 ↔ ㎡
export const PYEONG_TO_M2 = 3.305785;

// 추출 시점 RAG 갱신 대상 키 (다음 단계에서 최신값으로 덮어씀)
export const RULE_REFRESH_KEYS = [
  "dsrLimitPct",
  "stressAddRatePct",
  "ltv",
  "jeonseWolseConvCapPct",
  "acquisitionBase",
  "acqSurcharge",
] as const;

// ── 면책 / 신뢰 문구 ──
export const LEGAL_DISCLAIMER =
  "본 분석은 입력값과 공개된 일반 기준에 근거한 참고용 추정이며, 법적·세무적 효력이 없습니다. " +
  "세율·요율·규제·시세는 시점과 개별 사정(주택 수·세대·지역·특례)에 따라 달라질 수 있으므로, " +
  "실제 계약·대출·납세 전에 반드시 공인중개사·세무사·금융기관에 최신 사항을 확인하시기 바랍니다. " +
  "본 서비스는 분석 결과에 따른 의사결정 및 그 결과에 대해 책임지지 않습니다.";

export const RULE_REFRESH_NOTE =
  "정책값(LTV·DSR·취득세율·전환율 등)은 추출 시점 기준 최신 자료로 갱신되어야 하며, 각 값에 기준일이 표기됩니다.";
