"use client";
// TamnaIndex — 계산기 위젯 모음 (법정요율 안내 + 수정 가능). 개별 페이지/허브에서 재사용.
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/public/format";
import { cn } from "@/lib/utils";
import { RULES } from "@/lib/decision/rules";
import {
  loanPayment, maxAffordablePrice, acquisitionTax, brokerFee, rentTransactionAmount,
  jeonseToWolse, wolseToJeonse, rentalYieldSimplePct, pyeongToM2, m2ToPyeong,
} from "@/lib/decision/engine";
import type { LoanType } from "@/lib/decision/types";
import { capitalGainsTax, giftTax, propertyTax, rentIncreaseCap, purchaseExtraCosts, type GiftRelation } from "@/lib/decision/engine-extra";

const won = (m: number) => formatPrice(Math.round(m));

export function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <Input type="number" value={Number.isFinite(value) ? value : ""} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="h-9 font-mono text-sm" />
    </label>
  );
}
// 법정요율 안내 + 수정 가능 입력 — 라벨의 '법정 N%'를 누르면 법정값으로 리셋
export function RateInput({ label, value, onChange, legal, step = 0.1, suffix = "%" }: { label: string; value: number; onChange: (n: number) => void; legal: number; step?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {label}
        <button type="button" onClick={() => onChange(legal)} className="rounded bg-sea/10 px-1.5 py-0.5 text-[10px] font-medium text-sea hover:bg-sea/20" title="법정/현행 값으로 설정">
          법정 {legal}{suffix}
        </button>
      </span>
      <Input type="number" value={Number.isFinite(value) ? value : ""} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="h-9 font-mono text-sm" />
    </label>
  );
}
export function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
export function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="inline-flex rounded-full border border-stone/50 bg-paper/60 p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", value === o.v ? "bg-sea text-sea-foreground" : "text-muted-foreground hover:text-basalt")}>{o.l}</button>
      ))}
    </div>
  );
}
export function Out({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", big ? "border-sea/40 bg-sea/5" : "border-stone/40 bg-background")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono font-bold text-basalt", big ? "text-base" : "text-sm")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
const InRow = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>;
const OutRow = ({ children }: { children: React.ReactNode }) => <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>;
const Wrap = ({ children }: { children: React.ReactNode }) => <div className="rounded-xl border border-stone/50 bg-card p-4">{children}</div>;

export function LoanCalc() {
  const [p, setP] = useState(30000); const [r, setR] = useState(4.5); const [y, setY] = useState(30); const [t, setT] = useState<LoanType>("equal_payment");
  const res = useMemo(() => loanPayment(t, p, r, y * 12), [t, p, r, y]);
  return <Wrap>
    <InRow>
      <Num label="대출원금(만원)" value={p} onChange={setP} /><Num label="금리(%)" value={r} onChange={setR} step={0.1} /><Num label="만기(년)" value={y} onChange={setY} />
      <label className="flex flex-col gap-1"><span className="text-[11px] text-muted-foreground">상환방식</span>
        <select value={t} onChange={(e) => setT(e.target.value as LoanType)} className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm"><option value="equal_payment">원리금균등</option><option value="equal_principal">원금균등</option><option value="bullet">만기일시</option></select></label>
    </InRow>
    <OutRow><Out label="첫달 상환" value={won(res.monthlyFirstManwon)} big /><Out label="마지막달" value={won(res.monthlyLastManwon)} /><Out label="총이자" value={won(res.totalInterestManwon)} /></OutRow>
  </Wrap>;
}
export function AffordCalc() {
  const [inc, setInc] = useState(5000); const [cash, setCash] = useState(10000); const [r, setR] = useState(4.5); const [y, setY] = useState(30);
  const [ltv, setLtv] = useState(RULES.ltv.nonRegulated.value); const [dsr, setDsr] = useState(RULES.dsrLimitPct.value); const [stress, setStress] = useState(RULES.stressAddRatePct.value);
  const res = useMemo(() => maxAffordablePrice({ annualIncomeManwon: inc, cashOnHandManwon: cash, ltvCapPct: ltv, dsrLimitPct: dsr, loanRateAnnualPct: r, stressAddRatePct: stress, loanTermYears: y }), [inc, cash, ltv, dsr, r, stress, y]);
  return <Wrap>
    <InRow><Num label="연소득(만원)" value={inc} onChange={setInc} /><Num label="보유현금(만원)" value={cash} onChange={setCash} /><Num label="금리(%)" value={r} onChange={setR} step={0.1} /><Num label="만기(년)" value={y} onChange={setY} />
      <RateInput label="LTV 상한" value={ltv} onChange={setLtv} legal={RULES.ltv.nonRegulated.value} step={1} />
      <RateInput label="DSR 한도" value={dsr} onChange={setDsr} legal={RULES.dsrLimitPct.value} step={1} />
      <RateInput label="스트레스 가산" value={stress} onChange={setStress} legal={RULES.stressAddRatePct.value} step={0.1} suffix="%p" />
    </InRow>
    <OutRow><Out label="가능 매매가" value={won(res.maxPriceManwon)} big /><Out label="가능 대출" value={won(res.maxLoanManwon)} /><Out label="한도 사유" value={res.limitedBy === "dsr" ? "소득(DSR)" : "현금·LTV"} /></OutRow>
  </Wrap>;
}
export function ExtraCostCalc() {
  const [price, setPrice] = useState(50000);
  const res = useMemo(() => purchaseExtraCosts(price), [price]);
  return <Wrap><InRow><Num label="매매가(만원)" value={price} onChange={setPrice} /></InRow>
    <OutRow><Out label="부대비용 합" value={won(res.totalManwon)} big /><Out label="인지세" value={won(res.stampManwon)} /><Out label="채권할인" value={won(res.bondManwon)} /><Out label="법무비" value={won(res.judicialManwon)} /></OutRow></Wrap>;
}
export function AcqCalc() {
  const [price, setPrice] = useState(50000); const [hc, setHc] = useState(1); const [reg, setReg] = useState(false); const [big85, setBig85] = useState(false);
  const res = useMemo(() => acquisitionTax(price, { houseCount: hc, regulated: reg, area85over: big85 }), [price, hc, reg, big85]);
  return <Wrap>
    <InRow><Num label="매매가(만원)" value={price} onChange={setPrice} /><Num label="보유 주택수" value={hc} onChange={setHc} />
      <label className="flex items-center gap-1.5 self-end text-xs"><input type="checkbox" checked={reg} onChange={(e) => setReg(e.target.checked)} />조정지역</label>
      <label className="flex items-center gap-1.5 self-end text-xs"><input type="checkbox" checked={big85} onChange={(e) => setBig85(e.target.checked)} />85㎡ 초과</label></InRow>
    <OutRow><Out label="취득세 합계" value={won(res.totalManwon)} big sub={`세율 ${res.acqRatePct}%${res.surcharged ? " 중과" : ""}`} /><Out label="지방교육세" value={won(res.eduManwon)} /><Out label="농특세" value={won(res.ruralManwon)} /></OutRow></Wrap>;
}
export function CgtCalc() {
  const [acq, setAcq] = useState(30000); const [trf, setTrf] = useState(50000); const [exp, setExp] = useState(0); const [yr, setYr] = useState(5);
  const res = useMemo(() => capitalGainsTax({ acquireManwon: acq, transferManwon: trf, expenseManwon: exp, holdYears: yr }), [acq, trf, exp, yr]);
  return <Wrap><InRow><Num label="취득가(만원)" value={acq} onChange={setAcq} /><Num label="양도가(만원)" value={trf} onChange={setTrf} /><Num label="필요경비(만원)" value={exp} onChange={setExp} /><Num label="보유기간(년)" value={yr} onChange={setYr} /></InRow>
    <OutRow><Out label="양도세 합계" value={won(res.totalManwon)} big /><Out label="양도차익" value={won(res.gainManwon)} /><Out label="장기보유공제" value={won(res.ltsdManwon)} /></OutRow></Wrap>;
}
export function GiftCalc() {
  const [amt, setAmt] = useState(20000); const [rel, setRel] = useState<GiftRelation>("lineal");
  const res = useMemo(() => giftTax(amt, rel), [amt, rel]);
  return <Wrap><InRow><Num label="증여재산(만원)" value={amt} onChange={setAmt} />
    <label className="flex flex-col gap-1"><span className="text-[11px] text-muted-foreground">관계</span>
      <select value={rel} onChange={(e) => setRel(e.target.value as GiftRelation)} className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm"><option value="lineal">성년 직계</option><option value="minor">미성년 직계</option><option value="spouse">배우자</option><option value="other">기타친족</option></select></label></InRow>
    <OutRow><Out label="증여세" value={won(res.taxManwon)} big sub={`세율 ${res.ratePct}%`} /><Out label="과세표준" value={won(res.taxableManwon)} /><Out label="공제" value={won(res.deductManwon)} /></OutRow></Wrap>;
}
export function PropTaxCalc() {
  const [g, setG] = useState(60000);
  const res = useMemo(() => propertyTax(g), [g]);
  return <Wrap><InRow><Num label="공시가격(만원)" value={g} onChange={setG} /></InRow>
    <OutRow><Out label="재산세" value={won(res.taxManwon)} big sub={`세율 ${res.ratePct}%`} /><Out label="과세표준" value={won(res.baseManwon)} /></OutRow></Wrap>;
}
export function BrokerCalc() {
  const [mode, setMode] = useState<"매매" | "임대">("매매"); const [amt, setAmt] = useState(50000); const [monthly, setMonthly] = useState(0);
  const txAmount = mode === "매매" ? amt : rentTransactionAmount(amt, monthly);
  const legalBand = brokerFee(txAmount, mode === "매매" ? RULES.brokerFeeSale.value : RULES.brokerFeeRent.value);
  const [rate, setRate] = useState(legalBand.ratePct);
  const cap = mode === "매매"
    ? (RULES.brokerFeeSale.value.find((b) => txAmount < b.upToManwon)?.capManwon ?? null)
    : (RULES.brokerFeeRent.value.find((b) => txAmount < b.upToManwon)?.capManwon ?? null);
  let fee = txAmount * (rate / 100);
  if (cap != null) fee = Math.min(fee, cap);
  return <Wrap>
    <div className="mb-2"><Seg value={mode} onChange={setMode} options={[{ v: "매매", l: "매매" }, { v: "임대", l: "전월세" }]} /></div>
    <InRow><Num label={mode === "매매" ? "매매가(만원)" : "보증금(만원)"} value={amt} onChange={setAmt} />{mode === "임대" && <Num label="월세(만원)" value={monthly} onChange={setMonthly} />}
      <RateInput label="중개보수 요율" value={rate} onChange={setRate} legal={legalBand.ratePct} step={0.1} /></InRow>
    <OutRow><Out label="중개보수" value={won(Math.round(fee * 10) / 10)} big sub={cap != null ? `상한 ${cap}만 적용` : "협의 가능"} /></OutRow></Wrap>;
}
export function ConvertRentCalc() {
  const [dir, setDir] = useState<"j2w" | "w2j">("j2w"); const [jeonse, setJeonse] = useState(30000); const [newDep, setNewDep] = useState(20000); const [dep, setDep] = useState(1000); const [monthly, setMonthly] = useState(50);
  const [rate, setRate] = useState(RULES.jeonseWolseConvCapPct.value);
  const res = useMemo(() => dir === "j2w" ? jeonseToWolse(jeonse, newDep, rate) : { jeonse: wolseToJeonse(dep, monthly, rate) }, [dir, jeonse, newDep, dep, monthly, rate]);
  return <Wrap>
    <div className="mb-2"><Seg value={dir} onChange={setDir} options={[{ v: "j2w", l: "전세→월세" }, { v: "w2j", l: "월세→전세" }]} /></div>
    <InRow>
      {dir === "j2w" ? <><Num label="전세금(만원)" value={jeonse} onChange={setJeonse} /><Num label="새 보증금(만원)" value={newDep} onChange={setNewDep} /></> : <><Num label="보증금(만원)" value={dep} onChange={setDep} /><Num label="월세(만원)" value={monthly} onChange={setMonthly} /></>}
      <RateInput label="전월세 전환율" value={rate} onChange={setRate} legal={RULES.jeonseWolseConvCapPct.value} step={0.1} />
    </InRow>
    <OutRow>{dir === "j2w" ? <Out label="월세" value={`${(res as { monthlyRentManwon: number }).monthlyRentManwon}만원`} big /> : <Out label="환산 전세금" value={won((res as { jeonse: number }).jeonse)} big />}</OutRow></Wrap>;
}
export function YieldCalc() {
  const [price, setPrice] = useState(50000); const [monthly, setMonthly] = useState(150);
  const res = useMemo(() => rentalYieldSimplePct(monthly, price), [monthly, price]);
  return <Wrap><InRow><Num label="매매가(만원)" value={price} onChange={setPrice} /><Num label="월세(만원)" value={monthly} onChange={setMonthly} /></InRow>
    <OutRow><Out label="단순 수익률" value={`${res}%`} big sub="연월세 ÷ 매매가" /></OutRow></Wrap>;
}
export function RentCapCalc() {
  const [d, setD] = useState(30000); const [cap, setCap] = useState(5);
  const res = useMemo(() => rentIncreaseCap(d, cap), [d, cap]);
  return <Wrap><InRow><Num label="현 보증금/월세(만원)" value={d} onChange={setD} /><RateInput label="인상률 상한" value={cap} onChange={setCap} legal={5} step={0.5} /></InRow>
    <OutRow><Out label="인상 상한" value={won(res.capManwon)} big /><Out label="인상폭" value={won(res.increaseManwon)} /></OutRow></Wrap>;
}
export function AreaCalc() {
  const [dir, setDir] = useState<"p2m" | "m2p">("p2m"); const [v, setV] = useState(24);
  const res = useMemo(() => dir === "p2m" ? pyeongToM2(v) : m2ToPyeong(v), [dir, v]);
  return <Wrap><div className="mb-2"><Seg value={dir} onChange={setDir} options={[{ v: "p2m", l: "평→㎡" }, { v: "m2p", l: "㎡→평" }]} /></div>
    <InRow><Num label={dir === "p2m" ? "평" : "㎡"} value={v} onChange={setV} /></InRow>
    <OutRow><Out label={dir === "p2m" ? "㎡" : "평"} value={`${res}`} big /></OutRow></Wrap>;
}

export const WIDGETS: Record<string, () => React.JSX.Element> = {
  loan: LoanCalc, afford: AffordCalc, extra: ExtraCostCalc,
  acquisition: AcqCalc, "capital-gains": CgtCalc, gift: GiftCalc, property: PropTaxCalc,
  broker: BrokerCalc, "jeonse-wolse": ConvertRentCalc, yield: YieldCalc, "rent-cap": RentCapCalc, area: AreaCalc,
};
