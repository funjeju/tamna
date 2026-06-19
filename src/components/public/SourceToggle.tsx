"use client";
// TamnaIndex — 매물 소스(전체/블로그/유튜브) 세그먼트 토글
import { BookOpen, LayoutGrid, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";

export type SourceFilter = "all" | "blog" | "youtube";

const OPTIONS: { value: SourceFilter; label: string; Icon: typeof LayoutGrid; active: string }[] = [
  { value: "all", label: "전체", Icon: LayoutGrid, active: "bg-sea text-sea-foreground" },
  { value: "blog", label: "블로그", Icon: BookOpen, active: "bg-emerald-500 text-white" },
  { value: "youtube", label: "유튜브", Icon: Youtube, active: "bg-red-500 text-white" },
];

interface SourceToggleProps {
  value: SourceFilter;
  onChange: (v: SourceFilter) => void;
  className?: string;
}

export function SourceToggle({ value, onChange, className }: SourceToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="매물 소스 필터"
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-full border border-stone/50 bg-paper/60 p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value: v, label, Icon, active }) => {
        const on = value === v;
        return (
          <button
            key={v}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              on ? active : "text-muted-foreground hover:text-basalt",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/** 소스 필터 적용 헬퍼 */
export function applySource<T extends { sourceType?: "youtube" | "blog" }>(
  items: T[],
  filter: SourceFilter,
): T[] {
  if (filter === "all") return items;
  return items.filter((i) => (i.sourceType ?? "youtube") === filter);
}

export default SourceToggle;
