"use client";
// TamnaIndex — 자금·세금 분석 패널 (참고용). 매물값 자동 + 사람정보 입력 → 즉시 연쇄계산.
// 숫자는 전부 결정론 엔진(src/lib/decision/engine)이 계산. 외부 API 없음.
import { useMemo, useState } from "react";
import { Calculator, Info, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/public/format";
import { listingToDeal } from "@/lib/decision/adapter";
import { contextForRegion } from "@/lib/decision/autofill";
import { RULES, LEGAL_DISCLAIMER } from "@/lib/decision/rules";
import {
  maxAffordablePrice,
  maxLoanByLtv,
  loanPayment,
  annualDebtService,
  dsrPct,
  acquisitionTax,
  brokerFee,
  settlement,
  rentTransactionAmount,
  convertedDeposit,
} from "@/lib/decision/engine";
import type { LoanType } from "@/lib/decision/types";
import { cn } from "@/lib/utils";

// 만원 → "3억 2,000만" 식 표기
function won(manwon: number): string {
  return formatPrice(Math.round(manwon));
}

const POLICY_ASOF = RULES.ltv.nonRegulated.asOf;

export function DecisionPanel({ listing }: { listing: Listing }) {
  const [open, setOpen] = useState(false);
  const deal = useMemo(() => listingToDeal(listing), [listing]);
  const isRent = deal.purpose === "rent";

  // 사람 입력 (만원/년/%)
  const [income, setIncome] = useState(5000);
  const [cash, setCash] = useState(10000);
  const [houseCount, setHouseCount] = useState(1);
  const [rate, setRate] = useState(4.5);
  const [term, setTerm] = useState(30);
  const [loanType, setLoanType] = useState<LoanType>("equal_payment");

  const ctx = useMemo(() => contextForRegion(listing.region), [listing.region]);

  const buy = useMemo(() => {
    if (isRent) return null;
    const price = deal.property.priceManwon ?? 0;
    if (price <= 0) return null;
    const months = term * 12;
    const area85over = (listing.areaM2 ?? 0) > 85;

    // 역산 — 내 자금으로 가능한 매매가 상한
    const afford = maxAffordablePrice({
      annualIncomeManwon: income,
      cashOnHandManwon: cash,
      ltvCapPct: ctx.ltvCapPct,
      dsrLimitPct: ctx.dsrLimitPct,
      loanRateAnnualPct: rate,
      stressAddRatePct: ctx.stressAddRatePct,
      loanTermYears: term,
    });

    // 이 매물 기준 — 실행 대출 = min(필요대출, LTV한도, DSR한도)
    const needLoan = Math.max(0, price - cash);
    const ltvLoan = maxLoanByLtv(price, ctx.ltvCapPct);
    const loan = Math.max(0, Math.min(needLoan, ltvLoan, afford.loanByDsrManwon));
    const pay = loanPayment(loanType, loan, rate, months);
    const dsr = dsrPct(annualDebtService(loan, rate + ctx.stressAddRatePct, months), income);
    const acq = acquisitionTax(price, { houseCount, regulated: ctx.regulated, area85over });
    const fee = brokerFee(price, RULES.brokerFeeSale.value);
    const settle = settlement({
      priceManwon: price,
      loanManwon: loan,
      acqTotalManwon: acq.totalManwon,
      brokerFeeManwon: fee.feeManwon,
    });
    return {
      price,
      affordable: price <= afford.maxPriceManwon,
      afford,
      loan,
      monthly: pay.monthlyFirstManwon,
      dsr,
      acq,
      fee,
      cashNeeded: settle.totalCashNeededManwon,
    };
  }, [isRent, deal.property.priceManwon, term, listing.areaM2, income, cash, ctx, rate, loanType, houseCount]);

  const rent = useMemo(() => {
    if (!isRent) return null;
    const deposit = deal.property.depositManwon ?? 0;
    const monthly = deal.property.monthlyRentManwon ?? 0;
    const txAmount = rentTransactionAmount(deposit, monthly);
    const fee = brokerFee(txAmount, RULES.brokerFeeRent.value);
    return {
      deposit,
      monthly,
      converted: convertedDeposit(deposit, monthly),
      fee,
    };
  }, [isRent, deal.property.depositManwon, deal.property.monthlyRentManwon]);

  return (
    <section className="rounded-xl border border-stone/50 bg-paper/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Calculator className="size-4 text-sea" />
        <span className="text-sm font-semibold text-basalt">자금·세금 분석</span>
        <Badge variant="outline" className="border-stone/50 text-[10px] text-muted-foreground">참고용</Badge>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-stone/40 p-4">
          {/* 입력 */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <NumInput label="연소득(만원)" value={income} onChange={setIncome} />
            <NumInput label="보유현금(만원)" value={cash} onChange={setCash} />
            {!isRent && <NumInput label="보유 주택수" value={houseCount} onChange={setHouseCount} />}
            {!isRent && <NumInput label="대출금리(%)" value={rate} onChange={setRate} step={0.1} />}
            {!isRent && <NumInput label="만기(년)" value={term} onChange={setTerm} />}
            {!isRent && (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-muted-foreground">상환방식</span>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value as LoanType)}
                  className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm"
                >
                  <option value="equal_payment">원리금균등</option>
                  <option value="equal_principal">원금균등</option>
                  <option value="bullet">만기일시</option>
                </select>
              </label>
            )}
          </div>

          {/* 결과 — 매매 */}
          {buy && (
            <div className="space-y-2">
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg border px-3 py-2 text-sm",
                  buy.affordable
                    ? "border-sea/40 bg-sea/5 text-sea"
                    : "border-tangerine/40 bg-tangerine/5 text-tangerine",
                )}
              >
                <span className="font-medium">
                  {buy.affordable ? "내 자금으로 가능" : "자금 한도 초과"}
                </span>
                <span className="text-xs">
                  가능 매매가 ~{won(buy.afford.maxPriceManwon)} · 한도:{" "}
                  {buy.afford.limitedBy === "dsr" ? "DSR(소득)" : "현금/LTV"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="가능 대출(LTV)" value={won(buy.loan)} />
                <Stat label="월 상환" value={won(buy.monthly)} />
                <Stat label="DSR" value={`${buy.dsr}%`} warn={buy.dsr > ctx.dsrLimitPct} />
                <Stat label="취득세 등" value={won(buy.acq.totalManwon)} sub={`세율 ${buy.acq.acqRatePct}%${buy.acq.surcharged ? " 중과" : ""}`} />
                <Stat label="중개보수" value={won(buy.fee.feeManwon)} sub={`${buy.fee.ratePct}%`} />
                <Stat label="필요현금(대출 외)" value={won(buy.cashNeeded)} highlight />
              </div>
            </div>
          )}

          {/* 결과 — 전월세 */}
          {rent && (
            <div className="grid grid-cols-2 gap-2">
              <Stat label="보증금" value={won(rent.deposit)} />
              <Stat label="월세" value={rent.monthly ? `${rent.monthly.toLocaleString()}만원` : "—"} />
              <Stat label="환산보증금" value={won(rent.converted)} sub="보증금+월세×100" />
              <Stat label="중개보수(상한)" value={won(rent.fee.feeManwon)} sub={`${rent.fee.ratePct}%`} />
            </div>
          )}

          {/* 신뢰 배지 + 면책 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="border-stone/50 text-[10px] text-muted-foreground">
              <Info className="size-2.5" /> 정책 기준 {POLICY_ASOF} · 확인필요
            </Badge>
            <Badge variant="outline" className="border-stone/50 text-[10px] text-muted-foreground">
              지역: {ctx.regulated ? "규제" : "비규제"} · LTV {ctx.ltvCapPct}% · DSR {ctx.dsrLimitPct}%
            </Badge>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground/80">{LEGAL_DISCLAIMER}</p>
        </div>
      )}
    </section>
  );
}

function NumInput({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className="h-9 font-mono text-sm"
      />
    </label>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", highlight ? "border-sea/40 bg-sea/5" : "border-stone/40 bg-background")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono text-sm font-bold", warn ? "text-tangerine" : "text-basalt")}>{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default DecisionPanel;
