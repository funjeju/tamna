"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  ToggleLeft,
  ToggleRight,
  Youtube,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface SourceCronConfig {
  enabled: boolean;
  intervalDays: number;
  hourKST: number;
  lastRunAt: string | null;
}

interface CronConfig {
  youtube: SourceCronConfig;
  blog: SourceCronConfig;
  rotation: { enabled: boolean; lastRunAt: string | null };
}

const INTERVAL_OPTIONS = [
  { value: 1, label: "매일" },
  { value: 2, label: "이틀에 한 번" },
  { value: 3, label: "3일에 한 번" },
  { value: 7, label: "일주일에 한 번" },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00 KST`,
}));

function fmtDate(iso: string | null) {
  if (!iso) return "없음";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function CronSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [triggeringYt, setTriggeringYt] = useState(false);
  const [triggeringBlog, setTriggeringBlog] = useState(false);
  const [triggeringRotation, setTriggeringRotation] = useState(false);

  const { data, isLoading } = useQuery<CronConfig>({
    queryKey: ["cron-config"],
    queryFn: async () => {
      const res = await fetch("/api/admin/cron-config");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const [local, setLocal] = useState<CronConfig | null>(null);
  const cfg = local ?? data ?? null;

  const saveMutation = useMutation({
    mutationFn: async (c: CronConfig) => {
      const res = await fetch("/api/admin/cron-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      });
      if (!res.ok) throw new Error("save failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cron-config"] });
      setLocal(null);
      toast({ title: "스케줄 저장 완료" });
    },
    onError: () => toast({ title: "저장 실패", variant: "destructive" }),
  });

  const triggerNow = async (source: "youtube" | "blog" | "rotation") => {
    if (source === "youtube") setTriggeringYt(true);
    else if (source === "blog") setTriggeringBlog(true);
    else setTriggeringRotation(true);
    try {
      const path = source === "rotation"
        ? "/api/cron/collect-rotation?force=true"
        : `/api/admin/cron-config?trigger=${source}`;
      const res = await fetch(path, { method: source === "rotation" ? "GET" : "POST" });
      const d = await res.json();
      const label = source === "youtube" ? "유튜브" : source === "blog" ? "블로그" : "읍면동 로테이션";
      toast({
        title: `${label} 수집 시작`,
        description: d.result?.processedRegions
          ? `${d.result.processedRegions.join(", ")} 처리`
          : "백그라운드 실행 중",
      });
      qc.invalidateQueries({ queryKey: ["cron-config"] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    } catch {
      toast({ title: "수집 실행 실패", variant: "destructive" });
    } finally {
      if (source === "youtube") setTriggeringYt(false);
      else if (source === "blog") setTriggeringBlog(false);
      else setTriggeringRotation(false);
    }
  };

  const update = (
    source: "youtube" | "blog",
    field: keyof SourceCronConfig,
    value: any,
  ) => {
    if (!cfg) return;
    setLocal({
      ...cfg,
      [source]: { ...cfg[source], [field]: value },
    });
  };

  const isDirty = local !== null;

  if (isLoading || !cfg) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-basalt">수집 스케줄 설정</h1>
          <p className="text-sm text-muted-jeju mt-0.5">
            수집 주기·활성화·즉시 실행 관리. 시각 변경은 다음 배포 후 반영.
          </p>
        </div>
        {isDirty && (
          <Button
            onClick={() => cfg && saveMutation.mutate(cfg)}
            disabled={saveMutation.isPending}
            className="bg-sea text-sea-foreground hover:bg-sea/90"
          >
            {saveMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            저장
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* 유튜브 */}
        <SourceCard
          label="유튜브"
          color="red"
          Icon={Youtube}
          cfg={cfg.youtube}
          triggering={triggeringYt}
          onUpdate={(f, v) => update("youtube", f, v)}
          onTrigger={() => triggerNow("youtube")}
        />
        {/* 블로그 */}
        <SourceCard
          label="블로그"
          color="green"
          Icon={BookOpen}
          cfg={cfg.blog}
          triggering={triggeringBlog}
          onUpdate={(f, v) => update("blog", f, v)}
          onTrigger={() => triggerNow("blog")}
        />
      </div>

      {/* 읍면동 로테이션 */}
      <Card className="border-l-[3px] border-l-sea">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="size-4" />
              읍면동 로테이션 수집
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${cfg.rotation.enabled ? "bg-sea" : "bg-stone/50"}`}>
                {cfg.rotation.enabled ? "활성" : "비활성"}
              </span>
              <Switch
                checked={cfg.rotation.enabled}
                onCheckedChange={(v) => {
                  if (!cfg) return;
                  setLocal({ ...cfg, rotation: { ...cfg.rotation, enabled: v } });
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md bg-paper/60 px-3 py-2 text-xs text-muted-jeju space-y-1">
            <p>제주 읍면동 <span className="font-semibold text-basalt">15개</span>를 매일 <span className="font-semibold text-basalt">4개씩</span> 순환 수집</p>
            <p>→ 약 <span className="font-semibold text-basalt">4일</span>에 전체 1순환 · 광역 쿼리 보완</p>
            <p className="text-[10px] text-stone">중복 영상은 videoId 기준 자동 스킵</p>
          </div>
          <Button
            className="w-full"
            variant="outline"
            disabled={triggeringRotation}
            onClick={() => triggerNow("rotation")}
          >
            {triggeringRotation ? (
              <><Loader2 className="size-4 animate-spin" />수집 중...</>
            ) : (
              <><Zap className="size-4 text-sea" />지금 다음 4개 읍면동 수집</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 현황 요약 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="size-4" />
            마지막 실행 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center justify-between rounded-md bg-paper/60 px-3 py-2">
            <span className="text-muted-jeju flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-red-500" />
              유튜브
            </span>
            <span className="font-mono text-xs text-basalt">{fmtDate(cfg.youtube.lastRunAt)}</span>
          </div>
          <div className="flex items-center justify-between rounded-md bg-paper/60 px-3 py-2">
            <span className="text-muted-jeju flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              블로그
            </span>
            <span className="font-mono text-xs text-basalt">{fmtDate(cfg.blog.lastRunAt)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SourceCard({
  label,
  color,
  Icon,
  cfg,
  triggering,
  onUpdate,
  onTrigger,
}: {
  label: string;
  color: "red" | "green";
  Icon: React.ComponentType<{ className?: string }>;
  cfg: SourceCronConfig;
  triggering: boolean;
  onUpdate: (field: keyof SourceCronConfig, value: any) => void;
  onTrigger: () => void;
}) {
  const borderColor = color === "red" ? "border-l-red-500" : "border-l-emerald-500";
  const badgeBg = color === "red" ? "bg-red-600/90" : "bg-emerald-600/90";

  return (
    <Card className={`border-l-[3px] ${borderColor}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Icon className="size-4" />
            {label} 수집
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] text-white px-2 py-0.5 rounded-full ${badgeBg}`}>
              {cfg.enabled ? "활성" : "비활성"}
            </span>
            <Switch
              checked={cfg.enabled}
              onCheckedChange={(v) => onUpdate("enabled", v)}
              aria-label={`${label} 수집 활성화`}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-jeju flex items-center gap-1">
              <CalendarClock className="size-3" /> 수집 주기
            </Label>
            <Select
              value={String(cfg.intervalDays)}
              onValueChange={(v) => onUpdate("intervalDays", Number(v))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INTERVAL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-jeju flex items-center gap-1">
              <CalendarClock className="size-3" /> 실행 시각 (KST)
              <span className="text-[9px] text-stone ml-0.5">(표시용)</span>
            </Label>
            <Select
              value={String(cfg.hourKST)}
              onValueChange={(v) => onUpdate("hourKST", Number(v))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md bg-paper/60 px-3 py-2 text-xs text-muted-jeju">
          현재 설정:{" "}
          <span className="font-semibold text-basalt">
            {cfg.enabled
              ? `${INTERVAL_OPTIONS.find((o) => o.value === cfg.intervalDays)?.label ?? cfg.intervalDays + "일"} · ${String(cfg.hourKST).padStart(2, "0")}:00 KST`
              : "비활성"}
          </span>
        </div>

        <Button
          className="w-full"
          variant="outline"
          disabled={triggering}
          onClick={onTrigger}
        >
          {triggering ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              수집 중...
            </>
          ) : (
            <>
              <Zap className="size-4 text-tangerine" />
              지금 바로 수집
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
