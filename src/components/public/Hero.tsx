"use client";
// TamnaIndex — 홈 상단 히어로 (컴팩트) — 타이틀 + 통계 + 지역·가격 검색
import { useState } from "react";
import {
  Search,
  Map as MapIcon,
  Sparkles,
  TrendingUp,
  Radio,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JEJU_OUTLINE_PATH, REGION_NAMES } from "@/lib/regions";
import type { Theme, ListingFilters } from "@/lib/types";

interface HeroProps {
  onSearch: (q: string) => void;
  onFilterSearch: (partial: Partial<ListingFilters>) => void;
  onPickTheme: (t: Theme) => void;
  onOpenMap: () => void;
  publishedCount: number;
  todayCount: number;
  freshness: number;
}

// 가격대 옵션 (만원)
const PRICE_RANGES: { value: string; label: string; min?: number; max?: number }[] = [
  { value: "all", label: "가격 전체" },
  { value: "0-10000", label: "1억 이하", max: 10000 },
  { value: "10000-20000", label: "1억~2억", min: 10000, max: 20000 },
  { value: "20000-30000", label: "2억~3억", min: 20000, max: 30000 },
  { value: "30000-50000", label: "3억~5억", min: 30000, max: 50000 },
  { value: "50000-100000", label: "5억~10억", min: 50000, max: 100000 },
  { value: "100000-", label: "10억 이상", min: 100000 },
];

export function Hero({
  onFilterSearch,
  onOpenMap,
  publishedCount,
  todayCount,
  freshness,
}: HeroProps) {
  const [region, setRegion] = useState("all");
  const [price, setPrice] = useState("all");

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const partial: Partial<ListingFilters> = {};
    if (region !== "all") partial.regions = [region];
    const pr = PRICE_RANGES.find((p) => p.value === price);
    if (pr) {
      if (pr.min !== undefined) partial.priceMin = pr.min;
      if (pr.max !== undefined) partial.priceMax = pr.max;
    }
    onFilterSearch(partial);
  };

  return (
    <section className="jeju-grain relative overflow-hidden border-b border-stone/50 bg-gradient-to-br from-paper via-paper to-sea/8">
      {/* 우측 제주도 실루엣 장식 */}
      <svg
        viewBox="0 0 1000 620"
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 -right-10 hidden h-[460px] w-auto opacity-[0.18] md:block"
      >
        <path
          d={JEJU_OUTLINE_PATH}
          fill="none"
          stroke="#b9c2bd"
          strokeWidth="2"
        />
        <path
          d={JEJU_OUTLINE_PATH}
          fill="#176b6b"
          fillOpacity="0.08"
        />
      </svg>

      {/* sea 그라데이션 오버레이 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-sea/10 via-transparent to-tangerine/5"
      />

      <div className="relative mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
        {/* 타이틀 + 통계 (한 줄, 컴팩트) */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-xl font-bold tracking-tight text-basalt md:text-2xl">
            제주 매물, <span className="text-sea">한 장의 지도</span>로
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge className="border-transparent bg-sea/90 text-[11px] text-sea-foreground">
              <Radio className="size-3" aria-hidden="true" />
              게시 {publishedCount.toLocaleString("ko-KR")}
            </Badge>
            <Badge className="border-transparent bg-tangerine/90 text-[11px] text-tangerine-foreground">
              <Sparkles className="size-3" aria-hidden="true" />
              오늘 {todayCount.toLocaleString("ko-KR")}
            </Badge>
            <Badge variant="outline" className="border-stone/60 text-[11px] text-muted-jeju">
              <TrendingUp className="size-3" aria-hidden="true" />
              신선도 {freshness}%
            </Badge>
          </div>
        </div>

        {/* 검색바 (지역·가격·검색 + 지도) */}
        <form
          onSubmit={submit}
          className="mt-3 flex w-full max-w-3xl flex-col gap-2 sm:flex-row sm:items-center"
          role="search"
          aria-label="지역·가격대 매물 검색"
        >
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger
              aria-label="지역 선택"
              className="h-11 flex-1 border-stone/60 bg-background shadow-sm"
            >
              <span className="inline-flex items-center gap-2">
                <MapIcon className="size-4 text-tangerine" aria-hidden="true" />
                <SelectValue placeholder="지역 전체" />
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">지역 전체</SelectItem>
              {REGION_NAMES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={price} onValueChange={setPrice}>
            <SelectTrigger
              aria-label="가격대 선택"
              className="h-11 flex-1 border-stone/60 bg-background shadow-sm"
            >
              <SelectValue placeholder="가격 전체" />
            </SelectTrigger>
            <SelectContent>
              {PRICE_RANGES.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="submit"
            className="h-11 bg-tangerine text-tangerine-foreground hover:bg-tangerine/90"
          >
            <Search className="size-4" aria-hidden="true" />
            검색
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onOpenMap}
            className="h-11 border-sea/50 text-sea hover:text-sea"
            aria-label="지도에서 매물 보기"
          >
            <MapIcon className="size-4" aria-hidden="true" />
            지도
          </Button>
        </form>
      </div>
    </section>
  );
}

export default Hero;
