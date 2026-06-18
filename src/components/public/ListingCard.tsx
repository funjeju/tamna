"use client";
// TamnaIndex — PRD 11.2 썸네일 카드 (공개 사이트 표현 단위)
import { useState, useCallback } from "react";
import {
  Heart,
  MapPin,
  PlayCircle,
  BadgeCheck,
  TrendingDown,
  Radio,
  Clock,
  BookOpen,
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PROPERTY_PIN } from "@/lib/regions";
import type { Listing } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import {
  formatArea,
  formatPrice,
  formatRelativeTime,
  hasPriceDrop,
  isJustPublished,
  lastPriceDrop,
  toggleFavorite,
} from "@/lib/public/format";
import { cn } from "@/lib/utils";

interface ListingCardProps {
  listing: Listing;
  onOpen: (id: string) => void;
  onFavoriteChange?: () => void;
  onHighlight?: (id: string | null) => void;
}

export function ListingCard({ listing, onOpen, onFavoriteChange, onHighlight }: ListingCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [favState, setFavState] = useState<boolean>(!!listing.isFavorited);
  const { toast } = useToast();

  const pin = PROPERTY_PIN[listing.propertyType] ?? PROPERTY_PIN["기타"];
  const just = isJustPublished(listing);
  const dropped = hasPriceDrop(listing);
  const drop = dropped ? lastPriceDrop(listing) : null;

  const handleFav = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (favBusy) return;
      setFavBusy(true);
      try {
        const res = await toggleFavorite(listing.id);
        setFavState(res.favorited);
        toast({
          title: res.favorited ? "찜했습니다" : "찜을 해제했습니다",
        });
        onFavoriteChange?.();
      } catch {
        toast({
          title: "찜 처리 실패",
          description: "잠시 후 다시 시도해주세요.",
          variant: "destructive",
        });
      } finally {
        setFavBusy(false);
      }
    },
    [favBusy, listing.id, onFavoriteChange, toast],
  );

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      onClick={() => onOpen(listing.id)}
      onMouseEnter={() => onHighlight?.(listing.id)}
      onMouseLeave={() => onHighlight?.(null)}
      onFocus={() => onHighlight?.(listing.id)}
      onBlur={() => onHighlight?.(null)}
      role="button"
      tabIndex={0}
      aria-label={`${listing.title} 매물 카드, 클릭하여 상세 보기`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(listing.id);
        }
      }}
      className={cn(
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/60",
        listing.sourceType === "blog"
          ? "border-l-[3px] border-l-emerald-500 border-stone/60"
          : "border-l-[3px] border-l-red-500 border-stone/60",
      )}
    >
      {/* 썸네일 16:9 */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {!imgLoaded && !imgError && <Skeleton className="absolute inset-0" />}
        {listing.thumbnailUrl && !imgError ? (
          <img
            src={listing.thumbnailUrl}
            alt={`${listing.title} 썸네일`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-paper to-muted text-muted-foreground">
            <PlayCircle className="size-10 opacity-30" />
          </div>
        )}

        {/* 좌상단 유형 배지 */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <Badge
            className="border-transparent px-1.5 py-0 text-[11px] text-white shadow-sm"
            style={{ backgroundColor: pin.color }}
          >
            <span aria-hidden="true">{pin.emoji}</span>
            {pin.label}
          </Badge>
          {dropped && drop ? (
            <Badge className="border-transparent bg-tangerine px-1.5 py-0 text-[11px] text-tangerine-foreground shadow-sm">
              <TrendingDown className="size-3" aria-hidden="true" />
              인하
            </Badge>
          ) : null}
        </div>

        {/* 우상단 찜 버튼 */}
        <button
          type="button"
          aria-label={favState ? "찜 해제" : "찜하기"}
          aria-pressed={favState}
          onClick={handleFav}
          disabled={favBusy}
          className={cn(
            "absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-background/85 backdrop-blur transition hover:bg-background",
            favState ? "text-tangerine" : "text-muted-foreground",
          )}
        >
          <Heart className={cn("size-4", favState && "fill-current")} aria-hidden="true" />
        </button>

        {/* 좌하단 소스 배지 or 방금 게시 */}
        {just ? (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-basalt/85 px-2 py-0.5 text-[10px] font-medium text-paper backdrop-blur">
            <Radio className="size-3 text-tangerine" aria-hidden="true" />
            방금 게시
          </div>
        ) : (
          <div
            className={cn(
              "absolute bottom-2 left-2 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur",
              listing.sourceType === "blog" ? "bg-emerald-600/90" : "bg-red-600/90",
            )}
          >
            {listing.sourceType === "blog" ? (
              <BookOpen className="size-3" aria-hidden="true" />
            ) : (
              <PlayCircle className="size-3" aria-hidden="true" />
            )}
            {listing.sourceType === "blog" ? "블로그" : "유튜브"}
          </div>
        )}

        {/* 우하단 유튜브 업로드 경과 시간 (강조) */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1 rounded-full bg-basalt/85 px-2 py-0.5 text-[11px] font-semibold text-paper backdrop-blur">
          <Clock className="size-3 text-sea-foreground" aria-hidden="true" />
          {formatRelativeTime(listing.publishedAt)}
        </div>
      </div>

      {/* 본문 — 최소 정보, 컴팩트 */}
      <div className="flex flex-col gap-1 p-2.5">
        <h3 className="line-clamp-1 text-[13px] font-medium leading-snug text-basalt">
          {listing.title}
        </h3>

        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-base font-bold text-basalt tabular">
            {formatPrice(listing.priceManwon, listing.priceText)}
          </span>
          {listing.dealType ? (
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {listing.dealType}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {listing.areaPyeong ? (
            <span className="font-mono tabular">{formatArea(listing.areaPyeong)}</span>
          ) : null}
          <span className="inline-flex items-center gap-0.5 text-tangerine">
            <MapPin className="size-3" aria-hidden="true" />
            {listing.region}
          </span>
          {listing.agent?.verified ? (
            <BadgeCheck className="size-3 text-sea" aria-label="검증된 중개사" />
          ) : null}
          {listing.agent?.channelName ? (
            <span className="ml-auto truncate text-muted-foreground/80">
              {listing.agent.channelName}
            </span>
          ) : null}
        </div>
      </div>
    </motion.article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-stone/60 bg-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-2 p-2.5">
        <Skeleton className="h-3.5 w-5/6" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export default ListingCard;
