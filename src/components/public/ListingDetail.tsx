"use client";
// TamnaIndex — 매물 상세 모달 (PRD 9.3)
import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Heart,
  Link2,
  MapPin,
  Phone,
  PlayCircle,
  Share2,
  ShoppingBag,
  Square,
  TrendingDown,
  Youtube,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Listing } from "@/lib/types";
import {
  HALLASAN,
  JEJU_OUTLINE_PATH,
  latLngToSvg,
  PROPERTY_PIN,
} from "@/lib/regions";
import {
  formatArea,
  formatAreaM2,
  formatPrice,
  formatRelativeTime,
  hasPriceDrop,
  isJustPublished,
  lastPriceDrop,
  toggleFavorite,
} from "@/lib/public/format";
import { cn } from "@/lib/utils";

interface ListingDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: Listing | null;
  loading?: boolean;
  onFavoriteChange?: () => void;
}

export function ListingDetail({
  open,
  onOpenChange,
  listing,
  loading,
  onFavoriteChange,
}: ListingDetailProps) {
  const [fav, setFav] = useState<boolean>(!!listing?.isFavorited);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  // listing 변경 시 fav/notify 상태 동기화
  useEffect(() => {
    setFav(!!listing?.isFavorited);
    setNotify(false);
  }, [listing?.id, listing?.isFavorited]);

  const handleFav = useCallback(async () => {
    if (!listing) return;
    setBusy(true);
    try {
      const res = await toggleFavorite(listing.id, notify);
      setFav(res.favorited);
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
      setBusy(false);
    }
  }, [listing, notify, onFavoriteChange, toast]);

  const handleReserve = useCallback(() => {
    toast({
      title: "원격 임장 예약이 접수되었습니다",
      description: "중개사가 24시간 내 연락합니다. (데모)",
    });
  }, [toast]);

  const handleShare = useCallback(async () => {
    if (!listing) return;
    const url = `${window.location.origin}/?listing=${listing.id}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      toast({ title: "공유 링크 복사", description: url });
    } catch {
      toast({ title: "공유 링크", description: url });
    }
  }, [listing, toast]);

  if (loading || !listing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-hidden">
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="aspect-video w-full" />
            <div className="space-y-3 p-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const pin = PROPERTY_PIN[listing.propertyType] ?? PROPERTY_PIN["기타"];
  const just = isJustPublished(listing);
  const dropped = hasPriceDrop(listing);
  const drop = dropped ? lastPriceDrop(listing) : null;
  const pt = listing.lat && listing.lng ? latLngToSvg(listing.lat, listing.lng) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl gap-0 overflow-y-auto p-0 scroll-thin">
        <DialogHeader className="space-y-2 border-b border-stone/40 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className="border-transparent text-white"
              style={{ backgroundColor: pin.color }}
            >
              <span aria-hidden="true">{pin.emoji}</span>
              {pin.label}
            </Badge>
            {listing.dealType ? (
              <Badge variant="outline" className="border-stone/60">
                {listing.dealType}
              </Badge>
            ) : null}
            {just ? (
              <Badge className="border-transparent bg-tangerine text-tangerine-foreground">
                <span className="live-dot size-1.5 rounded-full bg-tangerine-foreground" />
                방금 게시
              </Badge>
            ) : null}
            {dropped ? (
              <Badge className="border-transparent bg-tangerine/90 text-tangerine-foreground">
                <TrendingDown className="size-3" aria-hidden="true" />
                가격인하
              </Badge>
            ) : null}
          </div>
          <DialogTitle className="text-lg leading-snug font-semibold text-basalt md:text-xl">
            {listing.title}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-tangerine">
              <MapPin className="size-3" aria-hidden="true" />
              {listing.region}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3" aria-hidden="true" />
              {formatRelativeTime(listing.publishedAt2 ?? listing.publishedAt)} 게시
            </span>
            {listing.agent?.channelName ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1">
                  <Youtube className="size-3" aria-hidden="true" />
                  {listing.agent.channelName}
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 md:grid-cols-2">
          {/* 좌측 — 유튜브 임베드 */}
          <div className="flex flex-col gap-2 p-5">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-stone/60 bg-black">
              {listing.videoId ? (
                <iframe
                  src={`https://www.youtube.com/embed/${listing.videoId}`}
                  title={`${listing.title} 영상`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 h-full w-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <PlayCircle className="size-12 opacity-50" />
                </div>
              )}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              ※ 본 영상은 YouTube 공개 영상을 임베드 방식으로만 재생합니다.
              재호스팅하지 않으며, 모든 저작권은 원 채널 소유자에게 있습니다.
            </p>

            {/* 미니 지도 */}
            <div className="mt-3 overflow-hidden rounded-lg border border-stone/60 bg-gradient-to-br from-sea/5 to-paper">
              <svg viewBox="0 0 1000 620" className="block h-44 w-full">
                <rect x="0" y="0" width="1000" height="620" fill="#eef0ec" />
                <path
                  d={JEJU_OUTLINE_PATH}
                  fill="#ffffff"
                  stroke="#b9c2bd"
                  strokeWidth="2"
                />
                <circle
                  cx={HALLASAN.x}
                  cy={HALLASAN.y}
                  r={HALLASAN.r}
                  fill="none"
                  stroke="#5d665f"
                  strokeOpacity="0.4"
                  strokeWidth="1.4"
                  strokeDasharray="3 3"
                />
                {pt ? (
                  <>
                    <circle cx={pt.x} cy={pt.y} r="18" fill={pin.color} fillOpacity="0.18" />
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="9"
                      fill={pin.color}
                      stroke="#fff"
                      strokeWidth="2"
                    />
                  </>
                ) : null}
              </svg>
              <div className="flex items-center justify-between border-t border-stone/40 bg-paper/60 px-3 py-1.5 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" aria-hidden="true" />
                  {listing.addressText || listing.region}
                </span>
                {listing.lat && listing.lng ? (
                  <span className="font-mono tabular text-muted-foreground">
                    {listing.lat.toFixed(4)}, {listing.lng.toFixed(4)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* 우측 — 정보 + CTA */}
          <div className="space-y-5 border-t border-stone/40 p-5 md:border-l md:border-t-0">
            {/* 가격 */}
            <section>
              <div className="flex items-end gap-2">
                <span className="font-mono text-3xl font-bold text-basalt tabular">
                  {formatPrice(listing.priceManwon, listing.priceText)}
                </span>
                {listing.dealType ? (
                  <Badge variant="outline" className="mb-1 border-stone/60">
                    {listing.dealType}
                  </Badge>
                ) : null}
              </div>
              {drop && drop.diff > 0 ? (
                <p className="mt-1 text-xs text-tangerine">
                  이전{" "}
                  <span className="font-mono tabular">
                    {drop.from.toLocaleString("ko-KR")}만원
                  </span>{" "}
                  → 현재{" "}
                  <span className="font-mono tabular">
                    {drop.to.toLocaleString("ko-KR")}만원
                  </span>{" "}
                  ({drop.diff.toLocaleString("ko-KR")}만원 인하)
                </p>
              ) : null}
              {listing.priceHistory && listing.priceHistory.length > 1 ? (
                <details className="mt-2 text-xs text-muted-foreground">
                  <summary className="cursor-pointer hover:text-basalt">
                    가격 이력 {listing.priceHistory.length}건 보기
                  </summary>
                  <ul className="mt-1 space-y-0.5 font-mono tabular">
                    {[...listing.priceHistory]
                      .sort(
                        (a, b) =>
                          new Date(b.at).getTime() - new Date(a.at).getTime(),
                      )
                      .map((h, i) => (
                        <li key={i}>
                          {new Date(h.at).toLocaleDateString("ko-KR")} ·{" "}
                          {h.manwon.toLocaleString("ko-KR")}만원
                        </li>
                      ))}
                  </ul>
                </details>
              ) : null}
            </section>

            <Separator />

            {/* 표준 필드 표 */}
            <section className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field
                label="유형"
                value={listing.propertyType}
                icon={<Building2 className="size-3.5" aria-hidden="true" />}
              />
              <Field
                label="거래"
                value={listing.dealType}
                icon={<ShoppingBag className="size-3.5" aria-hidden="true" />}
              />
              <Field
                label="면적(㎡)"
                value={formatAreaM2(listing.areaM2)}
                mono
                icon={<Square className="size-3.5" aria-hidden="true" />}
              />
              <Field
                label="면적(평)"
                value={formatArea(listing.areaPyeong)}
                mono
                icon={<Square className="size-3.5" aria-hidden="true" />}
              />
              <Field
                label="용도지역"
                value={listing.zoning ?? "미확인"}
              />
              <Field
                label="주소"
                value={listing.addressText || listing.region}
                colSpan
              />
            </section>

            {/* 요약 */}
            {listing.summary ? (
              <section className="space-y-1">
                <h4 className="text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                  요약
                </h4>
                <p className="text-sm leading-relaxed text-basalt">
                  {listing.summary}
                </p>
              </section>
            ) : null}

            {/* 하이라이트 */}
            {listing.highlights?.length ? (
              <section className="space-y-1.5">
                <h4 className="text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                  하이라이트
                </h4>
                <ul className="flex flex-wrap gap-1.5">
                  {listing.highlights.map((h) => (
                    <Badge
                      key={h}
                      className="border-transparent bg-sea/10 text-sea"
                    >
                      {h}
                    </Badge>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* 키워드 */}
            {listing.keywords?.length ? (
              <section className="space-y-1.5">
                <h4 className="text-xs font-semibold tracking-wide text-muted-jeju uppercase">
                  영상 키워드
                </h4>
                <div className="flex flex-wrap gap-1">
                  {listing.keywords.map((k) => (
                    <span
                      key={k}
                      className="rounded-sm bg-paper px-1.5 py-0.5 text-[11px] text-muted-jeju"
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}

            {/* 중개사 카드 */}
            {listing.agent ? (
              <section className="rounded-lg border border-stone/60 bg-paper/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Youtube className="size-4 text-tangerine" aria-hidden="true" />
                      <span className="truncate font-semibold text-basalt">
                        {listing.agent.channelName}
                      </span>
                      {listing.agent.verified ? (
                        <BadgeCheck
                          className="size-4 shrink-0 text-sea"
                          aria-label="검증된 중개사"
                        />
                      ) : null}
                    </div>
                    {listing.agent.name ? (
                      <p className="text-xs text-muted-foreground">
                        {listing.agent.name}
                        {listing.agent.regNo ? ` · ${listing.agent.regNo}` : ""}
                      </p>
                    ) : null}
                    {listing.agent.office ? (
                      <p className="text-xs text-muted-foreground">
                        {listing.agent.office}
                      </p>
                    ) : null}
                    {listing.agent.expertise ? (
                      <p className="text-xs text-muted-jeju">
                        전문: {listing.agent.expertise}
                      </p>
                    ) : null}
                    {listing.agent.phone ? (
                      <p className="flex items-center gap-1 font-mono text-xs tabular text-basalt">
                        <Phone className="size-3" aria-hidden="true" />
                        {listing.agent.phone}
                      </p>
                    ) : null}
                  </div>
                  {listing.agent.channelUrl ? (
                    <a
                      href={listing.agent.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-sea/50 text-sea"
                      >
                        <Link2 className="size-3.5" aria-hidden="true" />
                        채널 방문
                      </Button>
                    </a>
                  ) : null}
                </div>
              </section>
            ) : null}

            {/* CTA — 원격 임장 예약 */}
            <section className="space-y-2">
              <Button
                onClick={handleReserve}
                size="lg"
                className="h-12 w-full bg-tangerine text-tangerine-foreground hover:bg-tangerine/90"
              >
                <PlayCircle className="size-4" aria-hidden="true" />
                원격 임장 예약
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={fav ? "default" : "outline"}
                    onClick={handleFav}
                    disabled={busy}
                    aria-pressed={fav}
                    className={cn(
                      fav
                        ? "border-transparent bg-tangerine text-tangerine-foreground hover:bg-tangerine/90"
                        : "border-stone/60",
                    )}
                  >
                    <Heart
                      className={cn("size-4", fav && "fill-current")}
                      aria-hidden="true"
                    />
                    {fav ? "찜됨" : "찜하기"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleShare}
                    className="border-stone/60"
                  >
                    <Share2 className="size-3.5" aria-hidden="true" />
                    공유
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Switch
                    checked={notify}
                    onCheckedChange={setNotify}
                    aria-label="가격인하 알림 설정"
                  />
                  가격인하 알림
                </label>
              </div>
            </section>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  icon,
  mono,
  colSpan,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  mono?: boolean;
  colSpan?: boolean;
}) {
  return (
    <div className={cn("space-y-0.5", colSpan && "col-span-2")}>
      <div className="flex items-center gap-1 text-[11px] tracking-wide text-muted-foreground uppercase">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "text-sm text-basalt",
          mono && "font-mono tabular",
          !value && "text-muted-foreground/60",
        )}
      >
        {value || "—"}
      </div>
    </div>
  );
}

// 작은 훅 — listingId가 바뀌면 side effect 실행
// (useStateSync 제거 — useEffect로 대체)

export default ListingDetail;
