// TamnaIndex 결정 레이어 — 결정론 계산 엔진 (순수함수). 단위: 만원, %는 퍼센트 숫자.
// 같은 입력 → 항상 같은 출력. 외부 의존 없음. 정책값은 rules에서 주입.
import { RULES, PYEONG_TO_M2, type BrokerBand } from "./rules";
import type { LoanType } from "./types";

const round = (n: number, d = 0) => {
  const p = 10 ** d;
  return Math.round(n * p) / p;
};

// ── 면적 ──
export function pyeongToM2(pyeong: number): number {
  return round(pyeong * PYEONG_TO_M2, 2);
}
export function m2ToPyeong(m2: number): number {
  return round(m2 / PYEONG_TO_M2, 2);
}

// ── 대출 상환 ──
export interface LoanResult {
  monthlyFirstManwon: number; // 첫 달 상환(만원)
  monthlyLastManwon: number; // 마지막 달 상환(원금균등은 감소)
  totalInterestManwon: number;
  totalPaymentManwon: number;
}

// 원리금균등
export function loanEqualPayment(principalManwon: number, annualRatePct: number, months: number): LoanResult {
  if (months <= 0 || principalManwon <= 0) {
    return { monthlyFirstManwon: 0, monthlyLastManwon: 0, totalInterestManwon: 0, totalPaymentManwon: 0 };
  }
  const r = annualRatePct / 100 / 12;
  let monthly: number;
  if (r === 0) monthly = principalManwon / months;
  else monthly = (principalManwon * r * (1 + r) ** months) / ((1 + r) ** months - 1);
  const total = monthly * months;
  return {
    monthlyFirstManwon: round(monthly),
    monthlyLastManwon: round(monthly),
    totalInterestManwon: round(total - principalManwon),
    totalPaymentManwon: round(total),
  };
}

// 원금균등 (매월 원금 동일, 이자 감소)
export function loanEqualPrincipal(principalManwon: number, annualRatePct: number, months: number): LoanResult {
  if (months <= 0 || principalManwon <= 0) {
    return { monthlyFirstManwon: 0, monthlyLastManwon: 0, totalInterestManwon: 0, totalPaymentManwon: 0 };
  }
  const r = annualRatePct / 100 / 12;
  const principalPart = principalManwon / months;
  const first = principalPart + principalManwon * r; // 1회차 이자 최대
  const last = principalPart + principalPart * r; // 마지막 회차 이자 최소
  // 총이자 = r * 원금 * (months+1)/2
  const totalInterest = r * principalManwon * (months + 1) / 2;
  return {
    monthlyFirstManwon: round(first),
    monthlyLastManwon: round(last),
    totalInterestManwon: round(totalInterest),
    totalPaymentManwon: round(principalManwon + totalInterest),
  };
}

// 만기일시 (매월 이자만, 만기에 원금)
export function loanBullet(principalManwon: number, annualRatePct: number, months: number): LoanResult {
  if (months <= 0 || principalManwon <= 0) {
    return { monthlyFirstManwon: 0, monthlyLastManwon: 0, totalInterestManwon: 0, totalPaymentManwon: 0 };
  }
  const monthlyInterest = principalManwon * (annualRatePct / 100 / 12);
  const totalInterest = monthlyInterest * months;
  return {
    monthlyFirstManwon: round(monthlyInterest),
    monthlyLastManwon: round(monthlyInterest + principalManwon),
    totalInterestManwon: round(totalInterest),
    totalPaymentManwon: round(principalManwon + totalInterest),
  };
}

export function loanPayment(
  type: LoanType,
  principalManwon: number,
  annualRatePct: number,
  months: number,
): LoanResult {
  if (type === "equal_principal") return loanEqualPrincipal(principalManwon, annualRatePct, months);
  if (type === "bullet") return loanBullet(principalManwon, annualRatePct, months);
  return loanEqualPayment(principalManwon, annualRatePct, months);
}

// 연간 원리금상환액(만원) — DSR/DTI용 (균등상환 기준)
export function annualDebtService(principalManwon: number, annualRatePct: number, months: number): number {
  return round(loanEqualPayment(principalManwon, annualRatePct, months).monthlyFirstManwon * 12);
}

