"use client";
// TamnaIndex — 홈 상단 히어로 + 검색바 + 빠른 진입 칩 + 통계 배지
import { useState } from "react";
import { motion } from "framer-motion";
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
import { THEMES } from "@/lib/types";

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

const THEME_META: Record<Theme, { desc: string; tint: string; ring: string }> = {
  세컨하우스: {
    desc: "두 번째 집, 제주에서",
    tint: "bg-basalt text-paper",
    ring: "hover:border-basalt",
  },
  한달살기: {
    desc: "한 달의 제주 살이",
    tint: "bg-sea text-sea-foreground",
    ring: "hover:border-sea",
  },
  "돌집·구옥": {
    desc: "돌담과 오래된 집",
    tint: "bg-stone/40 text-basalt",
    ring: "hover:border-stone",
  },
  바다뷰: {
    desc: "창 너머로 바다",
    tint: "bg-sea/90 text-sea-foreground",
    ring: "hover:border-sea",
  },
  "읍면 단독": {
    desc: "동네의 일상",
    tint: "bg-paper text-basalt border border-stone/60",
    ring: "hover:border-stone",
  },
  급매: {
    desc: "지금 놓치면 안 될",
    tint: "bg-tangerine text-tangerine-foreground",
    ring: "hover:border-tangerine",
  },
};

export function Hero({
  onFilterSearch,
  onPickTheme,
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

      <div className="relative mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-20">
        {/* 통계 배지 */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-5 flex flex-wrap items-center gap-2"
        >
          <Badge className="border-transparent bg-sea/90 text-sea-foreground">
            <Radio className="size-3" aria-hidden="true" />
            게시중 {publishedCount.toLocaleString("ko-KR")}매물
          </Badge>
          <Badge className="border-transparent bg-tangerine/90 text-tangerine-foreground">
            <Sparkles className="size-3" aria-hidden="true" />
            오늘 {todayCount.toLocaleString("ko-KR")}건 신규
          </Badge>
          <Badge variant="outline" className="border-stone/60 text-muted-jeju">
            <TrendingUp className="size-3" aria-hidden="true" />
            신선도 {freshness}%
          </Badge>
        </motion.div>

        {/* 큰 타이틀 */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
          className="max-w-3xl text-3xl leading-tight font-bold tracking-tight text-basalt md:text-5xl"
        >
          제주 매물, <span className="text-sea">한 장의 지도</span>로
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12 }}
          className="mt-4 max-w-xl text-sm leading-relaxed text-muted-jeju md:text-base"
        >
          흩어진 유튜브 영상 매물을 수집 · 표준화 · 지도화했습니다.
          <br className="hidden sm:block" />
          영상 한 편이 곧 한 매물 — 지도 위에서 한눈에.
        </motion.p>

        {/* 검색바 */}
        <motion.form
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.18 }}
          onSubmit={submit}
          className="mt-7 flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center"
          role="search"
          aria-label="지역·가격대 매물 검색"
        >
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger
              aria-label="지역 선택"
              className="h-12 flex-1 border-stone/60 bg-background text-base shadow-sm"
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
              className="h-12 flex-1 border-stone/60 bg-background text-base shadow-sm"
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
            size="lg"
            className="h-12 bg-tangerine text-tangerine-foreground hover:bg-tangerine/90"
          >
            <Search className="size-4" aria-hidden="true" />
            검색
          </Button>
        </motion.form>

        {/* 빠른 진입 칩 — 테마별 컬러 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="mt-6 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs text-muted-foreground">빠른 진입 ·</span>
          {THEMES.map((t) => {
            const meta = THEME_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => onPickTheme(t)}
                className={`group inline-flex items-center gap-2 rounded-full border border-stone/60 bg-background px-3 py-1.5 text-xs font-medium text-basalt transition ${meta.ring}`}
                aria-label={`${t} 테마 매물 보기`}
              >
                <span
                  className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${meta.tint}`}
                  aria-hidden="true"
                >
                  {t[0]}
                </span>
                <span>{t}</span>
                <span className="text-muted-foreground">· {meta.desc}</span>
              </button>
            );
          })}
        </motion.div>

        {/* CTA — 지도에서 보기 */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8"
        >
          <Button
            onClick={onOpenMap}
            size="lg"
            className="h-11 bg-tangerine px-6 text-tangerine-foreground hover:bg-tangerine/90"
            aria-label="지도에서 매물 보기"
          >
            <MapIcon className="size-4" aria-hidden="true" />
            지도에서 보기
          </Button>
        </motion.div>
      </div>
    </section>
  );
}

export default Hero;
