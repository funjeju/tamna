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
} from "lucide-react";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
}

export function ListingCard({ listing, onOpen, onFavoriteChange }: ListingCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
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
          description: res.favorited
            ? "마이 페이지에서 저장한 매물을 볼 수 있어요."
            : undefined,
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
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      onClick={() => onOpen(listing.id)}
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
        "group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-stone/60 bg-card shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sea/60",
      )}
    >
      {/* 게시 상태 좌측 3px 바 (공개 사이트는 published만 노출되지만 일관성 유지) */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-0 left-0 z-20 h-full w-[3px]",
          listing.status === "published" ? "bg-tangerine" : "bg-stone/60",
        )}
      />

      {/* 썸네일 16:9 */}
      <div className="relative aspect-video w-full overflow-hidden bg-muted">
        {!imgLoaded && <Skeleton className="absolute inset-0" />}
        {listing.thumbnailUrl ? (
          <img
            src={listing.thumbnailUrl}
            alt={`${listing.title} 썸네일`}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            className={cn(
              "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]",
              imgLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-paper to-muted text-muted-foreground">
            <PlayCircle className="size-10 opacity-40" />
          </div>
        )}

        {/* 좌상단 유형 배지 */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <Badge
            className="border-transparent text-white shadow-sm"
            style={{ backgroundColor: pin.color }}
          >
            <span aria-hidden="true">{pin.emoji}</span>
            {pin.label}
          </Badge>
        </div>

        {/* 우상단 가격인하 뱃지 */}
        {dropped && drop ? (
          <div className="absolute top-2 right-2">
            <Badge className="border-transparent bg-tangerine text-tangerine-foreground shadow-sm">
              <TrendingDown className="size-3" aria-hidden="true" />
              ↓인하
            </Badge>
          </div>
        ) : null}

        {/* 좌하단 방금 게시 라이브 닷 */}
        {just ? (
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 rounded-full bg-basalt/85 px-2 py-0.5 text-[11px] font-medium text-paper backdrop-blur">
            <span className="live-dot size-1.5 rounded-full bg-tangerine" />
            <Radio className="size-3 text-tangerine" aria-hidden="true" />
            방금 게시
          </div>
        ) : null}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-basalt">
          {listing.title}
        </h3>

        <div className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-basalt tabular">
            {formatPrice(listing.priceManwon, listing.priceText)}
          </span>
          {listing.dealType ? (
            <Badge
              variant="outline"
              className="border-stone/60 text-muted-foreground"
            >
              {listing.dealType}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {listing.areaPyeong ? (
            <span className="font-mono tabular">{formatArea(listing.areaPyeong)}</span>
          ) : null}
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1 text-tangerine">
            <MapPin className="size-3" aria-hidden="true" />
            {listing.region}
          </span>
          {drop && drop.diff > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-tangerine tabular">
                {drop.diff.toLocaleString("ko-KR")}만 ↓
              </span>
            </>
          ) : null}
        </div>

        {/* 키워드 해시 */}
        {listing.keywords?.length ? (
          <div className="flex flex-wrap gap-1">
            {listing.keywords.slice(0, 4).map((k) => (
              <span
                key={k}
                className="rounded-sm bg-paper px-1.5 py-0.5 text-[11px] text-muted-jeju"
              >
                #{k}
              </span>
            ))}
          </div>
        ) : null}

        {/* 하단 중개사 + 영상/찜 */}
        <div className="mt-auto flex items-center justify-between border-t border-stone/40 pt-3 text-[11px] text-muted-foreground">
          <div className="flex min-w-0 items-center gap-1">
            <span className="truncate">
              {listing.agent?.channelName ?? "중개사 미상"}
            </span>
            {listing.agent?.verified ? (
              <BadgeCheck
                className="size-3.5 shrink-0 text-sea"
                aria-label="검증된 중개사"
              />
            ) : null}
          </div>
          <span>{formatRelativeTime(listing.publishedAt2 ?? listing.publishedAt)}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-sea hover:bg-sea/10 hover:text-sea"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(listing.id);
            }}
          >
            <PlayCircle className="size-4" aria-hidden="true" />
            영상 보기
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label={favState ? "찜 해제" : "찜하기"}
            aria-pressed={favState}
            onClick={handleFav}
            disabled={favBusy}
            className={cn(
              "size-9 shrink-0 border-stone/60",
              favState
                ? "border-tangerine text-tangerine hover:bg-tangerine/10"
                : "text-muted-foreground",
            )}
          >
            <Heart
              className={cn("size-4", favState && "fill-current")}
              aria-hidden="true"
            />
          </Button>
        </div>
      </div>
    </motion.article>
  );
}

export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-stone/60 bg-card">
      <Skeleton className="aspect-video w-full rounded-none" />
      <div className="space-y-3 p-4">
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="size-8" />
        </div>
      </div>
    </div>
  );
}

export default ListingCard;
