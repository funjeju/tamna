"use client";
// TamnaIndex — 자금·세금 분석 패널 (참고용). 매물값 자동 + 사람정보 입력 → 즉시 연쇄계산.
// 숫자는 전부 결정론 엔진(src/lib/decision/engine)이 계산. 외부 API 없음.
import { useCallback, useMemo, useState } from "react";
import { Calculator, Info, ChevronDown, Sparkles, Loader2, Printer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Brief, BriefMetrics } from "@/lib/decision/brief";
import { buildReportHtml, type ReportData, type ReportRow } from "@/lib/decision/report";
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

  // AI 브리핑 (숫자→의미→행동) — 온디맨드, 서버 프록시 + 후검증
  const [brief, setBrief] = useState<(Brief & { ai?: boolean }) | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const fetchBrief = useCallback(async () => {
    const metrics: BriefMetrics = isRent
      ? {
          kind: "rent",
          region: listing.region,
          propertyType: listing.propertyType,
          feeRentRatePct: rent?.fee.ratePct,
        }
      : {
          kind: "buy",
          region: listing.region,
          propertyType: listing.propertyType,
          affordable: buy?.affordable,
          limitedBy: buy?.afford.limitedBy,
          dsr: buy?.dsr,
          dsrLimit: ctx.dsrLimitPct,
          acqRatePct: buy?.acq.acqRatePct,
          surcharged: buy?.acq.surcharged,
          feeRatePct: buy?.fee.ratePct,
          ltvCapPct: ctx.ltvCapPct,
        };
    setBriefLoading(true);
    try {
      const res = await fetch("/api/decision/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metrics),
      });
      const d = (await res.json()) as Brief & { ai?: boolean };
      setBrief(d);
      return d;
    } catch {
      setBrief(null);
      return null;
    } finally {
      setBriefLoading(false);
    }
  }, [isRent, listing.region, listing.propertyType, rent, buy, ctx]);

  // 자금계획서 출력 (인쇄 → Save as PDF). AI 종합이 없으면 먼저 불러옴.
  const [printing, setPrinting] = useState(false);
  const printReport = useCallback(async () => {
    setPrinting(true);
    const b = brief ?? (await fetchBrief());
    const inputs: ReportRow[] = isRent
      ? [
          { label: "연소득", value: won(income) },
          { label: "보유현금", value: won(cash) },
        ]
      : [
          { label: "연소득", value: won(income) },
          { label: "보유현금", value: won(cash) },
          { label: "보유 주택수", value: `${houseCount}채` },
          { label: "대출금리", value: `${rate}%` },
          { label: "만기", value: `${term}년` },
          {
            label: "상환방식",
            value: loanType === "equal_payment" ? "원리금균등" : loanType === "equal_principal" ? "원금균등" : "만기일시",
          },
        ];
    const results: ReportRow[] = buy
      ? [
          { label: "내 자금 가능 여부", value: buy.affordable ? "가능" : "한도 초과", sub: `한도: ${buy.afford.limitedBy === "dsr" ? "소득(DSR)" : "현금·LTV"}` },
          { label: "가능 매매가(역산)", value: won(buy.afford.maxPriceManwon) },
          { label: "가능 대출(LTV)", value: won(buy.loan) },
          { label: "월 상환액", value: won(buy.monthly) },
          { label: "DSR", value: `${buy.dsr}%`, sub: `한도 ${ctx.dsrLimitPct}%` },
          { label: "취득세 등", value: won(buy.acq.totalManwon), sub: `세율 ${buy.acq.acqRatePct}%${buy.acq.surcharged ? " 중과" : ""}` },
          { label: "중개보수(상한)", value: won(buy.fee.feeManwon) },
          { label: "필요현금(대출 외)", value: won(buy.cashNeeded) },
        ]
      : rent
        ? [
            { label: "보증금", value: won(rent.deposit) },
            { label: "월세", value: rent.monthly ? `${rent.monthly.toLocaleString()}만원` : "—" },
            { label: "환산보증금", value: won(rent.converted), sub: "보증금+월세×100" },
            { label: "중개보수(상한)", value: won(rent.fee.feeManwon) },
          ]
        : [];

    const data: ReportData = {
      title: isRent ? "임대 분석 보고서" : "자금계획서",
      createdAt: `${new Date().toLocaleDateString("ko-KR")} 작성`,
      listingTitle: listing.title,
      listingMeta: [listing.propertyType, listing.dealType, listing.region, listing.areaPyeong ? `${listing.areaPyeong}평` : ""]
        .filter(Boolean)
        .join(" · "),
      kind: isRent ? "rent" : "buy",
      inputs,
      results,
      contextLine: `지역 ${ctx.regulated ? "규제" : "비규제"} · LTV ${ctx.ltvCapPct}% · DSR ${ctx.dsrLimitPct}% · 정책기준 ${POLICY_ASOF}(확인필요)`,
      brief: b ? { summary: b.summary, points: b.points } : null,
      disclaimer: LEGAL_DISCLAIMER,
    };
    const w = window.open("", "_blank", "width=900,height=1000");
    if (w) {
      w.document.open();
      w.document.write(buildReportHtml(data));
      w.document.close();
    }
    setPrinting(false);
  }, [brief, fetchBrief, isRent, income, cash, houseCount, rate, term, loanType, buy, rent, ctx, listing]);

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

          {/* AI 해석 (숫자→의미→행동) */}
          <div className="rounded-lg border border-sea/30 bg-sea/5 p-3">
            {!brief ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={fetchBrief}
                disabled={briefLoading}
                className="w-full border-sea/40 text-sea hover:text-sea"
              >
                {briefLoading ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {briefLoading ? "분석 중…" : "AI 해석 보기"}
              </Button>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="size-3.5 text-sea" />
                  <span className="text-xs font-semibold text-basalt">AI 해석</span>
                  <Badge variant="outline" className="border-stone/50 text-[9px] text-muted-foreground">
                    {brief.ai ? "AI" : "기본 해석"}
                  </Badge>
                  <button type="button" onClick={fetchBrief} className="ml-auto text-[10px] text-muted-foreground hover:text-sea">
                    다시
                  </button>
                </div>
                <p className="text-[13px] leading-relaxed text-basalt">{brief.summary}</p>
                <ul className="space-y-1">
                  {brief.points?.map((p, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed">
                      <span
                        className={cn(
                          "mt-0.5 shrink-0 text-[10px] font-bold",
                          p.level === "good" ? "text-sea" : p.level === "warn" ? "text-tangerine" : "text-muted-foreground",
                        )}
                      >
                        {p.level === "good" ? "✓" : p.level === "warn" ? "⚠" : "·"}
                      </span>
                      <span className="text-basalt/90">{p.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 자금계획서 출력 */}
          <Button
            type="button"
            size="sm"
            onClick={printReport}
            disabled={printing || (!buy && !rent)}
            className="w-full bg-sea text-sea-foreground hover:bg-sea/90"
          >
            {printing ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            자금계획서 출력 (PDF)
          </Button>

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
