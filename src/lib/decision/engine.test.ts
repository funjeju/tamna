// 결정 엔진 골든케이스 — `npx tsx src/lib/decision/engine.test.ts`
import {
  loanEqualPayment, loanEqualPrincipal, loanBullet,
  ltvPct, maxLoanByLtv, dsrPct,
  brokerFee, convertedDeposit, jeonseToWolse, wolseToJeonse,
  rentalYieldSimplePct, gapCashNeeded, pyeongToM2, m2ToPyeong,
  acquisitionTax, maxAffordablePrice, settlement,
} from "./engine";
import { RULES } from "./rules";

let pass = 0, fail = 0;
function eq(actual: number, expected: number, label: string) {
  if (actual === expected) { pass++; }
  else { fail++; console.log(`✗ ${label}: ${actual} !== ${expected}`); }
}
function approx(actual: number, expected: number, tol: number, label: string) {
  if (Math.abs(actual - expected) <= tol) { pass++; }
  else { fail++; console.log(`✗ ${label}: ${actual} ~!= ${expected} (±${tol})`); }
}
function is(cond: boolean, label: string) {
  if (cond) pass++; else { fail++; console.log(`✗ ${label}`); }
}

// 대출 (1억=10000만원, 5%, 360개월)
eq(loanEqualPayment(10000, 5, 360).monthlyFirstManwon, 54, "원리금균등 월상환");
eq(loanEqualPrincipal(10000, 5, 360).monthlyFirstManwon, 69, "원금균등 첫달");
approx(loanEqualPrincipal(10000, 5, 360).totalInterestManwon, 7521, 2, "원금균등 총이자");
eq(loanBullet(10000, 5, 360).monthlyFirstManwon, 42, "만기일시 월이자");
eq(loanBullet(10000, 5, 360).totalInterestManwon, 15000, "만기일시 총이자");

// LTV / DSR
eq(ltvPct(7000, 10000), 70, "LTV%");
eq(maxLoanByLtv(10000, 70), 7000, "LTV 최대대출");
eq(dsrPct(2000, 5000), 40, "DSR%");

// 중개보수
eq(brokerFee(50000, RULES.brokerFeeSale.value).feeManwon, 200, "매매 중개보수 5억");
eq(brokerFee(4000, RULES.brokerFeeSale.value).feeManwon, 24, "매매 중개보수 4천(상한)");

// 전월세
eq(convertedDeposit(1000, 50), 6000, "환산보증금");
approx(jeonseToWolse(30000, 20000, 5.5).monthlyRentManwon, 45.8, 0.1, "전세→월세");
approx(wolseToJeonse(1000, 50, 5.5), 11909, 2, "월세→전세");

// 수익률 / 갭
eq(rentalYieldSimplePct(50, 30000), 2, "단순수익률%");
eq(gapCashNeeded(50000, 40000), 10000, "갭 필요현금");

// 면적
approx(pyeongToM2(30), 99.17, 0.01, "평→㎡");
approx(m2ToPyeong(99.17), 30, 0.01, "㎡→평");

// 취득세
{
  const t = acquisitionTax(50000, { houseCount: 1, regulated: false, area85over: false });
  eq(t.acqRatePct, 1, "취득세율 5억");
  eq(t.totalManwon, 550, "취득세 총액 5억(교육세 포함)");
}
{
  const t = acquisitionTax(70000, { houseCount: 1, regulated: false, area85over: false });
  approx(t.acqRatePct, 1.66667, 0.001, "취득세율 7억 누진");
}
{
  const t = acquisitionTax(50000, { houseCount: 3, regulated: true, area85over: false });
  eq(t.acqRatePct, 12, "조정 3주택 중과 12%");
  is(t.surcharged, "중과 플래그");
}

// 역산
{
  const r = maxAffordablePrice({
    annualIncomeManwon: 5000, cashOnHandManwon: 20000, ltvCapPct: 70, dsrLimitPct: 40,
    loanRateAnnualPct: 5, stressAddRatePct: 1.5, loanTermYears: 30,
  });
  is(r.limitedBy === "dsr", "역산 한도사유=DSR");
  approx(r.maxPriceManwon, 46367, 500, "역산 가능 매매가");
  eq(r.maxLoanManwon, r.maxPriceManwon - 20000, "역산 대출=가격-현금");
}

// 잔금정산
{
  const s = settlement({ priceManwon: 50000, downPaymentManwon: 5000, loanManwon: 30000, acqTotalManwon: 550, brokerFeeManwon: 200 });
  eq(s.balanceManwon, 15000, "잔금(대출 제외)");
  eq(s.totalCashNeededManwon, 20750, "총 필요현금");
}

console.log(`\n결과: ${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
