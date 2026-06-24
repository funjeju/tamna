"use client";
// TamnaIndex — 공개 사이트 최상위 컴포넌트 (자체完結)
// page.tsx에서 <PublicApp /> 단일 import로 사용.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Bookmark, Compass, Heart, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Listing, ListingFilters, Theme } from "@/lib/types";
import { PUBLIC_MAX_AGE_DAYS } from "@/lib/types";
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
import { ChatWidget } from "./ChatWidget";
import { FeaturedBanner } from "./FeaturedBanner";
import { SourceToggle, applySource, type SourceFilter } from "./SourceToggle";
import { FilterPopover, countActive } from "./FilterPopover";

type View = "home" | "search";

const EMPTY_FILTERS: ListingFilters = { sort: "latest", status: "published" };

// 최신 매물 기준 — 2일 이내
const LATEST_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;
function effTime(l: Listing): number {
  const s = l.publishedAt2 ?? l.collectedAt;
  return s ? new Date(s).getTime() : 0;
}

export function PublicApp() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 로그인/로그아웃 시 내 찜 목록 갱신
  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["favorites"] });
  }, [user, queryClient]);

  // 접속 통계 — 세션당 1회 방문 집계
  useEffect(() => {
    try {
      if (sessionStorage.getItem("tx_visited")) return;
      sessionStorage.setItem("tx_visited", "1");
    } catch {
      /* noop */
    }
    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "visit" }),
    }).catch(() => {});
  }, []);

  // 가이드 글 등에서 들어온 ?listing=<id> 딥링크 → 상세 자동 오픈
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("listing");
    if (id) {
      setSelectedId(id);
      setHighlightId(id);
    }
  }, []);

  const [view, setView] = useState<View>("home");
  const [filters, setFilters] = useState<ListingFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [myOpen, setMyOpen] = useState(false);
  const [headerQ, setHeaderQ] = useState("");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [showAllLatest, setShowAllLatest] = useState(false);

  // listings 쿼리 — 홈에서도 테마 카드 카운트를 위해 200개까지 로드.
  // 홈의 '방금 들어온 매물' 미리보기는 이 목록의 앞 8개를 사용한다.
  const listingsQuery = useQuery<{ listings: Listing[]; total: number }>({
    queryKey: ["listings", filters],
    queryFn: async () => {
      const url = buildListingsQuery({
        ...filters,
        status: "published",
        limit: 200,
        maxAgeDays: PUBLIC_MAX_AGE_DAYS,
      });
      const res = await fetch(url);
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
      const res = await fetch("/api/dashboard");
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

  // 주목할 매물 (광고/추천 배너)
  const featuredQuery = useQuery<{ listings: Listing[]; isFallback: boolean; isPadded?: boolean }>({
    queryKey: ["featured"],
    queryFn: async () => {
      const res = await fetch("/api/featured");
      if (!res.ok) throw new Error("featured fetch failed");
      return res.json();
    },
  });

  // 선택된 매물 — 가능하면 목록에서 찾고, 없으면 상세 API
  const listings = listingsQuery.data?.listings ?? [];

  // 상세조회 통계 — 매물 상세를 열 때 1회 집계
  useEffect(() => {
    if (!selectedId) return;
    const l = listings.find((x) => x.id === selectedId);
    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "detail",
        listingId: selectedId,
        title: l?.title,
        region: l?.region,
        propertyType: l?.propertyType,
        sourceType: l?.sourceType,
      }),
    }).catch(() => {});
    // selectedId 변경 시 1회만 집계 (listings 변경으로 재집계 방지)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectedListing = useMemo<Listing | null>(() => {
    if (!selectedId) return null;
    return listings.find((l) => l.id === selectedId) ?? null;
  }, [listings, selectedId]);

  // 소스(전체/블로그/유튜브) 필터 적용
  const sourcedListings = useMemo(
    () => applySource(listings, sourceFilter),
    [listings, sourceFilter],
  );

  // 최신 매물(2일 이내) / 전체 매물(그 외) — 중복 없이 분리
  const { latestListings, restListings } = useMemo(() => {
    const now = Date.now();
    const sorted = [...sourcedListings].sort((a, b) => effTime(b) - effTime(a));
    const latest = sorted.filter((l) => now - effTime(l) <= LATEST_WINDOW_MS);
    const latestIds = new Set(latest.map((l) => l.id));
    const rest = sorted.filter((l) => !latestIds.has(l.id));
    return { latestListings: latest, restListings: rest };
  }, [sourcedListings]);

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
      const term = q.trim();
      if (term) {
        fetch("/api/stats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "search", q: term }),
        }).catch(() => {});
      }
      goSearch({ ...EMPTY_FILTERS, q: q || undefined });
    },
    [goSearch],
  );

  const handleFilterSearch = useCallback(
    (partial: Partial<ListingFilters>) => {
      goSearch({ ...EMPTY_FILTERS, ...partial });
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

  const filterCount = useMemo(() => countActive(filters), [filters]);

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

          {/* 우측 — 가이드 / 찜 / 마이 */}
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild variant="ghost" size="sm" className="hidden gap-1.5 text-basalt sm:inline-flex">
              <Link href="/guide" aria-label="제주 부동산 가이드">
                <BookOpen className="size-4 text-sea" aria-hidden="true" />
                가이드
              </Link>
            </Button>
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
                onFilterSearch={handleFilterSearch}
                onPickTheme={handlePickTheme}
                onOpenMap={() => goSearch(EMPTY_FILTERS)}
                publishedCount={publishedCount}
                todayCount={todayCount}
                freshness={freshness}
              />

              {/* 주목할 매물 — 슬라이드 배너 */}
              <FeaturedBanner
                listings={featuredQuery.data?.listings ?? []}
                loading={featuredQuery.isLoading}
                isFallback={featuredQuery.data?.isFallback}
                isPadded={featuredQuery.data?.isPadded}
                onOpen={handleOpenListing}
              />

              <ThemeCollections
                listings={listings}
                onPick={handlePickTheme}
                loading={listingsQuery.isLoading}
              />

              {/* 최신 매물 — 2일 이내, 3×2 + 더보기 */}
              <section className="mx-auto max-w-7xl px-4 pb-2 md:px-8">
                <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-basalt md:text-2xl">
                      최신 매물
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      최근 2일 이내 새로 들어온 매물
                    </p>
                  </div>
                  <SourceToggle
                    value={sourceFilter}
                    onChange={(v) => {
                      setSourceFilter(v);
                      setShowAllLatest(false);
                    }}
                  />
                </header>

                {listingsQuery.isLoading ? (
                  <ListingGrid
                    listings={[]}
                    loading
                    cols={3}
                    onOpen={handleOpenListing}
                  />
                ) : latestListings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-stone/60 bg-paper/50 px-6 py-10 text-center text-sm text-muted-foreground">
                    최근 2일 이내 새 매물이 없습니다.
                  </p>
                ) : (
                  <>
                    <ListingGrid
                      listings={showAllLatest ? latestListings : latestListings.slice(0, 6)}
                      loading={listingsQuery.isLoading}
                      onOpen={handleOpenListing}
                      onFavoriteChange={handleFavoriteChange}
                      cols={3}
                    />
                    {latestListings.length > 6 ? (
                      <div className="mt-4 flex justify-center">
                        <Button
                          variant="outline"
                          className="border-sea/50 text-sea"
                          onClick={() => setShowAllLatest((v) => !v)}
                        >
                          {showAllLatest ? "접기" : `더보기 (${latestListings.length - 6}건)`}
                        </Button>
                      </div>
                    ) : null}
                  </>
                )}
              </section>

              {/* 전체 매물 — 2일 이전 포함 나머지, 무한스크롤 */}
              <section className="mx-auto max-w-7xl px-4 pt-8 pb-12 md:px-8 md:pb-16">
                <header className="mb-4 flex items-end justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight text-basalt md:text-2xl">
                      전체 매물
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      최신 매물을 제외한 전체 · 스크롤하면 계속 불러옵니다.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    className="border-sea/50 text-sea"
                    onClick={() => goSearch(EMPTY_FILTERS)}
                  >
                    지도에서 보기
                  </Button>
                </header>

                <ListingGrid
                  listings={restListings}
                  loading={listingsQuery.isLoading}
                  onOpen={handleOpenListing}
                  onFavoriteChange={handleFavoriteChange}
                  emptyTitle="표시할 매물이 없습니다"
                  cols={3}
                  infiniteScroll
                />
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
                total={sourcedListings.length}
                loading={listingsQuery.isLoading}
                onChange={(next) => setFilters(next)}
                onReset={handleReset}
              />

              {/* 소스 토글 */}
              <div className="mt-3 flex justify-end">
                <SourceToggle value={sourceFilter} onChange={setSourceFilter} />
              </div>

              {/* 지도 + 그리드 레이아웃 */}
              <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
                <div className="order-1 lg:sticky lg:top-20 lg:self-start">
                  <KakaoMap
                    listings={sourcedListings}
                    onSelectListing={handleOpenListing}
                    highlightId={highlightId}
                    className="min-h-[400px] md:min-h-[600px]"
                  />
                </div>
                <div className="order-2">
                  <ListingGrid
                    listings={sourcedListings}
                    loading={listingsQuery.isLoading}
                    onOpen={handleOpenListing}
                    onFavoriteChange={handleFavoriteChange}
                    onReset={handleReset}
                    onPickTheme={handlePickTheme}
                    onHighlight={setHighlightId}
                    infiniteScroll
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

      {/* 홈 플로팅 필터 — 지도뷰의 필터를 홈에서도 바로 */}
      {view === "home" ? (
        <div className="fixed bottom-5 left-5 z-40">
          <FilterPopover
            filters={filters}
            onChange={setFilters}
            onReset={handleReset}
            align="start"
            trigger={
              <button
                type="button"
                aria-label="필터"
                className="relative flex h-12 items-center gap-2 rounded-full border border-stone/50 bg-background px-5 text-sm font-medium text-basalt shadow-lg transition-all hover:shadow-xl"
              >
                <SlidersHorizontal className="size-4 text-sea" aria-hidden="true" />
                필터
                {filterCount > 0 ? (
                  <Badge className="border-transparent bg-tangerine px-1.5 py-0 text-[10px] text-tangerine-foreground">
                    {filterCount}
                  </Badge>
                ) : null}
              </button>
            }
          />
        </div>
      ) : null}

      {/* 매물 검색 챗봇 (플로팅) */}
      <ChatWidget onOpenListing={handleOpenListing} />
    </div>
  );
}

export default PublicApp;
