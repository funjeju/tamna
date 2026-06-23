"use client";
// TamnaIndex — 검색바 + 정렬 + 필터 드롭다운 + 활성 필터 칩
import { useMemo } from "react";
import { Search, X, ArrowDownUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ListingFilters } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FilterPopover, countActive, formatPriceShort } from "./FilterPopover";

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

  const removeChip = (key: keyof ListingFilters, value?: string) => {
    if (key === "q") return onChange({ ...filters, q: undefined });
    if (key === "sourceType") return onChange({ ...filters, sourceType: undefined });
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
          <FilterPopover filters={filters} onChange={onChange} onReset={onReset} />
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

interface ChipInfo {
  key: keyof ListingFilters;
  value?: string;
  label: string;
}

function buildActiveChips(f: ListingFilters): ChipInfo[] {
  const out: ChipInfo[] = [];
  if (f.q) out.push({ key: "q", label: `검색: ${f.q}` });
  if (f.sourceType) out.push({ key: "sourceType", label: f.sourceType === "youtube" ? "유튜브" : "블로그" });
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

export default SearchBar;
