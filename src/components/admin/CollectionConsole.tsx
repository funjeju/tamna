"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  Filter,
  Globe,
  Layers,
  MapPin,
  Play,
  Plus,
  Search,
  Settings,
  SkipForward,
  Sparkles,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { REGION_NAMES } from "@/lib/regions";
import { fmtTimeAgo, fmtDateTime } from "./lib/canPublish";
import type { CollectionJob, CollectionJobItem } from "@/lib/types";

interface CollectionConsoleProps {
  onJobCompleted?: () => void;
}

const PERIOD_OPTIONS = [
  { value: 1, label: "지난 24시간" },
  { value: 2, label: "지난 48시간" },
  { value: 7, label: "지난 7일" },
  { value: 30, label: "사용자지정 (30일)" },
];

const PROPERTY_PRESETS = [
  { value: "all", label: "전체" },
  { value: "house", label: "주택 위주", keywords: ["단독주택", "전원주택", "빌라", "상가주택"] },
  { value: "commercial", label: "상가 위주", keywords: ["상가", "상가주택"] },
  { value: "land", label: "토지", keywords: ["토지"] },
];

const PIPELINE_STEPS = [
  { key: "search", label: "검색", icon: Search, source: "YouTube Data API" },
  { key: "transcript", label: "자막 추출", icon: Bot, source: "SocialKit" },
  { key: "structuring", label: "AI 구조화", icon: Sparkles, source: "Claude" },
  { key: "geocode", label: "지오코딩", icon: MapPin, source: "카카오 Local API" },
  { key: "saved", label: "드래프트 생성", icon: Database, source: "DB" },
];

interface LogStep {
  idx: number;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  detail?: string;
}

interface LogEntry {
  videoId: string;
  status: "ok" | "skip" | "fail";
  step: string;
  detail?: string;
  source?: string;
}

