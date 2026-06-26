"use client";
// TamnaIndex — 계산기 허브: 상단 메뉴 + 가이드(의식의 흐름) + 카드(개별 페이지 링크)
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowLeft, Wand2, Grid3x3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGION_NAMES } from "@/lib/regions";
import { PROPERTY_TYPES } from "@/lib/types";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionPanel } from "./DecisionPanel";
import { Num, Sel, Seg } from "./CalculatorWidgets";
import { CALC_META, CALC_CATEGORIES } from "@/lib/calc-content";

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-stone/50 bg-card p-4">{children}</div>;
}

// ── 가이드(의식의 흐름) ──
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
      <div className="flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn("flex size-6 items-center justify-center rounded-full text-[11px] font-bold", i <= step ? "bg-sea text-sea-foreground" : "bg-paper text-muted-foreground")}>{i + 1}</span>
            <span className={cn("text-xs", i === step ? "font-semibold text-basalt" : "text-muted-foreground")}>{s}</span>
            {i < steps.length - 1 && <ArrowRight className="size-3 text-stone" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-basalt">무엇을 알아보시나요?</p>
          <Seg value={dealType} onChange={setDealType} options={[{ v: "매매", l: "매매(살까?)" }, { v: "전세", l: "전세" }, { v: "월세", l: "월세" }]} />
        </Card>
      )}
      {step === 1 && (
        <Card>
          <p className="mb-2 text-sm font-semibold text-basalt">매물 정보를 알려주세요</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Sel label="지역" value={region} onChange={setRegion} options={REGION_NAMES} />
            <Sel label="유형" value={propertyType} onChange={setPropertyType} options={PROPERTY_TYPES as string[]} />
            <Num label={dealType === "매매" ? "매매가(만원)" : "보증금(만원)"} value={price} onChange={setPrice} />
            {dealType === "월세" && <Num label="월세(만원)" value={monthly} onChange={setMonthly} />}
            <Num label="면적(평)" value={pyeong} onChange={setPyeong} />
          </div>
        </Card>
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

export function CalculatorSuite() {
  const [mode, setMode] = useState<"guide" | "all">("guide");
  return (
    <div className="space-y-4">
      <Seg value={mode} onChange={setMode} options={[{ v: "guide", l: "가이드(단계별)" }, { v: "all", l: "전체 계산기" }]} />

      {mode === "guide" ? (
        <div className="rounded-xl border border-sea/30 bg-sea/5 p-4">
          <div className="mb-3 flex items-center gap-1.5"><Wand2 className="size-4 text-sea" /><span className="text-sm font-semibold text-basalt">의식의 흐름대로 — 단계별 종합 분석</span></div>
          <GuideWizard />
        </div>
      ) : (
        <div className="space-y-5">
          {CALC_CATEGORIES.map((cat) => {
            const items = CALC_META.filter((c) => c.category === cat);
            if (items.length === 0) return null;
            return (
              <section key={cat}>
                <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-basalt"><Grid3x3 className="size-3.5 text-sea" />{cat}</h2>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map((c) => (
                    <Link key={c.slug} href={`/calculator/${c.slug}`} className="group flex flex-col rounded-xl border border-stone/50 bg-card p-3 transition hover:border-sea/50 hover:shadow-sm">
                      <span className="text-sm font-semibold text-basalt group-hover:text-sea">{c.label} 계산기</span>
                      <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{c.metaDescription}</span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CalculatorSuite;
