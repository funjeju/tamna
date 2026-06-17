"use client";
// TamnaIndex — 공개 사이트 최상위 컴포넌트 (자체完結)
// page.tsx에서 <PublicApp /> 단일 import로 사용.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Bookmark, Compass, Heart, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Listing, ListingFilters, Theme } from "@/lib/types";
import { buildListingsQuery } from "@/lib/public/format";
import { authHeaders } from "@/lib/authToken";
import { useAuth } from "@/components/auth/AuthProvider";
import { Hero } from "./Hero";
import { ThemeCollections } from "./ThemeCollections";
import { SearchBar } from "./SearchBar";
import { KakaoMap } from "./KakaoMap";
import { ListingGrid } from "./ListingGrid";
import { AuthButton } from "@/components/auth/AuthButton";
import { ListingDetail } from "./ListingDetail";
import { MySheet } from "./MySheet";
import { PublicFooter } from "./PublicFooter";

type View = "home" | "search";

const EMPTY_FILTERS: ListingFilters = { sort: "latest", status: "published" };

export function PublicApp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 로그인/로그아웃 시 내 찜 목록 갱신
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }, [user, queryClient]);

  const [view, setView] = useState<View>("home");
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [myOpen, setMyOpen] = useState(false);
  const [headerQ, setHeaderQ] = useState("");

  // listings 쿼리 — 홈에서도 테마 카드 카운트를 위해 200개까지 로드.
  // 홈의 '방금 들어온 매물' 미리보기는 이 목록의 앞 8개를 사용한다.
  const listingsQuery = useQuery<{ listings: Listing[]; total: number }>({
    queryKey: ["listings", filters],
    queryFn: async () => {
      const url = buildListingsQuery({
        ...filters,
        status: "published",
        limit: 200,
      });
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("listings fetch failed");
      return res.json();
    },
  });

  // 전체 게시 매물 수 + 오늘 신규 + 신선도 (대시보드)
  const statsQuery = useQuery<{
    kpi: { published: number; todayCollected: number; freshness: number };
  }>({
    queryKey: ["dashboard-public"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (!res.ok) throw new Error("dashboard fetch failed");
      return res.json();
    },
  });

  // 찜 카운트 (헤더 배지)
  const favQuery = useQuery<{ favorites: Listing[] }>({
    queryKey: ["favorites"],
    queryFn: async () => {
      const res = await fetch("/api/favorites", {
        cache: "no-store",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("favorites fetch failed");
      return res.json();
    },
  });
  const favCount = favQuery.data?.favorites?.length ?? 0;

  // 선택된 매물 — 가능하면 목록에서 찾고, 없으면 상세 API
  const listings = listingsQuery.data?.listings ?? [];
  const selectedListing = useMemo<Listing | null>(() => {
    if (!selectedId) return null;
    return listings.find((l) => l.id === selectedId) ?? null;
  }, [listings, selectedId]);

  // 홈 미리보기는 최근 8개만
  const homePreviewListings = useMemo(
    () => listings.slice(0, 8),
    [listings],
  );

  const detailQuery = useQuery<{ listing: Listing }>({
    queryKey: ["listing", selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/listings/${selectedId}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("listing fetch failed");
      return res.json();
    },
    enabled: !!selectedId && !selectedListing,
  });

  const detailListing = selectedListing ?? detailQuery.data?.listing ?? null;
  const detailLoading = !!selectedId && !selectedListing && detailQuery.isLoading;

  // 핸들러
  const goSearch = useCallback((next: ListingFilters) => {
    setFilters(next);
    setView("search");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleSearchSubmit = useCallback(
    (q: string) => {
      goSearch({ ...EMPTY_FILTERS, q: q || undefined });
    },
    [goSearch],
  );

  const handlePickTheme = useCallback(
    (t: Theme) => {
      goSearch({ ...EMPTY_FILTERS, themes: [t] });
      toast({
        title: `${t} 테마`,
        description: "해당 테마 매물로 지도와 리스트를 이동했어요.",
      });
    },
    [goSearch, toast],
  );

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const handleOpenListing = useCallback((id: string) => {
    setSelectedId(id);
    setHighlightId(id);
  }, []);

  const handleFavoriteChange = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["favorites"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
  }, [qc]);

  const submitHeaderSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    handleSearchSubmit(headerQ.trim());
  };

  const publishedCount = statsQuery.data?.kpi.published ?? 0;
  const todayCount = statsQuery.data?.kpi.todayCollected ?? 0;
  const freshness = statsQuery.data?.kpi.freshness ?? 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 공개 헤더 */}
      <header className="sticky top-0 z-30 border-b border-stone/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 md:px-8">
          {/* 로고 + 태그라인 */}
          <button
            type="button"
            onClick={() => {
              setView("home");
              setFilters(EMPTY_FILTERS);
            }}
            className="flex shrink-0 items-center gap-2"
            aria-label="탐라인덱스 홈으로"
          >
            <span className="flex size-8 items-center justify-center rounded-md bg-sea text-sea-foreground">
              <Compass className="size-4" aria-hidden="true" />
            </span>
            <span className="hidden flex-col leading-none sm:flex">
              <span className="text-sm font-bold text-basalt">탐라인덱스</span>
              <span className="text-[10px] text-muted-foreground">
                지도가 곧 인덱스
              </span>
            </span>
          </button>

          {/* 중앙 검색바 */}
          <form
            onSubmit={submitHeaderSearch}
            className="relative flex-1"
            role="search"
            aria-label="매물 검색"
          >
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={headerQ}
              onChange={(e) => setHeaderQ(e.target.value)}
              placeholder="애월 바다뷰 · 한림 돌집 · 급매 …"
              aria-label="매물 검색어"
              className="h-9 border-stone/60 bg-paper/60 pl-9 pr-3"
            />
          </form>

          {/* 우측 — 찜 / 마이 */}
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="relative gap-1.5 text-basalt"
              onClick={() => setMyOpen(true)}
              aria-label={`찜 ${favCount}건, 마이 페이지 열기`}
            >
              <Heart className="size-4 text-tangerine" aria-hidden="true" />
              <span className="hidden sm:inline">찜</span>
              {favCount > 0 ? (
                <Badge className="ml-0.5 border-transparent bg-tangerine px-1.5 py-0 text-[10px] text-tangerine-foreground">
                  {favCount}
                </Badge>
              ) : null}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="border-stone/60 text-basalt"
              onClick={() => setMyOpen(true)}
            >
              <Bookmark className="size-4 text-sea" aria-hidden="true" />
              <span className="hidden sm:inline">마이</span>
            </Button>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* 본문 */}
      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === "home" ? (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <Hero
                onSearch={handleSearchSubmit}
                onPickTheme={handlePickTheme}
                onOpenMap={() => goSearch(EMPTY_FILTERS)}
                publishedCount={publishedCount}
                todayCount={todayCount}
                freshness={freshness}
              />

              <ThemeCollections
                listings={listings}
                onPick={handlePickTheme}
              />

              {/* 최근 매물 미리보기 */}
              <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8 md:pb-16">
                <header className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-basalt md:text-2xl">
                      방금 들어온 매물
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      최근 게시된 제주 영상 매물 미리보기.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-sea/50 text-sea"
                    onClick={() => goSearch(EMPTY_FILTERS)}
                  >
                    전체 보기
                  </Button>
                </header>

                {listingsQuery.isLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <Skeleton key={i} className="h-72 w-full rounded-xl" />
                    ))}
                  </div>
                ) : (
                  <ListingGrid
                    listings={homePreviewListings}
                    onOpen={handleOpenListing}
                    onFavoriteChange={handleFavoriteChange}
                    emptyTitle="아직 게시된 매물이 없습니다"
                  />
                )}
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8"
            >
              <SearchBar
                filters={filters}
                total={listingsQuery.data?.total ?? 0}
                loading={listingsQuery.isLoading}
                onChange={(next) => setFilters(next)}
                onReset={handleReset}
              />

              {/* 지도 + 그리드 레이아웃 */}
              <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
                <div className="order-2 lg:order-1">
                  <KakaoMap
                    listings={listings}
                    onSelectListing={handleOpenListing}
                    highlightId={highlightId}
                    className="min-h-[400px] md:min-h-[600px]"
                  />
                </div>
                <div className="order-1 max-h-[640px] scroll-thin overflow-y-auto lg:order-2">
                  <ListingGrid
                    listings={listings}
                    loading={listingsQuery.isLoading}
                    onOpen={handleOpenListing}
                    onFavoriteChange={handleFavoriteChange}
                    onReset={handleReset}
                    onPickTheme={handlePickTheme}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <PublicFooter />

      {/* 상세 모달 */}
      <ListingDetail
        open={!!selectedId}
        onOpenChange={(o) => {
          if (!o) {
            setSelectedId(null);
            setHighlightId(null);
          }
        }}
        listing={detailListing}
        loading={detailLoading}
        onFavoriteChange={handleFavoriteChange}
      />

      {/* 마이 시트 */}
      <MySheet
        open={myOpen}
        onOpenChange={setMyOpen}
        onOpenListing={handleOpenListing}
        currentFilters={filters}
      />
    </div>
  );
}

export default PublicApp;