// ── LTV / DTI / DSR ──
export function ltvPct(loanManwon: number, collateralManwon: number): number {
  if (collateralManwon <= 0) return 0;
  return round((loanManwon / collateralManwon) * 100, 1);
}
export function maxLoanByLtv(collateralManwon: number, ltvCapPct: number): number {
  return round(collateralManwon * (ltvCapPct / 100));
}
// DSR(%) = (전체 대출 연원리금) / 연소득
export function dsrPct(annualDebtServiceManwon: number, annualIncomeManwon: number): number {
  if (annualIncomeManwon <= 0) return 0;
  return round((annualDebtServiceManwon / annualIncomeManwon) * 100, 1);
}
// DTI(%) = (주담대 연원리금 + 기타대출 연이자) / 연소득
export function dtiPct(mortgageAnnualManwon: number, otherAnnualInterestManwon: number, annualIncomeManwon: number): number {
  if (annualIncomeManwon <= 0) return 0;
  return round(((mortgageAnnualManwon + otherAnnualInterestManwon) / annualIncomeManwon) * 100, 1);
}

// ── 중개보수 ──
export function brokerFee(amountManwon: number, table: BrokerBand[]): { feeManwon: number; ratePct: number } {
  const band = table.find((b) => amountManwon < b.upToManwon) ?? table[table.length - 1];
  let fee = amountManwon * (band.ratePct / 100);
  if (band.capManwon != null) fee = Math.min(fee, band.capManwon);
  return { feeManwon: round(fee, 1), ratePct: band.ratePct };
}
// 임대차 거래금액 = 보증금 + 월세×100 (단, 5천만원 미만이면 월세×70)
export function rentTransactionAmount(depositManwon: number, monthlyRentManwon: number): number {
  const base = depositManwon + monthlyRentManwon * 100;
  if (base < 5000) return depositManwon + monthlyRentManwon * 70;
  return base;
}

// ── 전월세 전환 ──
export function convertedDeposit(depositManwon: number, monthlyRentManwon: number): number {
  return round(depositManwon + monthlyRentManwon * 100);
}
// 전세 → 월세: 보증금 일부를 월세로 (전환율 연%)
export function jeonseToWolse(jeonseManwon: number, newDepositManwon: number, convRatePct: number) {
  const monthly = ((jeonseManwon - newDepositManwon) * (convRatePct / 100)) / 12;
  return { depositManwon: newDepositManwon, monthlyRentManwon: round(Math.max(0, monthly), 1) };
}
// 월세 → 전세 환산
export function wolseToJeonse(depositManwon: number, monthlyRentManwon: number, convRatePct: number): number {
  if (convRatePct <= 0) return depositManwon;
  return round(depositManwon + (monthlyRentManwon * 12) / (convRatePct / 100));
}

// ── 수익률 / 갭 ──
// 단순수익률 = 연월세 / 매매가
export function rentalYieldSimplePct(monthlyRentManwon: number, priceManwon: number): number {
  if (priceManwon <= 0) return 0;
  return round(((monthlyRentManwon * 12) / priceManwon) * 100, 2);
}
// 실질수익률 = (연월세 − 연비용) / (매매가 − 보증금)  ※ 보증금 레버리지 반영
export function rentalYieldRealPct(
  monthlyRentManwon: number,
  priceManwon: number,
  depositManwon: number,
  annualCostManwon = 0,
): number {
  const invested = priceManwon - depositManwon;
  if (invested <= 0) return 0;
  return round(((monthlyRentManwon * 12 - annualCostManwon) / invested) * 100, 2);
}
// 갭투자 필요현금 = 매매가 − 전세보증금
export function gapCashNeeded(priceManwon: number, jeonseDepositManwon: number): number {
  return round(priceManwon - jeonseDepositManwon);
}

// ── 취득세 (주택 매매 기본형) ──
export interface AcqOptions {
  houseCount: number; // 취득 후 주택 수
  regulated: boolean; // 조정대상지역
  area85over: boolean; // 전용 85㎡ 초과(농특세)
}
export function acquisitionTax(priceManwon: number, opt: AcqOptions): {
  taxManwon: number;
  acqRatePct: number;
  eduManwon: number;
  ruralManwon: number;
  totalManwon: number;
  surcharged: boolean;
} {
  const base = RULES.acquisitionBase.value;
  const sur = RULES.acqSurcharge.value;
  let acqRate: number;
  let surcharged = false;

  // 다주택 중과 우선
  if (opt.regulated && opt.houseCount >= 3) { acqRate = sur.regulated3plus; surcharged = true; }
  else if (opt.regulated && opt.houseCount === 2) { acqRate = sur.regulated2; surcharged = true; }
  else if (!opt.regulated && opt.houseCount >= 4) { acqRate = sur.nonReg4plus; surcharged = true; }
  else if (!opt.regulated && opt.houseCount === 3) { acqRate = sur.nonReg3; surcharged = true; }
  else {
    // 일반 (1주택, 또는 비조정 2주택)
    const eok = priceManwon / 10000;
    if (eok <= 6) acqRate = base.under6;
    else if (eok <= 9) acqRate = round((eok * 2) / 3 - 3, 5); // 6~9억 누진 1~3%
    else acqRate = base.over9;
  }

  const acqTax = priceManwon * (acqRate / 100);
  const edu = acqTax * base.eduTaxRateOfAcq; // 지방교육세 = 취득세 × 10%
  const rural = opt.area85over ? priceManwon * (base.ruralTaxOver85 / 100) : 0; // 농특세
  return {
    taxManwon: round(acqTax),
    acqRatePct: acqRate,
    eduManwon: round(edu),
    ruralManwon: round(rural),
    totalManwon: round(acqTax + edu + rural),
    surcharged,
  };
}

