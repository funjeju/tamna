"use client";
// TamnaIndex — 검색바 + 정렬 + 필터 드롭다운 + 활성 필터 칩
import { useMemo } from "react";
import { Search, SlidersHorizontal, X, ArrowDownUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  DEAL_TYPES,
  KEYWORD_CHIPS,
  PROPERTY_TYPES,
  THEMES,
} from "@/lib/types";
import { REGION_NAMES } from "@/lib/regions";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  filters: ListingFilters;
  total: number;
  loading?: boolean;
  onChange: (next: ListingFilters) => void;
  onReset: () => void;
  className?: string;
}

const SORT_OPTIONS: { value: NonNullable<ListingFilters["sort"]>; label: string }[] = [
  { value: "latest", label: "최신순" },
  { value: "price_asc", label: "가격 ↑" },
  { value: "price_desc", label: "가격 ↓" },
  { value: "area", label: "면적순" },
  { value: "price_drop", label: "가격인하순" },
  { value: "just_published", label: "방금 게시" },
];

// 가격대 슬라이더는 만원 단위 (0~100000만원 = 0~100억)
const PRICE_MAX = 100000;

export function SearchBar({
  filters,
  total,
  loading,
  onChange,
  onReset,
  className,
}: SearchBarProps) {
  const activeCount = useMemo(() => countActive(filters), [filters]);

  // 활성 칩 목록
  const chips = useMemo(() => buildActiveChips(filters), [filters]);

  const setQ = (q: string) => onChange({ ...filters, q });
  const setSort = (sort: NonNullable<ListingFilters["sort"]>) =>
    onChange({ ...filters, sort });

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

  const removeChip = (key: keyof ListingFilters, value?: string) => {
    if (key === "q") return onChange({ ...filters, q: undefined });
    if (key === "priceMin" || key === "priceMax")
      return onChange({ ...filters, priceMin: undefined, priceMax: undefined });
    if (key === "areaMin" || key === "areaMax")
      return onChange({ ...filters, areaMin: undefined, areaMax: undefined });
    if (
      key === "propertyTypes" ||
      key === "dealTypes" ||
      key === "regions" ||
      key === "themes" ||
      key === "keywords"
    ) {
      const arr = (filters[key] as string[] | undefined) ?? [];
      const next = arr.filter((x) => x !== value);
      onChange({ ...filters, [key]: next.length ? next : undefined });
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        {/* 검색 input */}
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filters.q ?? ""}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            placeholder="애월 바다 보이는 2억대 구옥 · 한림 돌집 · 급매 …"
            aria-label="자연어 매물 검색"
            className="h-10 border-stone/60 bg-background pl-9 pr-9"
          />
          {filters.q ? (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label="검색어 지우기"
              className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground hover:text-basalt"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        {/* 정렬 */}
        <div className="flex items-center gap-2">
          <ArrowDownUp className="size-4 text-muted-foreground" aria-hidden="true" />
          <Select
            value={filters.sort ?? "latest"}
            onValueChange={(v) => setSort(v as NonNullable<ListingFilters["sort"]>)}
          >
            <SelectTrigger
              aria-label="정렬"
              className="h-10 w-[150px] border-stone/60 bg-background"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 필터 팝오버 */}
          <Popover>
            <PopoverTrigger asChild>
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
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(92vw,560px)] p-0"
            >
              <ScrollArea className="max-h-[70vh]">
                <div className="space-y-5 p-4">
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
        </div>
      </div>

      {/* 활성 필터 칩 + 결과 카운트 */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {loading ? (
            "불러오는 중…"
          ) : (
            <>
              <span className="font-mono font-semibold text-basalt tabular">
                {total.toLocaleString("ko-KR")}
              </span>
              개 매물
            </>
          )}
        </span>
        {chips.map((c) => (
          <Badge
            key={`${c.key}-${c.value}`}
            variant="outline"
            className="gap-1 border-sea/50 bg-sea/5 text-sea"
          >
            <span>{c.label}</span>
            <button
              type="button"
              aria-label={`${c.label} 필터 해제`}
              onClick={() => removeChip(c.key, c.value)}
              className="rounded-full hover:bg-sea/10"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            전체 초기화
          </button>
        ) : null}
      </div>
    </div>
  );
}

function countActive(f: ListingFilters): number {
  let n = 0;
  if (f.q) n++;
  if (f.propertyTypes?.length) n += f.propertyTypes.length;
  if (f.dealTypes?.length) n += f.dealTypes.length;
  if (f.regions?.length) n += f.regions.length;
  if (f.themes?.length) n += f.themes.length;
  if (f.keywords?.length) n += f.keywords.length;
  if (f.priceMin !== undefined || f.priceMax !== undefined) n++;
  if (f.areaMin !== undefined || f.areaMax !== undefined) n++;
  return n;
}

interface ChipInfo {
  key: keyof ListingFilters;
  value?: string;
  label: string;
}

function buildActiveChips(f: ListingFilters): ChipInfo[] {
  const out: ChipInfo[] = [];
  if (f.q) out.push({ key: "q", label: `검색: ${f.q}` });
  f.propertyTypes?.forEach((v) =>
    out.push({ key: "propertyTypes", value: v, label: v }),
  );
  f.dealTypes?.forEach((v) => out.push({ key: "dealTypes", value: v, label: v }));
  f.regions?.forEach((v) => out.push({ key: "regions", value: v, label: v }));
  f.themes?.forEach((v) => out.push({ key: "themes", value: v, label: v }));
  f.keywords?.forEach((v) =>
    out.push({ key: "keywords", value: v, label: `#${v}` }),
  );
  if (f.priceMin !== undefined || f.priceMax !== undefined) {
    out.push({
      key: "priceMin",
      label: `가격 ${formatPriceShort(f.priceMin ?? 0)} ~ ${
        f.priceMax ? formatPriceShort(f.priceMax) : "제한없음"
      }`,
    });
  }
  if (f.areaMin !== undefined || f.areaMax !== undefined) {
    out.push({
      key: "areaMin",
      label: `면적 ${f.areaMin ?? 0} ~ ${f.areaMax ?? "제한없음"}평`,
    });
  }
  return out;
}

function formatPriceShort(manwon: number): string {
  if (manwon >= 10000) {
    const uk = manwon / 10000;
    return Number.isInteger(uk) ? `${uk}억` : `${uk.toFixed(1)}억`;
  }
  return `${manwon.toLocaleString("ko-KR")}만`;
}

export default SearchBar;