export function CollectionConsole({ onJobCompleted }: CollectionConsoleProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [period, setPeriod] = useState(2);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [preset, setPreset] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [logRunning, setLogRunning] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [cronOpen, setCronOpen] = useState(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 수집잡 이력 조회
  const { data: jobsData, isLoading } = useQuery<{ jobs: CollectionJob[] }>({
    queryKey: ["collection-jobs"],
    queryFn: async () => {
      const res = await fetch("/api/collection");
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  // 수집 실행
  const runMutation = useMutation({
    mutationFn: async (payload: { region: string; periodDays: number; keyword: string }) => {
      const res = await fetch("/api/collection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("collection failed");
      return res.json() as Promise<{ job: CollectionJob }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["collection-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({
        title: "수집 완료",
        description: `${data.job.found}건 발견 → ${data.job.processed}건 처리 (실패 ${data.job.failed}건)`,
      });
      onJobCompleted?.();
    },
    onError: () => {
      toast({
        title: "수집 실패",
        description: "잠시 후 다시 시도하세요.",
        variant: "destructive",
      });
      setLogRunning(false);
      clearTimers();
    },
  });

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const toggleRegion = (r: string) => {
    setSelectedRegions((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  // 실시간 로그 시뮬레이션 시작
  const startSimulation = (found: number, failed: number, kw: string) => {
    setLogEntries([]);
    setLogRunning(true);
    setCurrentStepIdx(0);

    const items: LogEntry[] = Array.from({ length: found }).map((_, i) => {
      const isFail = i === found - 1 && failed > 0;
      const skipIdx = i % 5 === 4 && !isFail; // 일부는 중복 스킵
      return {
        videoId: `vid_${Date.now().toString(36)}_${i}`,
        status: isFail ? "fail" : skipIdx ? "skip" : "ok",
        step: isFail ? ["transcript", "structuring"][i % 2] : "saved",
        detail: isFail
          ? "자막 추출 3회 재시도 실패"
          : skipIdx
          ? "이미 수집된 영상 (중복 스킵)"
          : `키워드 "${kw}" 매칭`,
        source: i % 2 === 0 ? "socialkit" : "youtube",
      };
    });

    // 5개 단계를 0.4초 간격으로 진행
    PIPELINE_STEPS.forEach((_, idx) => {
      const t = setTimeout(() => {
        setCurrentStepIdx(idx);
        if (idx === PIPELINE_STEPS.length - 1) {
          // 마지막 단계에서 items 표시
          items.forEach((item, j) => {
            const tt = setTimeout(() => {
              setLogEntries((prev) => [...prev, item]);
            }, j * 120);
            timersRef.current.push(tt);
          });
          // 완료
          const finalT = setTimeout(() => {
            setLogRunning(false);
          }, items.length * 120 + 200);
          timersRef.current.push(finalT);
        }
      }, idx * 400);
      timersRef.current.push(t);
    });
  };

  const handleRun = async () => {
    const regionLabel =
      selectedRegions.length === 0
        ? "전체"
        : selectedRegions.length === 1
        ? selectedRegions[0]
        : `${selectedRegions[0]} 외 ${selectedRegions.length - 1}`;
    const kw = keyword.trim() || "제주 부동산";

    toast({
      title: "수집 시작",
      description: `지역: ${regionLabel} · 키워드: ${kw} — 유튜브에서 실제 수집 중 (수십 초 소요)`,
    });

    // 파이프라인 단계 표시기 애니메이션 (시각용)
    setLogEntries([]);
    setLogRunning(true);
    setCurrentStepIdx(0);
    clearTimers();
    PIPELINE_STEPS.forEach((_, idx) => {
      const t = setTimeout(
        () => setCurrentStepIdx(Math.min(idx, PIPELINE_STEPS.length - 1)),
        idx * 500,
      );
      timersRef.current.push(t);
    });

    try {
      // 실제 수집 — 결과 items 를 그대로 로그에 표시
      const data = await runMutation.mutateAsync({
        region: regionLabel,
        periodDays: period,
        keyword: kw,
      });
      clearTimers();
      setCurrentStepIdx(PIPELINE_STEPS.length - 1);
      setLogEntries((data.job.items as LogEntry[]) ?? []);
    } finally {
      setLogRunning(false);
    }
  };

  const handleRetryStep = (entry: LogEntry) => {
    toast({
      title: "재시도 큐에 추가",
      description: `${entry.videoId} — ${entry.step} 단계 재시도 예약`,
    });
  };

  const jobs = jobsData?.jobs ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-basalt">수집 콘솔</h1>
          <p className="text-sm text-muted-jeju mt-0.5">
            유튜브 매물 영상 수집 — 검색 → 자막 → 구조화 → 지오코딩 → 드래프트
          </p>
        </div>
        <Dialog open={cronOpen} onOpenChange={setCronOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Settings className="size-4" /> 크론 설정
            </Button>
          </DialogTrigger>
          <CronSettingsDialog onClose={() => setCronOpen(false)} />
        </Dialog>
      </div>

      {/* 수집 폼 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="size-4 text-sea" /> 수집 조건
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 기간 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-jeju">기간</Label>
              <Select
                value={String(period)}
                onValueChange={(v) => setPeriod(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={String(p.value)}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* 매물 유형 프리셋 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-jeju">매물 유형 프리셋</Label>
              <RadioGroup
                value={preset}
                onValueChange={setPreset}
                className="flex flex-wrap gap-2"
              >
                {PROPERTY_PRESETS.map((p) => (
                  <Label
                    key={p.value}
                    htmlFor={`preset-${p.value}`}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      preset === p.value
                        ? "border-sea bg-sea/10 text-sea"
                        : "border-stone/60 text-muted-jeju hover:border-sea/50"
                    }`}
                  >
                    <RadioGroupItem
                      id={`preset-${p.value}`}
                      value={p.value}
                      className="sr-only"
                    />
                    {p.label}
                  </Label>
                ))}
              </RadioGroup>
            </div>
            {/* 검색 키워드 */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-jeju">검색 키워드</Label>
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="예: 애월 바다뷰 전원주택"
              />
            </div>
          </div>
          {/* 지역 칩 토글 */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-jeju">지역 (복수 선택)</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedRegions([])}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  selectedRegions.length === 0
                    ? "border-sea bg-sea text-sea-foreground"
                    : "border-stone/60 text-muted-jeju hover:border-sea/50"
                }`}
              >
                전체
              </button>
              {REGION_NAMES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegion(r)}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    selectedRegions.includes(r)
                      ? "border-sea bg-sea text-sea-foreground"
                      : "border-stone/60 text-muted-jeju hover:border-sea/50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {/* 실행 버튼 */}
          <div className="flex items-center justify-between pt-2 border-t border-stone/40">
            <p className="text-xs text-muted-jeju">
              선택 지역 {selectedRegions.length === 0 ? "전체" : `${selectedRegions.length}개`} ·
              기간 {PERIOD_OPTIONS.find((p) => p.value === period)?.label}
            </p>
            <Button
              onClick={handleRun}
              disabled={logRunning || runMutation.isPending}
              className="bg-tangerine hover:bg-tangerine/90 text-tangerine-foreground"
            >
              <Play className="size-4" />
              {logRunning ? "수집 중..." : "매물 수집"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 실시간 로그 패널 */}
      {(logRunning || logEntries.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap
                  className={`size-4 ${logRunning ? "text-sea live-dot" : "text-sea"}`}
                />
                실시간 수집 로그
              </CardTitle>
              <Badge variant="outline" className="font-mono">
                {logEntries.length}건
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 단계별 진행 */}
            <div className="grid grid-cols-5 gap-1.5">
              {PIPELINE_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const state: LogStep["status"] =
                  idx < currentStepIdx
                    ? "done"
                    : idx === currentStepIdx && logRunning
                    ? "running"
                    : idx === currentStepIdx && !logRunning
                    ? "done"
                    : "pending";
                const color =
                  state === "done"
                    ? "#176b6b"
                    : state === "running"
                    ? "#176b6b"
                    : "#b9c2bd";
                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center gap-1 rounded-md border border-stone/40 p-2 text-center"
                    style={{ opacity: state === "pending" ? 0.5 : 1 }}
                  >
                    <div className="relative">
                      <StepIcon
                        className={`size-5 ${state === "running" ? "live-dot" : ""}`}
                        style={{ color }}
                      />
                      {state === "done" && (
                        <CheckCircle2
                          className="absolute -top-1 -right-1 size-3 text-sea bg-background rounded-full"
                        />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-basalt">
                      {step.label}
                    </span>
                    <span className="text-[9px] text-muted-jeju">{step.source}</span>
                  </div>
                );
              })}
            </div>
            {/* 전체 진행률 */}
            <Progress
              value={
                logRunning
                  ? ((currentStepIdx + 1) / PIPELINE_STEPS.length) * 80 +
                    (logEntries.length / Math.max(1, logEntries.length + 1)) * 20
                  : 100
              }
              className="h-1.5"
            />
            {/* 아이템 로그 */}
            <div className="max-h-72 overflow-y-auto scroll-thin space-y-1 rounded-md border border-stone/40 bg-paper/30 p-2">
              {logEntries.length === 0 && logRunning && (
                <div className="text-xs text-muted-jeju py-4 text-center">
                  단계 진행 중...
                </div>
              )}
              {logEntries.map((entry, i) => (
                <LogEntryRow key={`${entry.videoId}-${i}`} entry={entry} onRetry={() => handleRetryStep(entry)} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 수집잡 이력 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="size-4 text-sea" /> 최근 수집잡 이력
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-sm text-muted-jeju py-8 text-center">
              수집잡 이력이 없습니다. 위에서 수집을 실행해보세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>시간</TableHead>
                    <TableHead>trigger</TableHead>
                    <TableHead>지역</TableHead>
                    <TableHead className="text-right">found</TableHead>
                    <TableHead className="text-right">processed</TableHead>
                    <TableHead className="text-right">failed</TableHead>
                    <TableHead>상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <JobRow
                      key={job.id}
                      job={job}
                      expanded={expandedJob === job.id}
                      onToggle={() =>
                        setExpandedJob(expandedJob === job.id ? null : job.id)
                      }
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LogEntryRow({
  entry,
  onRetry,
}: {
  entry: LogEntry;
  onRetry: () => void;
}) {
  const isFail = entry.status === "fail";
  const isSkip = entry.status === "skip";
  return (
    <div className="flex items-center gap-2 rounded px-2 py-1.5 text-xs hover:bg-background">
      {isFail ? (
        <XCircle className="size-3.5 text-destructive shrink-0" />
      ) : isSkip ? (
        <SkipForward className="size-3.5 text-muted-jeju shrink-0" />
      ) : (
        <CheckCircle2 className="size-3.5 text-sea shrink-0" />
      )}
      <span className="font-mono text-[11px] text-muted-jeju truncate max-w-[180px]">
        {entry.videoId}
      </span>
      <Badge
        variant="outline"
        className={
          isFail
            ? "border-destructive/40 text-destructive"
            : isSkip
            ? "border-stone text-muted-jeju"
            : "border-sea/40 text-sea"
        }
      >
        {entry.step}
      </Badge>
      {entry.detail && (
        <span className="text-muted-jeju truncate flex-1">{entry.detail}</span>
      )}
      {isFail && (
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-[11px]"
          onClick={onRetry}
        >
          재시도
        </Button>
      )}
    </div>
  );
}

function JobRow({
  job,
  expanded,
  onToggle,
}: {
  job: CollectionJob;
  expanded: boolean;
  onToggle: () => void;
}) {
  const failed = job.failed > 0;
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-paper/50"
        onClick={onToggle}
      >
        <TableCell className="p-2">
          {expanded ? (
            <ChevronDown className="size-4 text-muted-jeju" />
          ) : (
            <ChevronRight className="size-4 text-muted-jeju" />
          )}
        </TableCell>
        <TableCell className="font-mono text-xs">
          {fmtDateTime(job.startedAt)}
          <span className="text-muted-jeju ml-1">({fmtTimeAgo(job.startedAt)})</span>
        </TableCell>
        <TableCell>
          <Badge
            variant="outline"
            className={
              job.trigger === "cron"
                ? "border-sea/40 text-sea"
                : "border-stone text-muted-jeju"
            }
          >
            {job.trigger}
          </Badge>
        </TableCell>
        <TableCell className="text-xs">
          <span className="inline-flex items-center gap-1">
            <Globe className="size-3 text-muted-jeju" />
            {job.region || "전체"}
          </span>
        </TableCell>
        <TableCell className="text-right font-mono text-sea">{job.found}</TableCell>
        <TableCell className="text-right font-mono">{job.processed}</TableCell>
        <TableCell
          className={`text-right font-mono ${failed ? "text-destructive font-semibold" : "text-muted-jeju"}`}
        >
          {job.failed}
        </TableCell>
        <TableCell>
          {failed ? (
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              부분실패
            </Badge>
          ) : (
            <Badge variant="outline" className="border-sea/40 text-sea">
              완료
            </Badge>
          )}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-paper/30">
          <TableCell colSpan={8} className="p-3">
            <div className="space-y-1">
              <div className="text-xs font-medium text-muted-jeju mb-2 flex items-center gap-1.5">
                <Layers className="size-3" />
                아이템 상세 ({job.items.length}건)
              </div>
              {job.items.length === 0 ? (
                <div className="text-xs text-muted-jeju">아이템 로그 없음</div>
              ) : (
                job.items.map((item, i) => (
                  <ItemRow key={`${item.videoId}-${i}`} item={item} />
                ))
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function ItemRow({ item }: { item: CollectionJobItem }) {
  const isFail = item.status === "fail";
  const isSkip = item.status === "skip";
  return (
    <div className="flex items-center gap-2 rounded px-2 py-1 text-xs">
      {isFail ? (
        <XCircle className="size-3 text-destructive" />
      ) : isSkip ? (
        <SkipForward className="size-3 text-muted-jeju" />
      ) : (
        <CheckCircle2 className="size-3 text-sea" />
      )}
      <span className="font-mono text-muted-jeju w-[160px] truncate">
        {item.videoId}
      </span>
      <Badge variant="outline" className="text-[10px]">
        {item.step}
      </Badge>
      <span className="text-[11px] text-muted-jeju">{item.source}</span>
      {item.detail && (
        <span className="text-muted-jeju truncate flex-1">{item.detail}</span>
      )}
    </div>
  );
}

function CronSettingsDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [keywords, setKeywords] = useState<string[]>([
    "제주 부동산",
    "애월 전원주택",
    "서귀포 매매",
  ]);
  const [newKw, setNewKw] = useState("");
  const [active, setActive] = useState(true);

  const addKw = () => {
    const t = newKw.trim();
    if (!t || keywords.includes(t)) return;
    setKeywords([...keywords, t]);
    setNewKw("");
  };

  const removeKw = (k: string) => setKeywords(keywords.filter((x) => x !== k));

  const handleSave = () => {
    toast({
      title: "크론 설정 저장됨",
      description: `매일 08:00 KST · 키워드 ${keywords.length}세트 · ${active ? "활성" : "비활성"}`,
    });
    onClose();
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
      <DialogHeader>
        <DialogTitle>크론 수집 설정</DialogTitle>
        <DialogDescription>
          자동 수집 스케줄과 키워드 세트를 관리합니다.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="flex items-center justify-between rounded-md border border-stone/40 p-3 bg-paper/40">
          <div>
            <p className="text-sm font-medium text-basalt">스케줄</p>
            <p className="text-xs text-muted-jeju">
              매일 08:00 KST 고정 — 운영 정책
            </p>
          </div>
          <Badge variant="outline" className="font-mono border-sea/40 text-sea">
            0 8 * * *
          </Badge>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="cron-active" className="text-sm">
              활성화
            </Label>
            <p className="text-xs text-muted-jeju">
              비활성 시 자동 수집이 중단됩니다.
            </p>
          </div>
          <Switch id="cron-active" checked={active} onCheckedChange={setActive} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">키워드 세트</Label>
          <div className="flex gap-2">
            <Input
              value={newKw}
              onChange={(e) => setNewKw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKw();
                }
              }}
              placeholder="새 키워드 입력 후 Enter"
            />
            <Button size="icon" onClick={addKw} aria-label="키워드 추가">
              <Plus className="size-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {keywords.map((k) => (
              <Badge
                key={k}
                variant="secondary"
                className="gap-1 pr-1 bg-sea/10 text-sea border border-sea/30"
              >
                {k}
                <button
                  type="button"
                  onClick={() => removeKw(k)}
                  className="rounded-full hover:bg-sea/20 p-0.5"
                  aria-label={`${k} 삭제`}
                >
                  <Trash2 className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleSave}>저장</Button>
      </DialogFooter>
    </DialogContent>
  );
}
