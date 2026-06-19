"use client";
// TamnaIndex — "주목할 매물" 슬라이드 배너 (좌우 스크롤, 3개 노출)
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PROPERTY_PIN } from "@/lib/regions";
import { formatPrice } from "@/lib/public/format";
import type { Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FeaturedBannerProps {
  listings: Listing[];
  loading?: boolean;
  isFallback?: boolean;
  isPadded?: boolean;
  onOpen: (id: string) => void;
}

export function FeaturedBanner({ listings, loading, isFallback, isPadded, onOpen }: FeaturedBannerProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 8);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
    };
  }, [updateArrows, listings]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  if (!loading && listings.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 pb-2 md:px-8 md:pt-8">
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-tangerine/15 text-tangerine">
            <Star className="size-4" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-semibold tracking-tight text-basalt md:text-xl">
            주목할 매물
          </h2>
          {isFallback ? (
            <Badge variant="outline" className="border-stone/60 text-[10px] text-muted-foreground">
              최신 추천
            </Badge>
          ) : isPadded ? null : (
            <Badge className="border-transparent bg-tangerine/90 text-[10px] text-tangerine-foreground">
              <Sparkles className="size-2.5" aria-hidden="true" /> 광고
            </Badge>
          )}
        </div>
        {/* 화살표 */}
        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            disabled={!canPrev}
            aria-label="이전"
            className="flex size-8 items-center justify-center rounded-full border border-stone/50 bg-background text-basalt transition disabled:opacity-30 hover:enabled:border-sea hover:enabled:text-sea"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            disabled={!canNext}
            aria-label="다음"
            className="flex size-8 items-center justify-center rounded-full border border-stone/50 bg-background text-basalt transition disabled:opacity-30 hover:enabled:border-sea hover:enabled:text-sea"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </header>

      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-thin pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[16/10] w-[78%] shrink-0 snap-start animate-pulse rounded-2xl bg-muted sm:w-[calc((100%-2rem)/3)]"
              />
            ))
          : listings.map((l) => (
              <FeaturedCard key={l.id} listing={l} onOpen={onOpen} />
            ))}
      </div>
    </section>
  );
}

function FeaturedCard({ listing, onOpen }: { listing: Listing; onOpen: (id: string) => void }) {
  const [err, setErr] = useState(false);
  const pin = PROPERTY_PIN[listing.propertyType] ?? PROPERTY_PIN["기타"];
  const thumb =
    listing.thumbnailUrl ||
    (listing.images && listing.images.length > 0 ? listing.images[0] : "");

  return (
    <button
      type="button"
      onClick={() => onOpen(listing.id)}
      className="group relative aspect-[16/10] w-[78%] shrink-0 snap-start overflow-hidden rounded-2xl border border-stone/50 bg-card text-left shadow-sm transition hover:shadow-lg sm:w-[calc((100%-2rem)/3)]"
    >
      {thumb && !err ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={listing.title}
          loading="lazy"
          onError={() => setErr(true)}
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sea/30 to-paper text-4xl">
          {pin.emoji}
        </div>
      )}
      {/* 어둡게 오버레이 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      {/* 상단 배지 */}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
        <Badge
          className="border-transparent px-1.5 py-0 text-[11px] text-white shadow-sm"
          style={{ backgroundColor: pin.color }}
        >
          <span aria-hidden="true">{pin.emoji}</span>
          {pin.label}
        </Badge>
        {listing.dealType ? (
          <Badge className="border-transparent bg-background/85 px-1.5 py-0 text-[11px] text-basalt">
            {listing.dealType}
          </Badge>
        ) : null}
      </div>

      {/* 하단 정보 */}
      <div className="absolute inset-x-0 bottom-0 p-3 text-white">
        <p className="line-clamp-1 text-sm font-semibold drop-shadow">{listing.title}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-lg font-bold drop-shadow">
            {formatPrice(listing.priceManwon, listing.priceText)}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] text-white/90">
            <MapPin className="size-3" aria-hidden="true" />
            {listing.region}
          </span>
        </div>
        {listing.agent?.channelName ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] text-white/70">
            {listing.agent.office || listing.agent.channelName}
          </p>
        ) : null}
      </div>
    </button>
  );
}

export default FeaturedBanner;
