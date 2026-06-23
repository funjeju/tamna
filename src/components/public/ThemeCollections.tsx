"use client";
// TamnaIndex — 테마별 컬렉션 (PRD 9.5)
// 6개 테마 카드 — 각각 고유 색 코팅 + 매물 수 + 대표 썸네일 모자이크
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Listing, Theme } from "@/lib/types";
import { THEMES } from "@/lib/types";

interface ThemeCollectionsProps {
  listings: Listing[];
  onPick: (t: Theme) => void;
  loading?: boolean;
}

interface ThemeMeta {
  title: Theme;
  subtitle: string;
  desc: string;
  accent: string;
  border: string;
  gradient: string;
  emoji: string;
}

const THEME_META: ThemeMeta[] = [
  {
    title: "세컨하우스",
    subtitle: "Second House",
    desc: "도시 생활의 보완이 될 두 번째 집. 주중 출장·주말 제주.",
    accent: "bg-basalt text-paper",
    border: "hover:border-basalt",
    gradient: "from-basalt/85 to-basalt/55",
    emoji: "🏡",
  },
  {
    title: "한달살기",
    subtitle: "One Month Stay",
    desc: "한 달의 제주 살이. 풀옵션·단기 임대 중심.",
    accent: "bg-sea text-sea-foreground",
    border: "hover:border-sea",
    gradient: "from-sea/85 to-sea/45",
    emoji: "🌊",
  },
  {
    title: "돌집·구옥",
    subtitle: "Stone & Old",
    desc: "제주의 돌담과 오래된 집, 리모델링 가능 매물.",
    accent: "bg-stone/60 text-basalt",
    border: "hover:border-stone",
    gradient: "from-stone/70 to-stone/30",
    emoji: "🪨",
  },
  {
    title: "바다뷰",
    subtitle: "Ocean View",
    desc: "창 너머로 바다가 보이는 집. 해변 도보 거리.",
    accent: "bg-sea/90 text-sea-foreground",
    border: "hover:border-sea",
    gradient: "from-sea/80 to-paper",
    emoji: "🏝️",
  },
  {
    title: "읍면 단독",
    subtitle: "Village House",
    desc: "읍면동 마을 안 단독주택. 일상이 깃든 동네.",
    accent: "bg-paper text-basalt border border-stone/60",
    border: "hover:border-stone",
    gradient: "from-paper to-stone/40",
    emoji: "🏘️",
  },
  {
    title: "급매",
    subtitle: "Quick Sale",
    desc: "지금 놓치면 안 될 가격인하 매물.",
    accent: "bg-tangerine text-tangerine-foreground",
    border: "hover:border-tangerine",
    gradient: "from-tangerine/85 to-tangerine/40",
    emoji: "🔥",
  },
];

export function ThemeCollections({ listings, onPick, loading }: ThemeCollectionsProps) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
      <header className="mb-3 flex items-end justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-basalt md:text-xl">
          테마 컬렉션
        </h2>
        <Badge variant="outline" className="hidden border-stone/60 text-[10px] text-muted-jeju sm:flex">
          {THEMES.length}개 테마 · 좌우로 넘겨보세요
        </Badge>
      </header>

      {loading ? (
        <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {THEME_META.map((meta) => (
            <div
              key={meta.title}
              className="w-[240px] shrink-0 overflow-hidden rounded-xl border border-stone/60 bg-card shadow-sm"
            >
              <div className="aspect-[16/9] w-full animate-pulse bg-muted" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-3/4 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : (
      <div className="flex snap-x gap-4 overflow-x-auto scroll-thin pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {THEME_META.map((meta, idx) => {
          const items = listings.filter((l) => l.themes.includes(meta.title));
          const count = items.length;
          const covers = items.slice(0, 4);
          return (
            <motion.button
              key={meta.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: idx * 0.04 }}
              whileHover={{ y: -4 }}
              onClick={() => onPick(meta.title)}
              type="button"
              aria-label={`${meta.title} 테마 매물 ${count}건 보기`}
              className={`group flex w-[240px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-stone/60 bg-card text-left shadow-sm transition hover:shadow-lg ${meta.border}`}
            >
              {/* 대표 썸네일 모자이크 / 그라데이션 */}
              <div className="relative aspect-[16/9] w-full overflow-hidden">
                {covers.length > 0 ? (
                  <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-paper">
                    {covers.map((c, i) => (
                      <div
                        key={c.id + i}
                        className="relative overflow-hidden bg-muted"
                        style={{ gridColumn: covers.length === 1 ? "span 2" : undefined, gridRow: covers.length === 1 ? "span 2" : undefined }}
                      >
                        {c.thumbnailUrl ? (
                          <img
                            src={c.thumbnailUrl}
                            alt={`${meta.title} 대표 썸네일 ${i + 1}`}
                            loading="lazy" referrerPolicy="no-referrer"
                            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl">
                            {meta.emoji}
                          </div>
                        )}
                      </div>
                    ))}
                    {/* 남은 칸 채우기 */}
                    {Array.from({ length: Math.max(0, 4 - covers.length) }).map(
                      (_, i) => (
                        <div
                          key={`fill-${i}`}
                          className={`flex items-center justify-center bg-gradient-to-br ${meta.gradient} text-2xl text-paper/70`}
                        >
                          {meta.emoji}
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <div
                    className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${meta.gradient} text-5xl`}
                  >
                    {meta.emoji}
                  </div>
                )}

                {/* 좌상단 테마 배지 */}
                <div className="absolute top-3 left-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.accent}`}
                  >
                    <span aria-hidden="true">{meta.emoji}</span>
                    {meta.title}
                  </span>
                </div>

                {/* 우하단 매물 수 */}
                <div className="absolute right-3 bottom-3">
                  <span className="rounded-full bg-basalt/85 px-2.5 py-0.5 text-[11px] font-medium text-paper backdrop-blur">
                    <span className="font-mono tabular">{count}</span>매물
                  </span>
                </div>
              </div>

              {/* 본문 */}
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-semibold text-basalt">
                    {meta.title}
                  </h3>
                  <span className="text-[11px] tracking-wider text-muted-foreground uppercase">
                    {meta.subtitle}
                  </span>
                </div>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                  {meta.desc}
                </p>
                <div className="mt-auto flex items-center gap-1 pt-2 text-xs font-medium text-sea group-hover:text-tangerine">
                  보기
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
      )}
    </section>
  );
}

export default ThemeCollections;
