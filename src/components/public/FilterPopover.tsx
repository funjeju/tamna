"use client";
// TamnaIndex — 매물 필터 팝오버 (검색뷰·홈 플로팅에서 공용)
import { useMemo, type ReactNode } from "react";
import { BookOpen, SlidersHorizontal, Youtube, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import type {
  DealType,
  ListingFilters,
  PropertyType,
  Theme,
} from "@/lib/types";
import { DEAL_TYPES, KEYWORD_CHIPS, PROPERTY_TYPES, THEMES } from "@/lib/types";
import { REGION_NAMES } from "@/lib/regions";
import { cn } from "@/lib/utils";

// 가격대 슬라이더는 만원 단위 (0~100000만원 = 0~100억)
export const PRICE_MAX = 100000;

interface FilterPopoverProps {
  filters: ListingFilters;
  onChange: (next: ListingFilters) => void;
  onReset: () => void;
  /** 팝오버 정렬 — 기본 end */
  align?: "start" | "center" | "end";
  /** 커스텀 트리거 (없으면 기본 '필터' 버튼) */
  trigger?: ReactNode;
}

export function FilterPopover({
  filters,
  onChange,
  onReset,
  align = "end",
  trigger,
}: FilterPopoverProps) {
  const activeCount = useMemo(() => countActive(filters), [filters]);

  const toggleInArray = <T,>(arr: T[] | undefined, v: T) => {
    const set = new Set(arr ?? []);
    if (set.has(v)) set.delete(v);
    else set.add(v);
    return Array.from(set);
  };

  const toggleProperty = (p: PropertyType) =>
    onChange({ ...filters, propertyTypes: toggleInArray(filters.propertyTypes, p) });
  const toggleDeal = (d: DealType) =>
    onChange({ ...filters, dealTypes: toggleInArray(filters.dealTypes, d) });
  const toggleRegion = (r: string) =>
    onChange({ ...filters, regions: toggleInArray(filters.regions, r) });
  const toggleTheme = (t: Theme) =>
    onChange({ ...filters, themes: toggleInArray(filters.themes, t) });
  const toggleKeyword = (k: string) =>
    onChange({ ...filters, keywords: toggleInArray(filters.keywords, k) });

  const priceRange: [number, number] = [
    filters.priceMin ?? 0,
    filters.priceMax ?? PRICE_MAX,
  ];
  const areaRange: [number, number] = [
    filters.areaMin ?? 0,
    filters.areaMax ?? 200,
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button
            variant="outline"
            className="relative h-10 border-stone/60 bg-background"
            aria-label="필터"
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">필터</span>
            {activeCount > 0 ? (
              <Badge className="ml-1 border-transparent bg-tangerine px-1.5 py-0 text-[10px] text-tangerine-foreground">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[min(92vw,560px)] p-0">
        <ScrollArea className="max-h-[70vh]">
          <div className="space-y-5 p-4">
            {/* 소스 타입 */}
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                매물 출처
              </h4>
              <div className="flex gap-2">
                {(
                  [
                    { value: undefined, label: "전체" },
                    { value: "youtube", label: "유튜브", Icon: Youtube, color: "text-red-500" },
                    { value: "blog", label: "블로그", Icon: BookOpen, color: "text-emerald-600" },
                  ] as {
                    value: ListingFilters["sourceType"];
                    label: string;
                    Icon?: LucideIcon;
                    color?: string;
                  }[]
                ).map(({ value, label, Icon, color }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onChange({ ...filters, sourceType: value })}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      filters.sourceType === value
                        ? "border-sea bg-sea text-sea-foreground"
                        : "border-stone/60 text-basalt hover:border-sea/50"
                    }`}
                  >
                    {Icon && <Icon className={`size-3.5 ${filters.sourceType === value ? "text-sea-foreground" : color}`} />}
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* 유형 */}
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                매물 유형
              </h4>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROPERTY_TYPES.map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={!!filters.propertyTypes?.includes(p)}
                      onCheckedChange={() => toggleProperty(p)}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* 거래유형 */}
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                거래 유형
              </h4>
              <div className="flex flex-wrap gap-2">
                {DEAL_TYPES.map((d) => (
                  <label
                    key={d}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={!!filters.dealTypes?.includes(d)}
                      onCheckedChange={() => toggleDeal(d)}
                    />
                    <span>{d}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* 가격대 */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                  가격대
                </h4>
                <span className="font-mono text-xs tabular text-basalt">
                  {formatPriceShort(priceRange[0])} ~{" "}
                  {priceRange[1] >= PRICE_MAX
                    ? "제한없음"
                    : formatPriceShort(priceRange[1])}
                </span>
              </div>
              <Slider
                min={0}
                max={PRICE_MAX}
                step={1000}
                value={priceRange}
                onValueChange={(v) =>
                  onChange({
                    ...filters,
                    priceMin: v[0] > 0 ? v[0] : undefined,
                    priceMax: v[1] < PRICE_MAX ? v[1] : undefined,
                  })
                }
                className="w-full"
                aria-label="가격대 범위"
              />
            </section>

            {/* 면적 */}
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                  면적(평)
                </h4>
                <span className="font-mono text-xs tabular text-basalt">
                  {areaRange[0]}평 ~{" "}
                  {areaRange[1] >= 200 ? "제한없음" : `${areaRange[1]}평`}
                </span>
              </div>
              <Slider
                min={0}
                max={200}
                step={5}
                value={areaRange}
                onValueChange={(v) =>
                  onChange({
                    ...filters,
                    areaMin: v[0] > 0 ? v[0] : undefined,
                    areaMax: v[1] < 200 ? v[1] : undefined,
                  })
                }
                className="w-full"
                aria-label="면적 범위"
              />
            </section>

            {/* 읍면동 */}
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                읍면동
              </h4>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {REGION_NAMES.map((r) => (
                  <label
                    key={r}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={!!filters.regions?.includes(r)}
                      onCheckedChange={() => toggleRegion(r)}
                    />
                    <span>{r}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* 테마 */}
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                테마
              </h4>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <label
                    key={t}
                    className="flex cursor-pointer items-center gap-1.5 text-sm"
                  >
                    <Checkbox
                      checked={!!filters.themes?.includes(t)}
                      onCheckedChange={() => toggleTheme(t)}
                    />
                    <span>{t}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* 키워드 */}
            <section>
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                영상 키워드
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {KEYWORD_CHIPS.slice(0, 12).map((k) => {
                  const active = !!filters.keywords?.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleKeyword(k)}
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs transition",
                        active
                          ? "border-sea bg-sea text-sea-foreground"
                          : "border-stone/60 text-muted-foreground hover:border-sea hover:text-sea",
                      )}
                    >
                      #{k}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </ScrollArea>
        <div className="flex items-center justify-between border-t border-stone/40 bg-paper/40 px-4 py-3">
          <Label className="text-xs text-muted-foreground">
            활성 필터 {activeCount}개
          </Label>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onReset}>
              초기화
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function countActive(f: ListingFilters): number {
  let n = 0;
  if (f.q) n++;
  if (f.sourceType) n++;
  if (f.propertyTypes?.length) n += f.propertyTypes.length;
  if (f.dealTypes?.length) n += f.dealTypes.length;
  if (f.regions?.length) n += f.regions.length;
  if (f.themes?.length) n += f.themes.length;
  if (f.keywords?.length) n += f.keywords.length;
  if (f.priceMin !== undefined || f.priceMax !== undefined) n++;
  if (f.areaMin !== undefined || f.areaMax !== undefined) n++;
  return n;
}

export function formatPriceShort(manwon: number): string {
  if (manwon >= 10000) {
    const uk = manwon / 10000;
    return Number.isInteger(uk) ? `${uk}억` : `${uk.toFixed(1)}억`;
  }
  return `${manwon.toLocaleString("ko-KR")}만`;
}

export default FilterPopover;
