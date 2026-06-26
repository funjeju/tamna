"use client";
// TamnaIndex — 부동산 계산기 풀세트 + 가이드(의식의 흐름) 플로우
import { useMemo, useState } from "react";
import { ArrowRight, ArrowLeft, Wand2, Grid3x3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { REGION_NAMES } from "@/lib/regions";
import { PROPERTY_TYPES } from "@/lib/types";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/public/format";
import { cn } from "@/lib/utils";
import { DecisionPanel } from "./DecisionPanel";
import { RULES } from "@/lib/decision/rules";
import {
  loanPayment, maxAffordablePrice, acquisitionTax, brokerFee, rentTransactionAmount,
  jeonseToWolse, wolseToJeonse, rentalYieldSimplePct, pyeongToM2, m2ToPyeong,
} from "@/lib/decision/engine";
import type { LoanType } from "@/lib/decision/types";
import { capitalGainsTax, giftTax, propertyTax, rentIncreaseCap, purchaseExtraCosts, type GiftRelation, TAX_ASOF } from "@/lib/decision/engine-extra";

const won = (m: number) => formatPrice(Math.round(m));

// ── 입력/결과 프리미티브 ──
function Num({ label, value, onChange, step, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className="relative">
        <Input type="number" value={Number.isFinite(value) ? value : ""} step={step} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} className="h-9 font-mono text-sm" />
        {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}
function Sel({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}
function Seg<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { v: T; l: string }[] }) {
  return (
    <div className="inline-flex rounded-full border border-stone/50 bg-paper/60 p-0.5">
      {options.map((o) => (
        <button key={o.v} type="button" onClick={() => onChange(o.v)} className={cn("rounded-full px-3 py-1 text-xs font-medium transition", value === o.v ? "bg-sea text-sea-foreground" : "text-muted-foreground hover:text-basalt")}>{o.l}</button>
      ))}
    </div>
  );
}
function Out({ label, value, sub, big }: { label: string; value: string; sub?: string; big?: boolean }) {
  return (
    <div className={cn("rounded-lg border px-3 py-2", big ? "border-sea/40 bg-sea/5" : "border-stone/40 bg-background")}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("font-mono font-bold text-basalt", big ? "text-base" : "text-sm")}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
function CalcCard({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-stone/50 bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-basalt">{title}{note && <span className="ml-2 text-[10px] font-normal text-muted-foreground">{note}</span>}</h3>
      {children}
    </div>
  );
}
const InRow = ({ children }: { children: React.ReactNode }) => <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>;
const OutRow = ({ children }: { children: React.ReactNode }) => <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{children}</div>;

// ── 개별 계산기들 ──
function LoanCalc() {
  const [p, setP] = useState(30000); const [r, setR] = useState(4.5); const [y, setY] = useState(30); const [t, setT] = useState<LoanType>("equal_payment");
  const res = useMemo(() => loanPayment(t, p, r, y * 12), [t, p, r, y]);
  return <CalcCard title="주택담보대출 상환">
    <InRow>
      <Num label="대출원금(만원)" value={p} onChange={setP} /><Num label="금리(%)" value={r} onChange={setR} step={0.1} /><Num label="만기(년)" value={y} onChange={setY} />
      <label className="flex flex-col gap-1"><span className="text-[11px] text-muted-foreground">방식</span>
        <select value={t} onChange={(e) => setT(e.target.value as LoanType)} className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm"><option value="equal_payment">원리금균등</option><option value="equal_principal">원금균등</option><option value="bullet">만기일시</option></select></label>
    </InRow>
    <OutRow><Out label="첫달 상환" value={won(res.monthlyFirstManwon)} big /><Out label="마지막달" value={won(res.monthlyLastManwon)} /><Out label="총이자" value={won(res.totalInterestManwon)} /></OutRow>
  </CalcCard>;
}
function AffordCalc() {
  const [inc, setInc] = useState(5000); const [cash, setCash] = useState(10000); const [r, setR] = useState(4.5); const [y, setY] = useState(30);
  const res = useMemo(() => maxAffordablePrice({ annualIncomeManwon: inc, cashOnHandManwon: cash, ltvCapPct: RULES.ltv.nonRegulated.value, dsrLimitPct: RULES.dsrLimitPct.value, loanRateAnnualPct: r, stressAddRatePct: RULES.stressAddRatePct.value, loanTermYears: y }), [inc, cash, r, y]);
  return <CalcCard title="대출한도 · 가능 매매가 (역산)" note="비규제·DSR40·LTV70 기준">
    <InRow><Num label="연소득(만원)" value={inc} onChange={setInc} /><Num label="보유현금(만원)" value={cash} onChange={setCash} /><Num label="금리(%)" value={r} onChange={setR} step={0.1} /><Num label="만기(년)" value={y} onChange={setY} /></InRow>
    <OutRow><Out label="가능 매매가" value={won(res.maxPriceManwon)} big /><Out label="가능 대출" value={won(res.maxLoanManwon)} /><Out label="한도 사유" value={res.limitedBy === "dsr" ? "소득(DSR)" : "현금·LTV"} /></OutRow>
  </CalcCard>;
}
function AcqCalc() {
  const [price, setPrice] = useState(50000); const [hc, setHc] = useState(1); const [reg, setReg] = useState(false); const [big85, setBig85] = useState(false);
  const res = useMemo(() => acquisitionTax(price, { houseCount: hc, regulated: reg, area85over: big85 }), [price, hc, reg, big85]);
  return <CalcCard title="취득세">
    <InRow>
      <Num label="매매가(만원)" value={price} onChange={setPrice} /><Num label="보유 주택수" value={hc} onChange={setHc} />
      <label className="flex items-center gap-1.5 self-end text-xs"><input type="checkbox" checked={reg} onChange={(e) => setReg(e.target.checked)} />조정지역</label>
      <label className="flex items-center gap-1.5 self-end text-xs"><input type="checkbox" checked={big85} onChange={(e) => setBig85(e.target.checked)} />85㎡ 초과</label>
    </InRow>
    <OutRow><Out label="취득세 합계" value={won(res.totalManwon)} big sub={`세율 ${res.acqRatePct}%${res.surcharged ? " 중과" : ""}`} /><Out label="지방교육세" value={won(res.eduManwon)} /><Out label="농특세" value={won(res.ruralManwon)} /></OutRow>
  </CalcCard>;
}
function CgtCalc() {
  const [acq, setAcq] = useState(30000); const [trf, setTrf] = useState(50000); const [exp, setExp] = useState(0); const [yr, setYr] = useState(5);
  const res = useMemo(() => capitalGainsTax({ acquireManwon: acq, transferManwon: trf, expenseManwon: exp, holdYears: yr }), [acq, trf, exp, yr]);
  return <CalcCard title="양도소득세" note="간이·참고용">
    <InRow><Num label="취득가(만원)" value={acq} onChange={setAcq} /><Num label="양도가(만원)" value={trf} onChange={setTrf} /><Num label="필요경비(만원)" value={exp} onChange={setExp} /><Num label="보유기간(년)" value={yr} onChange={setYr} /></InRow>
    <OutRow><Out label="양도세 합계" value={won(res.totalManwon)} big /><Out label="양도차익" value={won(res.gainManwon)} /><Out label="장기보유공제" value={won(res.ltsdManwon)} /></OutRow>
  </CalcCard>;
}
function GiftCalc() {
  const [amt, setAmt] = useState(20000); const [rel, setRel] = useState<GiftRelation>("lineal");
  const res = useMemo(() => giftTax(amt, rel), [amt, rel]);
  return <CalcCard title="증여세" note="간이·참고용">
    <InRow><Num label="증여재산(만원)" value={amt} onChange={setAmt} />
      <label className="flex flex-col gap-1"><span className="text-[11px] text-muted-foreground">관계</span>
        <select value={rel} onChange={(e) => setRel(e.target.value as GiftRelation)} className="h-9 rounded-md border border-stone/60 bg-background px-2 text-sm"><option value="lineal">성년 직계</option><option value="minor">미성년 직계</option><option value="spouse">배우자</option><option value="other">기타친족</option></select></label>
    </InRow>
    <OutRow><Out label="증여세" value={won(res.taxManwon)} big sub={`세율 ${res.ratePct}%`} /><Out label="과세표준" value={won(res.taxableManwon)} /><Out label="공제" value={won(res.deductManwon)} /></OutRow>
  </CalcCard>;
}
function PropTaxCalc() {
  const [g, setG] = useState(60000);
  const res = useMemo(() => propertyTax(g), [g]);
  return <CalcCard title="재산세 (주택)" note="간이·공정비율60%">
    <InRow><Num label="공시가격(만원)" value={g} onChange={setG} /></InRow>
    <OutRow><Out label="재산세" value={won(res.taxManwon)} big sub={`세율 ${res.ratePct}%`} /><Out label="과세표준" value={won(res.baseManwon)} /></OutRow>
  </CalcCard>;
}
function BrokerCalc() {
  const [mode, setMode] = useState<"매매" | "임대">("매매"); const [amt, setAmt] = useState(50000); const [monthly, setMonthly] = useState(0);
  const res = useMemo(() => {
    if (mode === "매매") return brokerFee(amt, RULES.brokerFeeSale.value);
    return brokerFee(rentTransactionAmount(amt, monthly), RULES.brokerFeeRent.value);
  }, [mode, amt, monthly]);
  return <CalcCard title="중개보수 (복비)" note="상한·협의가능">
    <div className="mb-2"><Seg value={mode} onChange={setMode} options={[{ v: "매매", l: "매매" }, { v: "임대", l: "전월세" }]} /></div>
    <InRow><Num label={mode === "매매" ? "매매가(만원)" : "보증금(만원)"} value={amt} onChange={setAmt} />{mode === "임대" && <Num label="월세(만원)" value={monthly} onChange={setMonthly} />}</InRow>
    <OutRow><Out label="중개보수(상한)" value={won(res.feeManwon)} big sub={`요율 ${res.ratePct}%`} /></OutRow>
  </CalcCard>;
}
function ConvertRentCalc() {
  const [dir, setDir] = useState<"j2w" | "w2j">("j2w"); const [jeonse, setJeonse] = useState(30000); const [newDep, setNewDep] = useState(20000); const [dep, setDep] = useState(1000); const [monthly, setMonthly] = useState(50);
  const rate = RULES.jeonseWolseConvCapPct.value;
  const res = useMemo(() => dir === "j2w" ? jeonseToWolse(jeonse, newDep, rate) : { jeonse: wolseToJeonse(dep, monthly, rate) }, [dir, jeonse, newDep, dep, monthly, rate]);
  return <CalcCard title="전월세 전환" note={`전환율 ${rate}%`}>
    <div className="mb-2"><Seg value={dir} onChange={setDir} options={[{ v: "j2w", l: "전세→월세" }, { v: "w2j", l: "월세→전세" }]} /></div>
    {dir === "j2w" ? <>
      <InRow><Num label="전세금(만원)" value={jeonse} onChange={setJeonse} /><Num label="새 보증금(만원)" value={newDep} onChange={setNewDep} /></InRow>
      <OutRow><Out label="월세" value={`${(res as { monthlyRentManwon: number }).monthlyRentManwon}만원`} big /></OutRow>
    </> : <>
      <InRow><Num label="보증금(만원)" value={dep} onChange={setDep} /><Num label="월세(만원)" value={monthly} onChange={setMonthly} /></InRow>
      <OutRow><Out label="환산 전세금" value={won((res as { jeonse: number }).jeonse)} big /></OutRow>
    </>}
  </CalcCard>;
}
function YieldCalc() {
  const [price, setPrice] = useState(50000); const [monthly, setMonthly] = useState(150);
  const res = useMemo(() => rentalYieldSimplePct(monthly, price), [monthly, price]);
  return <CalcCard title="임대수익률">
    <InRow><Num label="매매가(만원)" value={price} onChange={setPrice} /><Num label="월세(만원)" value={monthly} onChange={setMonthly} /></InRow>
    <OutRow><Out label="단순 수익률" value={`${res}%`} big sub="연월세 ÷ 매매가" /></OutRow>
  </CalcCard>;
}
function RentCapCalc() {
  const [d, setD] = useState(30000);
  const res = useMemo(() => rentIncreaseCap(d), [d]);
  return <CalcCard title="전월세 인상 상한 (5%)">
    <InRow><Num label="현 보증금/월세(만원)" value={d} onChange={setD} /></InRow>
    <OutRow><Out label="인상 상한" value={won(res.capManwon)} big /><Out label="인상폭" value={won(res.increaseManwon)} /></OutRow>
  </CalcCard>;
}
function AreaCalc() {
  const [dir, setDir] = useState<"p2m" | "m2p">("p2m"); const [v, setV] = useState(24);
  const res = useMemo(() => dir === "p2m" ? pyeongToM2(v) : m2ToPyeong(v), [dir, v]);
  return <CalcCard title="평 ↔ ㎡ 변환">
    <div className="mb-2"><Seg value={dir} onChange={setDir} options={[{ v: "p2m", l: "평→㎡" }, { v: "m2p", l: "㎡→평" }]} /></div>
    <InRow><Num label={dir === "p2m" ? "평" : "㎡"} value={v} onChange={setV} /></InRow>
    <OutRow><Out label={dir === "p2m" ? "㎡" : "평"} value={`${res}`} big /></OutRow>
  </CalcCard>;
}
function ExtraCostCalc() {
  const [price, setPrice] = useState(50000);
  const res = useMemo(() => purchaseExtraCosts(price), [price]);
  return <CalcCard title="매수 부대비용" note="간이 추정(취득세 별도)">
    <InRow><Num label="매매가(만원)" value={price} onChange={setPrice} /></InRow>
    <OutRow><Out label="부대비용 합" value={won(res.totalManwon)} big /><Out label="인지세" value={won(res.stampManwon)} /><Out label="채권할인" value={won(res.bondManwon)} /><Out label="법무비" value={won(res.judicialManwon)} /></OutRow>
  </CalcCard>;
}

const CATEGORIES: { cat: string; calcs: { id: string; Comp: () => React.JSX.Element }[] }[] = [
  { cat: "대출·자금", calcs: [{ id: "loan", Comp: LoanCalc }, { id: "afford", Comp: AffordCalc }, { id: "extra", Comp: ExtraCostCalc }] },
  { cat: "세금", calcs: [{ id: "acq", Comp: AcqCalc }, { id: "cgt", Comp: CgtCalc }, { id: "gift", Comp: GiftCalc }, { id: "prop", Comp: PropTaxCalc }] },
  { cat: "거래·임대", calcs: [{ id: "broker", Comp: BrokerCalc }, { id: "convert", Comp: ConvertRentCalc }, { id: "yield", Comp: YieldCalc }, { id: "rentcap", Comp: RentCapCalc }] },
  { cat: "변환", calcs: [{ id: "area", Comp: AreaCalc }] },
];

// ── 가이드(의식의 흐름) 위저드 ── 매물 입력을 단계로 안내 → 종합 분석(DecisionPanel)
function GuideWizard() {
  const [step, setStep] = useState(0);
  const [dealType, setDealType] = useState<"매매" | "전세" | "월세">("매매");
  const [region, setRegion] = useState(REGION_NAMES[0]);
  const [propertyType, setPropertyType] = useState("아파트");
  const [price, setPrice] = useState(30000);
  const [monthly, setMonthly] = useState(50);
  const [pyeong, setPyeong] = useState(24);

  const listing = useMemo(() => ({
    id: "guide", videoId: "", videoUrl: "", thumbnailUrl: "", sourceUrl: "", title: `${region} ${propertyType} ${dealType}`,
    channelId: "", publishedAt: new Date().toISOString(), collectedAt: new Date().toISOString(),
    propertyType, dealType, priceText: "", priceManwon: price, monthlyRentManwon: dealType === "월세" ? monthly : null,
    priceHistory: [], areaM2: pyeong ? Math.round(pyeong * 3.305785 * 100) / 100 : null, areaPyeong: pyeong || null,
    zoning: null, addressText: region, region, lat: 0, lng: 0, geohash: null, summary: "", highlights: [], keywords: [], themes: [],
    extractionSource: "ai", confidence: 1, status: "published", reviewedBy: null, publishedAt2: null, takedownAt: null, createdAt: "", updatedAt: "",
  } as unknown as Listing), [region, propertyType, dealType, price, monthly, pyeong]);

  const steps = ["거래 형태", "매물 정보", "종합 분석"];
  return (
    <div className="space-y-4">
      {/* 진행 표시 */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold", i <= step ? "bg-sea text-sea-foreground" : "bg-paper text-muted-foreground")}>{i + 1}</span>
            <span className={cn("text-xs", i === step ? "font-semibold text-basalt" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <ArrowRight className="size-3 text-stone" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <CalcCard title="무엇을 알아보시나요?">
          <Seg value={dealType} onChange={setDealType} options={[{ v: "매매", l: "매매(살까?)" }, { v: "전세", l: "전세" }, { v: "월세", l: "월세" }]} />
          <p className="mt-3 text-xs text-muted-foreground">선택에 따라 필요한 입력과 결과가 달라집니다.</p>
        </CalcCard>
      )}
      {step === 1 && (
        <CalcCard title="매물 정보를 알려주세요">
          <InRow>
            <Sel label="지역" value={region} onChange={setRegion} options={REGION_NAMES} />
            <Sel label="유형" value={propertyType} onChange={setPropertyType} options={PROPERTY_TYPES as string[]} />
            <Num label={dealType === "매매" ? "매매가(만원)" : "보증금(만원)"} value={price} onChange={setPrice} />
            {dealType === "월세" && <Num label="월세(만원)" value={monthly} onChange={setMonthly} />}
            <Num label="면적(평)" value={pyeong} onChange={setPyeong} />
          </InRow>
        </CalcCard>
      )}
      {step === 2 && (
        <div>
          <p className="mb-2 text-sm text-muted-foreground">소득·현금만 더 넣으면 가능 여부·대출·세금·필요현금이 한 번에 계산됩니다.</p>
          <DecisionPanel key={dealType + price} listing={listing} defaultOpen />
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}><ArrowLeft className="size-4" /> 이전</Button>
        {step < 2 ? <Button onClick={() => setStep((s) => s + 1)} className="bg-sea text-sea-foreground hover:bg-sea/90">다음 <ArrowRight className="size-4" /></Button> : <Button variant="outline" onClick={() => setStep(0)}>처음부터</Button>}
      </div>
    </div>
  );
}

// ── 메인 ──
export function CalculatorSuite() {
  const [mode, setMode] = useState<"guide" | "all">("guide");
  const [cat, setCat] = useState(CATEGORIES[0].cat);
  const active = CATEGORIES.find((c) => c.cat === cat) ?? CATEGORIES[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Seg value={mode} onChange={setMode} options={[{ v: "guide", l: "가이드(단계별)" }, { v: "all", l: "전체 계산기" }]} />
        <Badge variant="outline" className="border-stone/50 text-[10px] text-muted-foreground">정책·세율 기준 {TAX_ASOF}·확인필요</Badge>
      </div>

      {mode === "guide" ? (
        <div className="rounded-xl border border-sea/30 bg-sea/5 p-4">
          <div className="mb-3 flex items-center gap-1.5"><Wand2 className="size-4 text-sea" /><span className="text-sm font-semibold text-basalt">의식의 흐름대로 — 단계별 종합 분석</span></div>
          <GuideWizard />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c.cat} type="button" onClick={() => setCat(c.cat)} className={cn("inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition", cat === c.cat ? "border-transparent bg-sea text-sea-foreground" : "border-stone/50 text-muted-foreground hover:border-sea/40")}>
                <Grid3x3 className="size-3" />{c.cat}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {active.calcs.map(({ id, Comp }) => <Comp key={id} />)}
          </div>
        </>
      )}
    </div>
  );
}

export default CalculatorSuite;
