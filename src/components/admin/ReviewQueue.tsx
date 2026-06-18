"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  Clock,
  Inbox,
  Layers,
  ListChecks,
  MapPin,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
  XSquare,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { ListingEditPanel } from "./ListingEditPanel";
import { canPublishClient, fmtManwon, fmtTimeAgo } from "./lib/canPublish";
import { STATUS_LABEL, STATUS_COLOR } from "@/lib/types";
import type { Listing } from "@/lib/types";

interface ReviewQueueProps {
  onGoToCollection?: () => void;
}

type SortOption = "confidence_asc" | "latest" | "region";

export function ReviewQueue({ onGoToCollection }: ReviewQueueProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sort, setSort] = useState<SortOption>("confidence_asc");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [batchOpen, setBatchOpen] = useState<null | "approve" | "reject">(null);
  const [forcePublish, setForcePublish] = useState(false);

  // 드래프트 매물 + 에러 매물 (재시도 대상)
  const { data, isLoading, isFetching } = useQuery<{ listings: Listing[]; total: number }>({
    queryKey: ["listings", "review", sort, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("status", "draft");
      params.set("limit", "200");
      if (search) params.set("q", search);
      const res = await fetch(`/api/listings?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const listings = useMemo(() => {
    const list = data?.listings ?? [];
    const sorted = [...list];
    if (sort === "confidence_asc") {
      sorted.sort((a, b) => a.confidence - b.confidence);
    } else if (sort === "region") {
      sorted.sort((a, b) => a.region.localeCompare(b.region, "ko"));
    } else {
      // latest
      sorted.sort(
        (a, b) =>
          new Date(b.collectedAt).getTime() - new Date(a.collectedAt).getTime(),
      );
    }
    return sorted;
  }, [data, sort]);

  const selected = listings.find((l) => l.id === selectedId) ?? null;

  // 일괄 승인/반려 mutation
  const batchMutation = useMutation({
    mutationFn: async ({
      ids,
      action,
      force,
    }: {
      ids: string[];
      action: "approve" | "reject";
      force?: boolean;
    }) => {
      const results = await Promise.allSettled(
        ids.map(async (id) => {
          const res = await fetch(`/api/listings/${id}/action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, force }),
          });
          if (!res.ok) {
            const d = await res.json().catch(() => ({}));
            throw new Error(d.error || "failed");
          }
          return res.json();
        }),
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.filter((r) => r.status === "rejected").length;
      return { ok, fail };
    },
    onSuccess: ({ ok, fail }, vars) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: vars.action === "approve" ? "일괄 승인 완료" : "일괄 반려 완료",
        description: `성공 ${ok}건${fail > 0 ? ` · 실패 ${fail}건 (게시 게이트 미충족 가능)` : ""}`,
      });
      setChecked(new Set());
      setBatchOpen(null);
      if (selectedId && vars.ids.includes(selectedId)) {
        setSelectedId(null);
      }
    },
  });

  const onApproveOne = (id: string) => {
    setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  };
  const onRejectOne = (id: string) => {
    setSelectedId(null);
    queryClient.invalidateQueries({ queryKey: ["listings"] });
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBatch = async () => {
    if (!batchOpen || checked.size === 0) return;
    await batchMutation.mutateAsync({
      ids: Array.from(checked),
      action: batchOpen,
      force: batchOpen === "approve" ? forcePublish : false,
    });
    setForcePublish(false);
  };

  const checkedCount = checked.size;

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="border-b border-stone/40 px-4 sm:px-6 py-4 bg-paper/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-basalt flex items-center gap-2">
              검수 큐
              <Badge variant="outline" className="ml-1 text-tangerine border-tangerine/40">
                {listings.length}건 대기
              </Badge>
            </h1>
            <p className="text-sm text-muted-jeju mt-0.5">
              AI 구조화된 드래프트 매물 검수 · 인라인 수정 · 게시 게이트 검증
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="confidence_asc">신뢰도↑</SelectItem>
                <SelectItem value="latest">신규순</SelectItem>
                <SelectItem value="region">지역순</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["listings", "review"] })
              }
              aria-label="새로고침"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {/* 검색 + 일괄 액션 */}
        <div className="flex items-center gap-2 mt-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-jeju" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="제목/주소/지역 검색"
              className="pl-8"
            />
          </div>
          {checkedCount > 0 && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-sea/10 text-sea border-sea/30">
                <CheckSquare className="size-3" />
                {checkedCount}건 선택
              </Badge>
              <Button
                size="sm"
                onClick={() => setBatchOpen("approve")}
                disabled={batchMutation.isPending}
                className="bg-tangerine hover:bg-tangerine/90 text-tangerine-foreground"
              >
                <ThumbsUp className="size-3.5" /> 일괄 승인
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBatchOpen("reject")}
                disabled={batchMutation.isPending}
                className="text-destructive hover:text-destructive"
              >
                <ThumbsDown className="size-3.5" /> 일괄 반려
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setChecked(new Set())}
                aria-label="선택 해제"
              >
                <X className="size-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* 본문: 좌측 리스트 + 우측 편집 패널 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 좌측 리스트 */}
        <div className="w-full lg:w-[400px] lg:border-r border-stone/40 lg:shrink-0 overflow-y-auto scroll-thin">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState onGoToCollection={onGoToCollection} />
          ) : (
            <div className="p-3 space-y-2">
              {listings.map((listing) => (
                <DraftCard
                  key={listing.id}
                  listing={listing}
                  selected={selectedId === listing.id}
                  checked={checked.has(listing.id)}
                  onToggleCheck={() => toggleCheck(listing.id)}
                  onSelect={() => setSelectedId(listing.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 우측 편집 패널 (데스크탑) */}
        <div className="hidden lg:flex flex-1 overflow-hidden p-3 bg-paper/20">
          {selected ? (
            <ListingEditPanel
              listing={selected}
              onClose={() => setSelectedId(null)}
              onApprove={onApproveOne}
              onReject={onRejectOne}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-jeju gap-3">
              <Inbox className="size-12 opacity-40" />
              <p className="text-sm">
                좌측에서 매물을 선택해 인라인 수정하세요.
              </p>
              <p className="text-xs text-stone max-w-xs text-center">
                게시 게이트: 중개사 검증 · 가격 · 면적 · 주소 · 신뢰도 0.5↑
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 모바일 편집 패널 — Sheet 대신 풀스크린 오버레이로 단순화 */}
      {selected && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background overflow-y-auto scroll-thin">
          <div className="sticky top-0 flex items-center justify-between p-3 border-b border-stone/40 bg-background">
            <span className="text-sm font-medium">매물 검수</span>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setSelectedId(null)}
              aria-label="닫기"
            >
              <X className="size-4" />
            </Button>
          </div>
          <div className="p-3 h-[calc(100vh-60px)]">
            <ListingEditPanel
              listing={selected}
              onClose={() => setSelectedId(null)}
              onApprove={onApproveOne}
              onReject={onRejectOne}
            />
          </div>
        </div>
      )}

      {/* 일괄 처리 확인 다이얼로그 */}
      <AlertDialog open={batchOpen !== null} onOpenChange={(o) => !o && setBatchOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {batchOpen === "approve" ? "일괄 승인·게시" : "일괄 반려"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {batchOpen === "approve"
                ? forcePublish
                  ? `선택한 ${checkedCount}건을 게이트 무시하고 강제 게시합니다.`
                  : `선택한 ${checkedCount}건을 게시합니다. 게시 게이트 미충족 건은 자동 실패합니다.`
                : `선택한 ${checkedCount}건을 반려합니다. 복구하려면 다시 검수 큐로 이동해야 합니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {batchOpen === "approve" ? (
            <label className="flex items-center justify-between rounded-md border border-stone/50 bg-paper/40 px-3 py-2">
              <span className="text-sm">
                <span className="font-medium text-basalt">게이트 무시(강제 게시)</span>
                <span className="block text-xs text-muted-foreground">
                  중개사 미검증·가격/면적/주소 누락이어도 그대로 게시
                </span>
              </span>
              <Switch checked={forcePublish} onCheckedChange={setForcePublish} />
            </label>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBatch}
              disabled={batchMutation.isPending}
              className={
                batchOpen === "approve"
                  ? "bg-tangerine hover:bg-tangerine/90 text-tangerine-foreground"
                  : "bg-destructive text-white hover:bg-destructive/90"
              }
            >
              {batchMutation.isPending ? "처리 중..." : "확인"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DraftCard({
  listing,
  selected,
  checked,
  onToggleCheck,
  onSelect,
}: {
  listing: Listing;
  selected: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  onSelect: () => void;
}) {
  const gate = canPublishClient(listing);
  const conf = listing.confidence;
  const confColor = conf >= 0.7 ? "#176b6b" : conf >= 0.5 ? "#e2702a" : "#c0392b";

  return (
    <Card
      className={`overflow-hidden cursor-pointer transition-all ${
        selected
          ? "ring-2 ring-sea border-sea"
          : "hover:border-sea/50"
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* 체크박스 */}
          <div onClick={(e) => e.stopPropagation()} className="pt-1">
            <Checkbox checked={checked} onCheckedChange={onToggleCheck} aria-label={`${listing.title} 선택`} />
          </div>
          {/* 썸네일 */}
          <div className="relative w-24 aspect-video rounded overflow-hidden bg-paper shrink-0">
            <img
              src={listing.thumbnailUrl}
              alt={listing.title}
              className="w-full h-full object-cover"
            />
            <span className="absolute top-0.5 left-0.5">
              <Badge
                variant="outline"
                className={`text-[9px] py-0 px-1 ${
                  listing.extractionSource === "ai"
                    ? "bg-sea text-sea-foreground border-sea"
                    : "bg-tangerine text-tangerine-foreground border-tangerine"
                }`}
              >
                {listing.extractionSource === "ai" ? "AI" : "폴백"}
              </Badge>
            </span>
          </div>
          {/* 본문 */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-basalt line-clamp-2 leading-snug">
              {listing.title}
            </p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-sm font-bold text-basalt">
                {listing.priceManwon > 0 ? fmtManwon(listing.priceManwon) : "가격미정"}
              </span>
              <span className="text-[10px] text-muted-jeju">·</span>
              <span className="text-[11px] text-muted-jeju">{listing.propertyType}</span>
              <span className="text-[10px] text-muted-jeju">·</span>
              <span className="text-[11px] text-muted-jeju">{listing.dealType}</span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 text-[11px] text-muted-jeju">
              <MapPin className="size-3" />
              <span className="truncate">{listing.region} · {listing.addressText.slice(0, 24)}</span>
            </div>
            {/* confidence 바 */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <div className="flex-1 h-1 rounded-full bg-paper overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.round(conf * 100)}%`,
                    backgroundColor: confColor,
                  }}
                />
              </div>
              <span className="text-[10px] font-mono font-semibold" style={{ color: confColor }}>
                {Math.round(conf * 100)}%
              </span>
            </div>
          </div>
        </div>
        {/* 게이트 표시 */}
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          {gate.ok ? (
            <Badge variant="outline" className="border-sea/40 text-sea text-[10px]">
              <CheckCircle2 className="size-3" /> 게시가능
            </Badge>
          ) : (
            <>
              <Badge variant="outline" className="border-tangerine/40 text-tangerine text-[10px]">
                <ShieldAlert className="size-3" /> 미충족
              </Badge>
              {gate.reasons.slice(0, 2).map((r) => (
                <span key={r} className="text-[10px] text-tangerine">
                  · {r}
                </span>
              ))}
              {gate.reasons.length > 2 && (
                <span className="text-[10px] text-muted-jeju">
                  +{gate.reasons.length - 2}
                </span>
              )}
            </>
          )}
          <span className="text-[10px] text-muted-jeju ml-auto">
            {fmtTimeAgo(listing.collectedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ onGoToCollection }: { onGoToCollection?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="rounded-full bg-paper p-4 mb-3">
        <Inbox className="size-10 text-stone" />
      </div>
      <h3 className="text-base font-semibold text-basalt">
        검수 대기 매물이 없습니다
      </h3>
      <p className="text-sm text-muted-jeju mt-1 max-w-xs">
        수집 콘솔에서 새 매물을 가져오거나, 자동 크론(08:00 KST)을 기다려주세요.
      </p>
      {onGoToCollection && (
        <Button
          className="mt-4 bg-tangerine hover:bg-tangerine/90 text-tangerine-foreground"
          onClick={onGoToCollection}
        >
          <Sparkles className="size-4" /> 수집 콘솔로 이동
        </Button>
      )}
    </div>
  );
}
