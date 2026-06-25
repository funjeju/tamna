"use client";
// TamnaIndex — 독립 부동산 계산기 (매물 없이 직접 입력). DecisionPanel(엔진)을 재사용.
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { REGION_NAMES } from "@/lib/regions";
import { PROPERTY_TYPES } from "@/lib/types";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DecisionPanel } from "./DecisionPanel";

type Deal = "매매" | "전세" | "월세";

export function CalculatorTool() {
  const [dealType, setDealType] = useState<Deal>("매매");
  const [region, setRegion] = useState<string>(REGION_NAMES[0]);
  const [propertyType, setPropertyType] = useState<string>("아파트");
  const [price, setPrice] = useState(30000); // 매매가/보증금 (만원)
  const [monthly, setMonthly] = useState(50); // 월세 (만원)
  const [pyeong, setPyeong] = useState(24);

  const isRent = dealType !== "매매";

  const listing = useMemo(
    () =>
      ({
        id: "calc",
        videoId: "",
        videoUrl: "",
        thumbnailUrl: "",
        sourceUrl: "",
        title: `${region} ${propertyType} ${dealType}`,
        channelId: "",
        publishedAt: new Date().toISOString(),
        collectedAt: new Date().toISOString(),
        propertyType,
        dealType,
        priceText: "",
        priceManwon: price,
        monthlyRentManwon: dealType === "월세" ? monthly : null,
        priceHistory: [],
        areaM2: pyeong ? Math.round(pyeong * 3.305785 * 100) / 100 : null,
        areaPyeong: pyeong || null,
        zoning: null,
        addressText: region,
        region,
        lat: 0,
        lng: 0,
        geohash: null,
        summary: "",
        highlights: [],
        keywords: [],
        themes: [],
        extractionSource: "ai",
        confidence: 1,
        status: "published",
        reviewedBy: null,
        publishedAt2: null,
        takedownAt: null,
        createdAt: "",
        updatedAt: "",
      }) as unknown as Listing,
    [region, propertyType, dealType, price, monthly, pyeong],
  );

  return (
    <div className="space-y-4">
      {/* 매물 정보 직접 입력 */}
      <div className="rounded-xl border border-stone/50 bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold text-basalt">매물 정보</h2>

        {/* 거래유형 */}
        <div className="mb-3 inline-flex rounded-full border border-stone/50 bg-paper/60 p-0.5">
          {(["매매", "전세", "월세"] as Deal[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDealType(d)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition",
                dealType === d ? "bg-sea text-sea-foreground" : "text-muted-foreground hover:text-basalt",
              )}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Field label="지역">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="h-9 w-full rounded-md border border-stone/60 bg-background px-2 text-sm"
            >
              {REGION_NAMES.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Field>
          <Field label="유형">
            <select
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value)}
              className="h-9 w-full rounded-md border border-stone/60 bg-background px-2 text-sm"
            >
              {(PROPERTY_TYPES as string[]).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </Field>
          <Field label={isRent ? "보증금(만원)" : "매매가(만원)"}>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value) || 0)} className="h-9 font-mono text-sm" />
          </Field>
          {dealType === "월세" && (
            <Field label="월세(만원)">
              <Input type="number" value={monthly} onChange={(e) => setMonthly(Number(e.target.value) || 0)} className="h-9 font-mono text-sm" />
            </Field>
          )}
          <Field label="면적(평)">
            <Input type="number" value={pyeong} onChange={(e) => setPyeong(Number(e.target.value) || 0)} className="h-9 font-mono text-sm" />
          </Field>
        </div>
      </div>

      {/* 자금·세금 분석 (엔진 재사용, 기본 펼침) */}
      <DecisionPanel key={dealType} listing={listing} defaultOpen />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export default CalculatorTool;