// ── 역산: 월상환액 → 대출 원금 (원리금균등 역함수) ──
export function principalFromMonthly(monthlyManwon: number, annualRatePct: number, months: number): number {
  if (months <= 0 || monthlyManwon <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  if (r === 0) return round(monthlyManwon * months);
  return round((monthlyManwon * ((1 + r) ** months - 1)) / (r * (1 + r) ** months));
}

// ── 역산: 내 소득·현금·주택수 → 가능한 매매가 상한 + 한도 사유 ──
export interface AffordInput {
  annualIncomeManwon: number;
  cashOnHandManwon: number;
  ltvCapPct: number;
  dsrLimitPct: number;
  loanRateAnnualPct: number; // 실제 대출금리
  stressAddRatePct: number; // 스트레스 가산
  loanTermYears: number;
  existingLoanMonthlyManwon?: number; // 기타대출 월상환
}
export interface AffordResult {
  maxPriceManwon: number;
  maxLoanManwon: number;
  limitedBy: "cash_ltv" | "dsr"; // 무엇이 한도였나
  loanByDsrManwon: number;
  priceByCashLtvManwon: number;
}
export function maxAffordablePrice(i: AffordInput): AffordResult {
  const months = i.loanTermYears * 12;
  const stressRate = i.loanRateAnnualPct + i.stressAddRatePct;
  // DSR 한도 내 가능한 월 상환여력(스트레스금리 기준)
  const maxAnnualDS = i.annualIncomeManwon * (i.dsrLimitPct / 100) - (i.existingLoanMonthlyManwon ?? 0) * 12;
  const maxMonthly = Math.max(0, maxAnnualDS / 12);
  const loanByDsr = principalFromMonthly(maxMonthly, stressRate, months);
  // 현금/LTV 제약: price = cash + loan, loan ≤ price×ltv → price ≤ cash/(1−ltv)
  const ltv = i.ltvCapPct / 100;
  const priceByCashLtv = ltv >= 1 ? Infinity : round(i.cashOnHandManwon / (1 - ltv));
  const priceByDsr = round(i.cashOnHandManwon + loanByDsr);
  const maxPrice = Math.min(priceByCashLtv, priceByDsr);
  const limitedBy = priceByCashLtv <= priceByDsr ? "cash_ltv" : "dsr";
  return {
    maxPriceManwon: round(maxPrice),
    maxLoanManwon: round(maxPrice - i.cashOnHandManwon),
    limitedBy,
    loanByDsrManwon: round(loanByDsr),
    priceByCashLtvManwon: round(priceByCashLtv),
  };
}

// ── 잔금정산 / 필요현금 ──
export interface SettlementInput {
  priceManwon: number;
  downPaymentManwon?: number; // 계약금
  interimManwon?: number; // 중도금
  loanManwon?: number; // 대출 실행액
  acqTotalManwon?: number; // 취득세 등
  brokerFeeManwon?: number; // 중개보수
  etcManwon?: number; // 법무비 등
}
export function settlement(i: SettlementInput) {
  const down = i.downPaymentManwon ?? 0;
  const interim = i.interimManwon ?? 0;
  const loan = i.loanManwon ?? 0;
  const balance = round(i.priceManwon - down - interim - loan); // 잔금(대출 제외 자기부담)
  const cashTotal = round(
    down + interim + balance + (i.acqTotalManwon ?? 0) + (i.brokerFeeManwon ?? 0) + (i.etcManwon ?? 0),
  );
  return {
    balanceManwon: balance, // 잔금일 자기부담 잔금
    totalCashNeededManwon: cashTotal, // 대출 외 총 필요현금
    lines: [
      { label: "계약금", manwon: down },
      { label: "중도금", manwon: interim },
      { label: "잔금(대출 제외)", manwon: balance },
      { label: "취득세 등", manwon: round(i.acqTotalManwon ?? 0) },
      { label: "중개보수", manwon: round(i.brokerFeeManwon ?? 0) },
      { label: "기타(법무 등)", manwon: round(i.etcManwon ?? 0) },
    ],
  };
}
