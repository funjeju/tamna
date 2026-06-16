"use client";
// TamnaIndex — 마이페이지 시트 (PRD 9.4) — 찜 / 저장검색 / 알림함
import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Bookmark,
  CalendarClock,
  Heart,
  MapPin,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Listing, ListingFilters } from "@/lib/types";
import {
  formatPrice,
  formatRelativeTime,
  toggleFavorite,
} from "@/lib/public/format";
import { cn } from "@/lib/utils";

export interface SavedSearchItem {
  id: string;
  label: string;
  filters: ListingFilters;
  cadence: "instant" | "daily" | "off";
  savedAt: number;
}

interface MySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenListing: (id: string) => void;
  currentFilters: ListingFilters;
}

type FavoriteRow = Listing & {
  notifyPriceDrop: boolean;
  savedAt: string;
};

const SS_KEY = "tamna:saved-searches";

export function MySheet({
  open,
  onOpenChange,
  onOpenListing,
  currentFilters,
}: MySheetProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [savedSearches, setSavedSearches] = useState<SavedSearchItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(SS_KEY);
      return raw ? (JSON.parse(raw) as SavedSearchItem[]) : [];
    } catch {
      return [];
    }
  });
  const [tab, setTab] = useState<"favorites" | "searches" | "alerts">("favorites");

  const persist = (next: SavedSearchItem[]) => {
    setSavedSearches(next);
    try {
      window.localStorage.setItem(SS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  // 찜 목록 조회
  const { data, isLoading, isFetching } = useQuery<{ favorites: FavoriteRow[] }>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites", { cache: "no-store" });
      if (!res.ok) throw new Error("favorites fetch failed");
      return res.json();
    },
    enabled: open,
  });

  const favorites = data?.favorites ?? [];

  const handleUnfavorite = useCallback(
    async (id: string) => {
      try {
        await toggleFavorite(id);
        qc.invalidateQueries({ queryKey: ["favorites"] });
        qc.invalidateQueries({ queryKey: ["listings"] });
        toast({ title: "찜을 해제했습니다" });
      } catch {
        toast({
          title: "해제 실패",
          description: "잠시 후 다시 시도해주세요.",
          variant: "destructive",
        });
      }
    },
    [qc, toast],
  );

  const handleNotifyToggle = useCallback(
    async (id: string, next: boolean) => {
      // API는 토글이라 — 이미 찜 상태면 POST 다시 보내면 해제됨.
      // 단순 구현: notifies를 켜려면 찜이 없으면 생성, 있으면 — 현재 API가 업데이트를 지원하지 않으므로
      // 토글을 두 번 호출하여 상태를 맞춘다. (데모)
      try {
        const fav = favorites.find((f) => f.id === id);
        if (!fav) return;
        if (!fav.notifyPriceDrop && next) {
          // 현재 notify 꺼짐 → 켜기: 찜 해제 후 notify=true 로 재생성
          await toggleFavorite(id); // unflag
          await toggleFavorite(id, true); // recreate with notify
        } else if (fav.notifyPriceDrop && !next) {
          await toggleFavorite(id);
          await toggleFavorite(id, false);
        }
        qc.invalidateQueries({ queryKey: ["favorites"] });
      } catch {
        toast({
          title: "알림 설정 실패",
          variant: "destructive",
        });
      }
    },
    [favorites, qc, toast],
  );

  const handleSaveSearch = () => {
    const label = buildSearchLabel(currentFilters);
    if (!label || label === "전체") {
      toast({
        title: "저장할 검색 조건이 없습니다",
        description: "필터를 먼저 설정해주세요.",
        variant: "destructive",
      });
      return;
    }
    const item: SavedSearchItem = {
      id: `ss_${Date.now()}`,
      label,
      filters: currentFilters,
      cadence: "instant",
      savedAt: Date.now(),
    };
    persist([item, ...savedSearches]);
    toast({
      title: "저장검색을 추가했습니다",
      description: label,
    });
  };

  const removeSearch = (id: string) => {
    persist(savedSearches.filter((s) => s.id !== id));
  };

  const updateCadence = (id: string, cadence: SavedSearchItem["cadence"]) => {
    persist(
      savedSearches.map((s) => (s.id === id ? { ...s, cadence } : s)),
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md md:max-w-lg"
      >
        <SheetHeader className="border-b border-stone/40 p-5">
          <SheetTitle className="flex items-center gap-2 text-basalt">
            <Bookmark className="size-4 text-tangerine" aria-hidden="true" />
            마이 페이지
          </SheetTitle>
          <SheetDescription>
            찜한 매물 · 저장한 검색 · 알림함을 한곳에서 관리합니다.
          </SheetDescription>
        </SheetHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          className="flex flex-1 flex-col gap-0"
        >
          <div className="border-b border-stone/40 px-3 pt-3">
            <TabsList className="bg-paper">
              <TabsTrigger value="favorites" className="gap-1">
                <Heart className="size-3.5" aria-hidden="true" />
                찜 목록
                {favorites.length ? (
                  <span className="font-mono text-[10px] tabular text-tangerine">
                    {favorites.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="searches" className="gap-1">
                <Search className="size-3.5" aria-hidden="true" />
                저장검색
                {savedSearches.length ? (
                  <span className="font-mono text-[10px] tabular text-sea">
                    {savedSearches.length}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="alerts" className="gap-1">
                <Bell className="size-3.5" aria-hidden="true" />
                알림함
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 찜 목록 */}
          <TabsContent
            value="favorites"
            className="scroll-thin m-0 flex-1 overflow-y-auto p-3"
          >
            {isLoading || isFetching ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : favorites.length === 0 ? (
              <EmptyState
                icon={<Heart className="size-8" aria-hidden="true" />}
                title="찜한 매물이 없습니다"
                desc="매물 카드의 하트 버튼을 눌러 저장해 보세요."
              />
            ) : (
              <ul className="space-y-2">
                {favorites.map((f) => (
                  <li
                    key={f.id}
                    className="flex gap-3 rounded-lg border border-stone/60 bg-card p-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenListing(f.id);
                      }}
                      className="aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted"
                      aria-label={`${f.title} 상세 보기`}
                    >
                      {f.thumbnailUrl ? (
                        <img
                          src={f.thumbnailUrl}
                          alt={`${f.title} 썸네일`}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <MapPin className="size-5" />
                        </div>
                      )}
                    </button>
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="line-clamp-2 text-xs font-medium text-basalt">
                        {f.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-basalt tabular">
                          {formatPrice(f.priceManwon, f.priceText)}
                        </span>
                        <span className="text-[11px] text-tangerine">
                          {f.region}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <Switch
                            checked={f.notifyPriceDrop}
                            onCheckedChange={(v) =>
                              handleNotifyToggle(f.id, !!v)
                            }
                            aria-label="가격인하 알림"
                          />
                          인하 알림
                        </label>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-sea"
                            onClick={() => {
                              onOpenChange(false);
                              onOpenListing(f.id);
                            }}
                          >
                            보기
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => handleUnfavorite(f.id)}
                            aria-label="찜 해제"
                          >
                            <Trash2 className="size-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* 저장검색 */}
          <TabsContent
            value="searches"
            className="scroll-thin m-0 flex-1 overflow-y-auto p-3"
          >
            <div className="mb-3 rounded-lg border border-dashed border-stone/60 bg-paper/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">현재 검색 조건</p>
                  <p className="truncate text-sm font-medium text-basalt">
                    {buildSearchLabel(currentFilters) || "전체 매물"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveSearch}
                  className="bg-sea text-sea-foreground hover:bg-sea/90"
                >
                  저장
                </Button>
              </div>
            </div>

            {savedSearches.length === 0 ? (
              <EmptyState
                icon={<Search className="size-8" aria-hidden="true" />}
                title="저장한 검색이 없습니다"
                desc="필터를 설정한 뒤 '저장'을 눌러 새 매물 알림을 받아보세요."
              />
            ) : (
              <ul className="space-y-2">
                {savedSearches.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-lg border border-stone/60 bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-medium text-basalt">
                          {s.label}
                        </p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <CalendarClock className="size-3" aria-hidden="true" />
                          {formatRelativeTime(new Date(s.savedAt).toISOString())} 저장
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSearch(s.id)}
                        aria-label="저장검색 삭제"
                        className="rounded-md p-1 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">
                        알림 주기
                      </span>
                      <Select
                        value={s.cadence}
                        onValueChange={(v) =>
                          updateCadence(s.id, v as SavedSearchItem["cadence"])
                        }
                      >
                        <SelectTrigger className="h-7 w-[100px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="instant">즉시</SelectItem>
                          <SelectItem value="daily">일간</SelectItem>
                          <SelectItem value="off">끔</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* 알림함 */}
          <TabsContent
            value="alerts"
            className="scroll-thin m-0 flex-1 overflow-y-auto p-3"
          >
            <ul className="space-y-2">
              {SAMPLE_ALERTS.map((a, i) => (
                <li
                  key={i}
                  className={cn(
                    "rounded-lg border bg-card p-3",
                    a.kind === "drop"
                      ? "border-tangerine/50"
                      : "border-stone/60",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        a.kind === "drop"
                          ? "bg-tangerine/15 text-tangerine"
                          : "bg-sea/10 text-sea",
                      )}
                    >
                      {a.kind === "drop" ? (
                        <Bell className="size-3.5" aria-hidden="true" />
                      ) : (
                        <MapPin className="size-3.5" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px]",
                            a.kind === "drop"
                              ? "border-tangerine/50 text-tangerine"
                              : "border-sea/40 text-sea",
                          )}
                        >
                          {a.kind === "drop" ? "가격인하" : "신규 매물"}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {a.time}
                        </span>
                      </div>
                      <p className="text-sm text-basalt">{a.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {a.desc}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

const SAMPLE_ALERTS: {
  kind: "new" | "drop";
  title: string;
  desc: string;
  time: string;
}[] = [
  {
    kind: "new",
    title: "애월 바다뷰 단독 신규 매물",
    desc: "저장검색 '애월 바다뷰'에 새 매물이 추가되었습니다.",
    time: "방금",
  },
  {
    kind: "drop",
    title: "한림 돌집 가격인하",
    desc: "3.2억 → 2.8억 (4,000만원 인하)",
    time: "2시간 전",
  },
  {
    kind: "new",
    title: "성산 전원주택 신규 매물",
    desc: "저장검색 '읍면 단독'에 새 매물이 추가되었습니다.",
    time: "어제",
  },
];

function EmptyState({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-stone/60 bg-paper/40 px-6 py-12 text-center">
      <div className="text-muted-foreground">{icon}</div>
      <p className="text-sm font-medium text-basalt">{title}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}

function buildSearchLabel(f: ListingFilters): string {
  const parts: string[] = [];
  if (f.q) parts.push(f.q);
  if (f.regions?.length) parts.push(f.regions.join("/"));
  if (f.themes?.length) parts.push(f.themes.join("/"));
  if (f.propertyTypes?.length) parts.push(f.propertyTypes.join("/"));
  if (f.dealTypes?.length) parts.push(f.dealTypes.join("/"));
  if (f.keywords?.length) parts.push(f.keywords.map((k) => `#${k}`).join(" "));
  if (f.priceMin !== undefined || f.priceMax !== undefined) {
    parts.push(
      `${f.priceMin ?? 0}~${f.priceMax ?? "없음"}`,
    );
  }
  return parts.join(" · ");
}

export default MySheet;
