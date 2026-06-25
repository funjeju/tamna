// TamnaIndex 결정 레이어 — 단일 거래객체(상태의 단일 출처)
// 금액 단위는 전부 '만원'(기존 priceManwon과 동일)으로 통일.

export type DealPurpose = "buy" | "sell" | "rent" | "invest";
export type LoanType = "equal_payment" | "equal_principal" | "bullet"; // 원리금균등 / 원금균등 / 만기일시

// 자동입력 값에 항상 붙는 메타 (출처·기준일·수정가능)
export type Source = "rule" | "region" | "api" | "user" | "partner";
export interface Field<T> {
  value: T;
  source: Source;
  asOf?: string; // 기준일 ISO (정책/시세값)
  editable: boolean;
  applied: boolean; // 추출/자동값이 사용자 검수 후 반영됐는지
  note?: string;
}

export interface DealProperty {
  address?: string;
  region?: string;
  propertyType?: string; // 단독주택/아파트/토지...
  dealType?: string; // 매매/전세/월세/반전세...
  areaM2?: number | null;
  areaPyeong?: number | null;
  zoning?: string | null;
  lat?: number;
  lng?: number;
  // 금액(만원)
  priceManwon?: number; // 매매가 (매매/매도/투자)
  depositManwon?: number; // 보증금 (전월세)
  monthlyRentManwon?: number; // 월세
  // 자동입력(공공데이터) 계층 — Phase A에서 채움
  gongsiPriceManwon?: number | null; // 공시가격(보유세 과표)
  lawdCd?: string | null; // 법정동코드 (Phase A 연동 키)
}

// '사람' 정보 — 매물에서 못 오는 값, 사용자 입력
export interface DealPerson {
  annualIncomeManwon?: number; // 연소득
  cashOnHandManwon?: number; // 보유현금
  houseCount?: number; // 보유 주택수
  householdMembers?: number; // 세대원 수
  existingLoanMonthlyManwon?: number; // 기타대출 월상환(원리금, 만원)
  // 대출 가정
  loanRateAnnualPct?: number; // 대출금리(연 %)
  loanTermYears?: number; // 대출 만기(년)
  loanType?: LoanType;
}

export interface DealTiming {
  contractDate?: string; // 계약일
  balanceDate?: string; // 잔금일
  transferDate?: string; // 양도일 (중과 유예 등 시점 분기 근거)
}

// 지역 규제 컨텍스트 (자동입력: region → rule)
export interface DealContext {
  regulated?: boolean; // 조정대상지역 등
  ltvCapPct?: number; // LTV 상한
  stressAddRatePct?: number; // 스트레스 DSR 가산금리
}

export interface Deal {
  purpose: DealPurpose;
  property: DealProperty;
  person: DealPerson;
  timing: DealTiming;
  context: DealContext;
}

export function emptyDeal(purpose: DealPurpose = "buy"): Deal {
  return { purpose, property: {}, person: {}, timing: {}, context: {} };
}
