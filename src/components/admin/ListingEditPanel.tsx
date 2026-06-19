"use client";

import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  ExternalLink,
  Eye,
  ImagePlus,
  Link2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Youtube,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { ChipInput } from "./ChipInput";
import { MiniMap } from "./MiniMap";
import {
  canPublishClient,
  m2ToPyeong,
  pyeongToM2,
  fmtManwon,
} from "./lib/canPublish";
import { PROPERTY_TYPES, DEAL_TYPES, THEMES } from "@/lib/types";
import { REGION_NAMES } from "@/lib/regions";
import type {
  Listing,
  PropertyType,
  DealType,
  Theme,
  Agent,
} from "@/lib/types";

interface ListingEditPanelProps {
  listing: Listing;
  onClose?: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

export function ListingEditPanel({
  listing,
  onClose,
  onApprove,
  onReject,
}: ListingEditPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 로컬 폼 상태 (실제 PATCH는 blur/change에서 디바운스 or 명시적 저장)
  // listing이 바뀌면 컴포넌트를 remount시키기 위해 ReviewQueue에서 key={listing.id} 사용 가정.
  // 그렇지 않은 경우를 대비해 listing.id 기준으로 감지하여 리셋.
  const [form, setForm] = useState<Listing>(listing);
  const [lastListingId, setLastListingId] = useState(listing.id);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [thumbnailEdit, setThumbnailEdit] = useState(false);
  const [extraImages, setExtraImages] = useState<string[]>(listing.images ?? []);

  // listing.id가 바뀌면 폼 리셋 (useEffect 없이 동기식 처리)
  if (listing.id !== lastListingId) {
    setLastListingId(listing.id);
    setForm(listing);
    setRejectReason("");
    setRejectOpen(false);
    setThumbnailEdit(false);
    setExtraImages(listing.images ?? []);
  }

  // PATCH mutation
  const patchMutation = useMutation({
    mutationFn: async (payload: Partial<Listing> & { highlights?: string[]; keywords?: string[]; themes?: Theme[] }) => {
      const res = await fetch(`/api/listings/${form.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("patch failed");
      return res.json();
    },
    onMutate: () => setSaving(true),
    onSettled: () => setTimeout(() => setSaving(false), 300),
    onSuccess: (data) => {
      setForm(data.listing);
      queryClient.invalidateQueries({ queryKey: ["listings", "draft"] });
      queryClient.invalidateQueries({ queryKey: ["listings", "all"] });
    },
    onError: () => {
      toast({
        title: "저장 실패",
        description: "잠시 후 다시 시도하세요.",
        variant: "destructive",
      });
    },
  });

  // 액션 mutation (approve/reject/retry)
  const actionMutation = useMutation({
    mutationFn: async (action: string, extra?: Record<string, unknown>) => {
      const res = await fetch(`/api/listings/${form.id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "action failed");
      }
      return data;
    },
    onSuccess: (data, action) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (action === "approve") {
        toast({
          title: "게시 승인 완료",
          description: `${form.title.slice(0, 30)}... 공개 전환`,
        });
        onApprove?.(form.id);
      } else if (action === "reject") {
        toast({
          title: "반려 완료",
          description: `사유: ${rejectReason || "미입력"}`,
        });
        onReject?.(form.id);
      } else if (action === "retry") {
        toast({
          title: "재시도 큐에 추가",
          description: "구조화 재시도가 예약되었습니다.",
        });
      }
    },
    onError: (_err, action) => {
      toast({
        title: action === "approve" ? "승인 불가" : "처리 실패",
        description:
          action === "approve"
            ? "게시 게이트를 충족하지 않았습니다. 필수 필드를 확인하세요."
            : "잠시 후 다시 시도하세요.",
        variant: "destructive",
      });
    },
  });

  // 폼 필드 업데이트 + 자동 저장
  const updateField = useCallback(
    <K extends keyof Listing>(key: K, value: Listing[K]) => {
      const next = { ...form, [key]: value };
      setForm(next);
      // 백엔드에 즉시 PATCH
      patchMutation.mutate({ [key]: value });
    },
    [form, patchMutation],
  );

