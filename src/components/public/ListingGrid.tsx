"use client";
// TamnaIndex — 매물 그리드 (반응형 + 로딩/빈 상태)
import { SearchX, RotateCcw, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListingCard, ListingCardSkeleton } from "./ListingCard";
import type { Listing, Theme } from "@/lib/types";
import { THEMES } from "@/lib/types";

interface ListingGridProps {
  listings: Listing[];
  loading?: boolean;
  onOpen: (id: string) => void;
  onFavoriteChange?: () => void;
  onReset?: () => void;
  onPickTheme?: (t: Theme) => void;
  emptyTitle?: string;
}

export function ListingGrid({
  listings,
  loading,
  onOpen,
  onFavoriteChange,
  onReset,
  onPickTheme,
  emptyTitle,
}: ListingGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-stone/70 bg-paper/50 px-6 py-16 text-center">
        <SearchX className="size-10 text-stone" aria-hidden="true" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-basalt">
            {emptyTitle ?? "조건에 맞는 매물이 없습니다"}
          </p>
          <p className="text-sm text-muted-foreground">
            필터를 조절하거나 다른 테마로 탐색해 보세요.
          </p>
        </div>
        {onReset ? (
          <Button variant="outline" onClick={onReset} className="border-sea/50 text-sea">
            <RotateCcw className="size-4" aria-hidden="true" />
            필터 초기화
          </Button>
        ) : null}
        {onPickTheme ? (
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Compass className="size-3" aria-hidden="true" />
              테마 추천
            </span>
            {THEMES.map((t) => (
              <button
                key={t}
                onClick={() => onPickTheme(t)}
                className="rounded-full border border-stone/60 bg-background px-3 py-1 text-xs text-basalt transition hover:border-sea hover:text-sea"
              >
                {t}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {listings.map((l) => (
        <ListingCard
          key={l.id}
          listing={l}
          onOpen={onOpen}
          onFavoriteChange={onFavoriteChange}
        />
      ))}
    </div>
  );
}

export default ListingGrid;