  // 칩 필드 업데이트
  const updateChips = useCallback(
    (key: "highlights" | "keywords", values: string[]) => {
      const next = { ...form, [key]: values };
      setForm(next);
      patchMutation.mutate({ [key]: values });
    },
    [form, patchMutation],
  );

  const updateThemes = useCallback(
    (themes: string[]) => {
      const next = { ...form, themes: themes as Theme[] };
      setForm(next);
      patchMutation.mutate({ themes: themes as Theme[] });
    },
    [form, patchMutation],
  );

  // 면적 자동 변환
  const onAreaM2Change = (v: number) => {
    const next = { ...form, areaM2: v, areaPyeong: v > 0 ? m2ToPyeong(v) : null };
    setForm(next);
    patchMutation.mutate({ areaM2: v, areaPyeong: next.areaPyeong });
  };
  const onAreaPyeongChange = (v: number) => {
    const next = { ...form, areaPyeong: v, areaM2: v > 0 ? pyeongToM2(v) : null };
    setForm(next);
    patchMutation.mutate({ areaPyeong: v, areaM2: next.areaM2 });
  };

  // 지도 핀 보정
  const onMapChange = (lat: number, lng: number) => {
    const next = { ...form, lat, lng };
    setForm(next);
    patchMutation.mutate({ lat, lng });
  };
  const onMapReset = () => {
    const r = REGION_NAMES.includes(form.region)
      ? null
      : null;
    void r;
    // 읍면동 중심으로 리셋 — 실제 region 명으로 region 데이터에서 lat/lng 찾기
    // (간단히 현재 region 그대로 두되, 사용자에게 알림)
    toast({
      title: "리셋",
      description: "읍면동 중심 좌표는 자동 설정되지 않습니다. 수동으로 드래그하세요.",
    });
  };

  // 가격
  const onPriceManwon = (v: number) => {
    const next = {
      ...form,
      priceManwon: v,
      priceText: v > 0 ? fmtManwon(v) : "",
    };
    setForm(next);
    patchMutation.mutate({ priceManwon: v, priceText: next.priceText });
  };

  // 게시 게이트 검증
  const gate = canPublishClient(form);
  const agent = form.agent;

  const handleApprove = () => {
    if (!gate.ok) {
      toast({
        title: "게시 불가",
        description: gate.reasons.join(", "),
        variant: "destructive",
      });
      return;
    }
    actionMutation.mutate("approve");
  };

  const handleReject = () => {
    actionMutation.mutate("reject", { reason: rejectReason });
    setRejectOpen(false);
  };

  const handleRetry = () => actionMutation.mutate("retry");

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader className="pb-3 border-b border-stone/40">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base line-clamp-2">{form.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <Badge
                variant="outline"
                className={
                  form.extractionSource === "ai"
                    ? "border-sea/40 text-sea"
                    : "border-tangerine/40 text-tangerine"
                }
              >
                <Sparkles className="size-3" />
                {form.extractionSource === "ai" ? "AI 구조화" : "AI 폴백"}
              </Badge>
              <Badge variant="outline" className="text-muted-jeju">
                {form.region}
              </Badge>
              <Badge variant="outline" className="text-muted-jeju">
                {form.propertyType}
              </Badge>
            </div>
          </div>
          {onClose && (
            <Button size="icon" variant="ghost" onClick={onClose} aria-label="닫기">
              <Eye className="size-4" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto scroll-thin space-y-4 p-4">
        {/* 썸네일 + 외부 링크 */}
        <div className="space-y-2">
          {/* 썸네일 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-jeju">썸네일</Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px] text-muted-jeju"
                onClick={() => setThumbnailEdit((v) => !v)}
              >
                {thumbnailEdit ? "미리보기" : "URL 편집"}
              </Button>
            </div>
            {thumbnailEdit ? (
              <div className="flex gap-1.5">
                <Input
                  value={form.thumbnailUrl ?? ""}
                  onChange={(e) => updateField("thumbnailUrl", e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData("text/plain");
                    if (text.startsWith("http")) {
                      e.preventDefault();
                      updateField("thumbnailUrl", text.trim());
                    }
                  }}
                  placeholder="https://... (URL 직접 입력 또는 Ctrl+V)"
                  className="text-xs font-mono"
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="shrink-0 size-9"
                  title="클립보드에서 붙여넣기"
                  onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text.startsWith("http")) updateField("thumbnailUrl", text.trim());
                    } catch { /* permission denied */ }
                  }}
                >
                  <ClipboardPaste className="size-3.5" />
                </Button>
              </div>
            ) : (
              <div
                className="aspect-video rounded-md overflow-hidden bg-paper border border-stone/40 cursor-pointer group relative"
                onClick={() => setThumbnailEdit(true)}
              >
                {form.thumbnailUrl ? (
                  <img src={form.thumbnailUrl} alt={form.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-jeju text-xs">
                    <ImagePlus className="size-5 mr-1.5" /> 썸네일 없음 — 클릭하여 추가
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-medium">URL 편집</span>
                </div>
              </div>
            )}
          </div>

          {/* 추가 이미지 (최대 3장) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-jeju">추가 이미지 (최대 3장)</Label>
              {extraImages.length < 3 && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] text-sea"
                  onClick={() => {
                    const next = [...extraImages, ""];
                    setExtraImages(next);
                    patchMutation.mutate({ images: next.filter(Boolean) });
                  }}
                >
                  <ImagePlus className="size-3 mr-0.5" /> 추가
                </Button>
              )}
            </div>
            <div className="space-y-1.5">
              {extraImages.map((url, idx) => (
                <div key={idx} className="flex gap-1.5">
                  {url ? (
                    <div
                      className="size-9 rounded border border-stone/40 overflow-hidden shrink-0 cursor-pointer"
                      onClick={() => {
                        const next = [...extraImages];
                        next[idx] = "";
                        setExtraImages(next);
                      }}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="size-9 rounded border border-dashed border-stone/60 shrink-0 flex items-center justify-center text-muted-jeju">
                      <ImagePlus className="size-3.5" />
                    </div>
                  )}
                  <Input
                    value={url}
                    onChange={(e) => {
                      const next = [...extraImages];
                      next[idx] = e.target.value;
                      setExtraImages(next);
                      patchMutation.mutate({ images: next.filter(Boolean) });
                    }}
                    onPaste={(e) => {
                      const text = e.clipboardData.getData("text/plain");
                      if (text.startsWith("http")) {
                        e.preventDefault();
                        const next = [...extraImages];
                        next[idx] = text.trim();
                        setExtraImages(next);
                        patchMutation.mutate({ images: next.filter(Boolean) });
                      }
                    }}
                    placeholder="https://... (Ctrl+V 붙여넣기 가능)"
                    className="text-xs font-mono"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0 size-9 text-muted-jeju hover:text-destructive"
                    onClick={() => {
                      const next = extraImages.filter((_, i) => i !== idx);
                      setExtraImages(next);
                      patchMutation.mutate({ images: next.filter(Boolean) });
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              {extraImages.length === 0 && (
                <p className="text-[11px] text-muted-jeju text-center py-2 border border-dashed border-stone/40 rounded-md">
                  이미지 없음 — 위 추가 버튼으로 URL 입력
                </p>
              )}
            </div>
          </div>

          {/* 소스 링크 */}
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <a
                href={form.sourceUrl ?? form.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {form.sourceType === "blog" ? (
                  <><Link2 className="size-4 text-emerald-600" /> 블로그에서 보기</>
                ) : (
                  <><Youtube className="size-4 text-destructive" /> YouTube에서 보기</>
                )}
                <ExternalLink className="size-3" />
              </a>
            </Button>
            <span className="font-mono text-[11px] text-muted-jeju">{form.videoId}</span>
          </div>
        </div>

        {/* 게시 게이트 상태 */}
        <div
          className={`rounded-md border p-3 ${
            gate.ok
              ? "border-sea/40 bg-sea/5"
              : "border-tangerine/40 bg-tangerine/5"
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {gate.ok ? (
              <ShieldCheck className="size-4 text-sea" />
            ) : (
              <ShieldAlert className="size-4 text-tangerine" />
            )}
            <span
              className={`text-sm font-semibold ${gate.ok ? "text-sea" : "text-tangerine"}`}
            >
              {gate.ok ? "게시 가능" : "게시 게이트 미충족"}
            </span>
            <span className="text-[11px] text-muted-jeju ml-auto">
              {saving ? "저장 중..." : "저장됨"}
            </span>
          </div>
          {gate.ok ? (
            <p className="text-xs text-muted-jeju">
              모든 필수 필드 충족 · 승인·게시 가능
            </p>
          ) : (
            <ul className="space-y-1">
              {gate.reasons.map((r) => (
                <li
                  key={r}
                  className="flex items-center gap-1.5 text-xs text-tangerine"
                >
                  <AlertCircle className="size-3" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>

        <Separator />

        {/* 가격 */}
        <FieldRow label="가격 (만원)" required>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={form.priceManwon || 0}
              onChange={(e) => onPriceManwon(Number(e.target.value))}
              className="font-mono"
              placeholder="예: 35000"
            />
            <span className="text-xs text-muted-jeju whitespace-nowrap">
              = {form.priceManwon > 0 ? fmtManwon(form.priceManwon) : "-"}
            </span>
          </div>
          <Input
            value={form.priceText}
            onChange={(e) => updateField("priceText", e.target.value)}
            className="mt-1.5"
            placeholder="표시용 가격 텍스트 (예: 3억 5,000만원)"
          />
        </FieldRow>

        {/* 면적 (㎡ / 평 동시 입력) */}
        <FieldRow label="면적" required>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-jeju">㎡</Label>
              <Input
                type="number"
                value={form.areaM2 ?? 0}
                onChange={(e) => onAreaM2Change(Number(e.target.value))}
                className="font-mono"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-jeju">평</Label>
              <Input
                type="number"
                value={form.areaPyeong ?? 0}
                onChange={(e) => onAreaPyeongChange(Number(e.target.value))}
                className="font-mono"
              />
            </div>
          </div>
        </FieldRow>

        {/* 주소 */}
        <FieldRow label="주소" required>
          <Input
            value={form.addressText}
            onChange={(e) => updateField("addressText", e.target.value)}
            placeholder="예: 제주시 애월읍 고성리 1234"
            className={
              form.addressText.startsWith("추출 실패") ? "border-tangerine" : ""
            }
          />
        </FieldRow>

        {/* 지역 */}
        <FieldRow label="지역">
          <Select
            value={form.region}
            onValueChange={(v) => updateField("region", v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGION_NAMES.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        {/* 유형 / 거래 */}
        <div className="grid grid-cols-2 gap-2">
          <FieldRow label="유형">
            <Select
              value={form.propertyType}
              onValueChange={(v) => updateField("propertyType", v as PropertyType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
          <FieldRow label="거래">
            <Select
              value={form.dealType}
              onValueChange={(v) => updateField("dealType", v as DealType)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEAL_TYPES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>

        {/* 요약 */}
        <FieldRow label="AI 요약">
          <Textarea
            value={form.summary}
            onChange={(e) => updateField("summary", e.target.value)}
            rows={4}
            placeholder="영상 기반 매물 요약"
          />
        </FieldRow>

        {/* confidence 슬라이더 */}
        <FieldRow
          label={`추출 신뢰도 ${form.confidence.toFixed(2)}`}
          required
        >
          <Slider
            value={[form.confidence]}
            min={0}
            max={1}
            step={0.05}
            onValueChange={(v) => updateField("confidence", v[0])}
            className="py-2"
          />
          <div className="flex justify-between text-[10px] text-muted-jeju">
            <span>0.0</span>
            <span className={form.confidence < 0.5 ? "text-tangerine font-semibold" : ""}>
              임계 0.5
            </span>
            <span>1.0</span>
          </div>
        </FieldRow>

        {/* 하이라이트 */}
        <FieldRow label="하이라이트">
          <ChipInput
            values={form.highlights}
            onChange={(v) => updateChips("highlights", v)}
            placeholder="예: 바다뷰, 마당, 주차 2대"
            accentColor="#176b6b"
          />
        </FieldRow>

        {/* 키워드 */}
        <FieldRow label="키워드">
          <ChipInput
            values={form.keywords}
            onChange={(v) => updateChips("keywords", v)}
            placeholder="예: 신축, 리모델링, 한라산뷰"
            accentColor="#e2702a"
            suggestions={["바다뷰", "돌담", "주차2대", "신축", "구옥", "마당", "한라산뷰", "통유리"]}
          />
        </FieldRow>

        {/* 테마 */}
        <FieldRow label="테마">
          <div className="flex flex-wrap gap-1.5">
            {THEMES.map((t) => {
              const active = form.themes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() =>
                    updateThemes(
                      active
                        ? form.themes.filter((x) => x !== t)
                        : [...form.themes, t],
                    )
                  }
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "border-sea bg-sea text-sea-foreground"
                      : "border-stone/60 text-muted-jeju hover:border-sea/50"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </FieldRow>

        {/* 지도 핀 보정 */}
        <FieldRow label="지도 핀 위치 보정">
          <MiniMap
            lat={form.lat}
            lng={form.lng}
            propertyType={form.propertyType}
            region={form.region}
            onChange={onMapChange}
            onReset={onMapReset}
          />
        </FieldRow>

        {/* 중개사 정보 */}
        {agent ? (
          <div className="rounded-md border border-stone/40 bg-paper/40 p-3 space-y-1">
            <div className="flex items-center gap-2">
              <Link2 className="size-3.5 text-muted-jeju" />
              <span className="text-xs font-medium text-basalt">
                {agent.channelName}
              </span>
              {agent.verified ? (
                <Badge variant="outline" className="border-sea/40 text-sea">
                  <ShieldCheck className="size-3" /> 검증
                </Badge>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="border-tangerine/40 text-tangerine cursor-help">
                        <ShieldAlert className="size-3" /> 미검증
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      중개사관리에서 검증 토글 필요
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {agent.name && (
              <p className="text-xs text-muted-jeju">
                {agent.name}
                {agent.office ? ` · ${agent.office}` : ""}
              </p>
            )}
            {agent.regNo && (
              <p className="text-[11px] font-mono text-muted-jeju">
                등록번호 {agent.regNo}
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-md border border-tangerine/40 bg-tangerine/5 p-3 text-xs text-tangerine flex items-center gap-2">
            <AlertCircle className="size-3.5" />
            중개사 정보 없음 — 게시 불가
          </div>
        )}

        {/* 가격 이력 */}
        {form.priceHistory.length > 0 && (
          <div className="rounded-md border border-stone/40 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-jeju">가격 이력</p>
            <div className="space-y-1">
              {form.priceHistory.slice(-3).reverse().map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-muted-jeju">
                    {fmtManwon(h.manwon)}
                  </span>
                  <span className="text-[10px] text-muted-jeju">
                    {new Date(h.at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* 액션 푸터 */}
      <div className="border-t border-stone/40 p-3 space-y-2 bg-paper/40">
        <div className="flex gap-2">
          <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    className="flex-1 bg-tangerine hover:bg-tangerine/90 text-tangerine-foreground disabled:opacity-40"
                    disabled={!gate.ok || actionMutation.isPending}
                    onClick={handleApprove}
                  >
                    <ThumbsUp className="size-4" /> 승인·게시
                  </Button>
                </TooltipTrigger>
                {!gate.ok && (
                  <TooltipContent side="top">
                    <ul className="space-y-0.5">
                      {gate.reasons.map((r) => (
                        <li key={r}>· {r}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          <Button
            variant="outline"
            disabled={actionMutation.isPending}
            onClick={() => setRejectOpen(true)}
            className="text-destructive hover:text-destructive"
          >
            <ThumbsDown className="size-4" /> 반려
          </Button>
        </div>
        {form.status === "error" && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-sea"
            disabled={actionMutation.isPending}
            onClick={handleRetry}
          >
            <RefreshCw className="size-3.5" /> 재시도 (구조화 재실행)
          </Button>
        )}
      </div>

      {/* 반려 사유 Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>매물 반려</DialogTitle>
            <DialogDescription>
              반려 사유를 입력하세요. 사유는 운영 로그에 기록됩니다.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            placeholder="예: 가격 정보 불명확, 주소 추출 실패, 영상과 매물 불일치"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionMutation.isPending}
            >
              반려 확정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 저장 상태 인디케이터 */}
      {saving && (
        <div className="absolute top-2 right-2">
          <RefreshCw className="size-3 animate-spin text-sea" />
        </div>
      )}
    </Card>
  );
}

function FieldRow({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-jeju flex items-center gap-1">
        {label}
        {required && <span className="text-tangerine">*</span>}
      </Label>
      {children}
    </div>
  );
}
