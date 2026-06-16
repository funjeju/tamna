"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import type { Agent, AgentPlan } from "@/lib/types";

type StatusTab = "all" | "verified" | "unverified" | "opted_out";

export function AgentManagement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<StatusTab>("all");
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [optOutTarget, setOptOutTarget] = useState<Agent | null>(null);

  const { data, isLoading, isFetching } = useQuery<{ agents: Agent[]; total: number }>({
    queryKey: ["agents", tab],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (tab !== "all") params.set("status", tab);
      const res = await fetch(`/api/agents?${params.toString()}`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    const list = data?.agents ?? [];
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(
      (a) =>
        a.channelName.toLowerCase().includes(s) ||
        (a.name ?? "").toLowerCase().includes(s) ||
        (a.office ?? "").toLowerCase().includes(s) ||
        (a.regNo ?? "").includes(s),
    );
  }, [data, search]);

  // PATCH mutation
  const patchMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<Agent> }) => {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("patch failed");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      if (vars.payload.verified !== undefined) {
        toast({
          title: "검증 상태 변경",
          description: vars.payload.verified ? "검증 완료 처리됨" : "검증 해제됨",
        });
      } else if (vars.payload.plan !== undefined) {
        toast({
          title: "플랜 변경",
          description: `플랜 → ${vars.payload.plan}`,
        });
      } else if (vars.payload.optedOut !== undefined) {
        toast({
          title: vars.payload.optedOut ? "옵트아웃 처리됨" : "옵트아웃 해제됨",
          description: vars.payload.optedOut
            ? "해당 채널의 모든 매물이 노출 중단됨"
            : "재수집이 활성화됩니다",
        });
      }
    },
    onError: () => {
      toast({
        title: "처리 실패",
        description: "잠시 후 다시 시도하세요.",
        variant: "destructive",
      });
    },
  });

  const handleVerified = (agent: Agent, checked: boolean) => {
    patchMutation.mutate({ id: agent.id, payload: { verified: checked } });
  };

  const handlePlan = (agent: Agent, plan: AgentPlan) => {
    patchMutation.mutate({ id: agent.id, payload: { plan } });
  };

  const handleOptOutToggle = (agent: Agent) => {
    if (agent.optedOut) {
      // 해제
      patchMutation.mutate({ id: agent.id, payload: { optedOut: false } });
    } else {
      // 적용 — 다이얼로그로 확인
      setOptOutTarget(agent);
    }
  };

  const confirmOptOut = () => {
    if (!optOutTarget) return;
    patchMutation.mutate({ id: optOutTarget.id, payload: { optedOut: true } });
    setOptOutTarget(null);
  };

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-basalt flex items-center gap-2">
            중개사 관리
            <Badge variant="outline" className="font-mono text-sm">
              {data?.total ?? 0}명
            </Badge>
          </h1>
          <p className="text-sm text-muted-jeju mt-0.5">
            채널 검증 · 플랜 · 옵트아웃 관리 — 신뢰 우선
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["agents"] })}
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            새로고침
          </Button>
          <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="size-4" /> 채널 등록
              </Button>
            </DialogTrigger>
            <RegisterDialog onClose={() => setRegisterOpen(false)} />
          </Dialog>
        </div>
      </div>

      {/* 탭 + 검색 */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="all">
              <Users className="size-3.5 mr-1" /> 전체
            </TabsTrigger>
            <TabsTrigger value="verified">검증완료</TabsTrigger>
            <TabsTrigger value="unverified">미검증</TabsTrigger>
            <TabsTrigger value="opted_out">옵트아웃</TabsTrigger>
          </TabsList>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-jeju" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="채널/이름/사무소 검색"
              className="pl-8"
            />
          </div>
        </div>
      </Tabs>

      {/* 테이블 */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-jeju">
              등록된 중개사가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">채널 / 중개사</TableHead>
                    <TableHead>등록번호</TableHead>
                    <TableHead>사무소</TableHead>
                    <TableHead className="text-center">매물</TableHead>
                    <TableHead className="text-center">검증</TableHead>
                    <TableHead>플랜</TableHead>
                    <TableHead className="text-center">옵트아웃</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((agent) => (
                    <AgentRow
                      key={agent.id}
                      agent={agent}
                      onVerifiedChange={(checked) => handleVerified(agent, checked)}
                      onPlanChange={(plan) => handlePlan(agent, plan)}
                      onOptOutToggle={() => handleOptOutToggle(agent)}
                      patching={patchMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 옵트아웃 확인 다이얼로그 */}
      <AlertDialog
        open={!!optOutTarget}
        onOpenChange={(o) => !o && setOptOutTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>채널 단위 옵트아웃</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-basalt">{optOutTarget?.channelName}</strong>{" "}
              채널의 <strong className="text-basalt">모든 매물</strong>이 노출 중단되고
              재수집에서도 제외됩니다. 이 작업은 사용자에게 즉시 반영됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmOptOut}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              옵트아웃 확정
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AgentRow({
  agent,
  onVerifiedChange,
  onPlanChange,
  onOptOutToggle,
  patching,
}: {
  agent: Agent;
  onVerifiedChange: (checked: boolean) => void;
  onPlanChange: (plan: AgentPlan) => void;
  onOptOutToggle: () => void;
  patching: boolean;
}) {
  const initials = (agent.channelName || "?").slice(0, 2);
  return (
    <TableRow className="hover:bg-paper/40">
      <TableCell>
        <div className="flex items-center gap-2">
          <Avatar className="size-8">
            <AvatarFallback
              className="text-[11px] font-semibold"
              style={{
                backgroundColor: agent.verified ? "#176b6b20" : "#e2702a20",
                color: agent.verified ? "#176b6b" : "#e2702a",
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium line-clamp-1">
                {agent.channelName}
              </p>
              {agent.channelUrl && (
                <a
                  href={agent.channelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-jeju hover:text-sea"
                  aria-label="채널 방문"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
            <p className="text-[11px] text-muted-jeju flex items-center gap-1">
              <User className="size-2.5" />
              {agent.name || "—"}
              {agent.expertise ? ` · ${agent.expertise}` : ""}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-jeju">
        {agent.regNo || "—"}
      </TableCell>
      <TableCell className="text-xs">
        {agent.office ? (
          <span className="flex items-center gap-1 text-muted-jeju">
            <Building2 className="size-3" />
            {agent.office}
          </span>
        ) : (
          <span className="text-muted-jeju">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="font-mono text-xs">
          {agent.listingCount ?? 0}건
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <Switch
            checked={agent.verified}
            onCheckedChange={onVerifiedChange}
            disabled={patching}
            aria-label="검증 토글"
          />
          {agent.verified ? (
            <ShieldCheck className="size-3.5 text-sea" />
          ) : (
            <ShieldAlert className="size-3.5 text-tangerine" />
          )}
        </div>
      </TableCell>
      <TableCell>
        <Select
          value={agent.plan}
          onValueChange={(v) => onPlanChange(v as AgentPlan)}
          disabled={patching}
        >
          <SelectTrigger className="h-8 w-[110px] text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="featured">Featured</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="text-center">
        <div className="flex items-center justify-center gap-1.5">
          <Switch
            checked={agent.optedOut}
            onCheckedChange={onOptOutToggle}
            disabled={patching}
            aria-label="옵트아웃 토글"
          />
          <span
            className={`text-[11px] ${agent.optedOut ? "text-destructive font-medium" : "text-muted-jeju"}`}
          >
            {agent.optedOut ? "중단" : "정상"}
          </span>
        </div>
      </TableCell>
    </TableRow>
  );
}

function RegisterDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    channelId: "",
    channelName: "",
    name: "",
    regNo: "",
    office: "",
  });

  const handleSubmit = () => {
    if (!form.channelId || !form.channelName) {
      toast({
        title: "필수 값 누락",
        description: "채널 ID와 채널명은 필수입니다.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "채널 등록 요청됨",
      description: `${form.channelName} — 검증 대기열에 추가됨`,
    });
    onClose();
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>중개사 채널 등록</DialogTitle>
        <DialogDescription>
          YouTube 채널 ID를 입력하면 자동으로 메타데이터를 수집합니다. (MVP 데모)
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label className="text-xs">YouTube 채널 ID *</Label>
          <Input
            value={form.channelId}
            onChange={(e) => setForm({ ...form, channelId: e.target.value })}
            placeholder="UC..."
            className="font-mono"
          />
        </div>
        <div>
          <Label className="text-xs">채널명 *</Label>
          <Input
            value={form.channelName}
            onChange={(e) => setForm({ ...form, channelName: e.target.value })}
            placeholder="예: 제주부동산TV"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">중개사명</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 김제주"
            />
          </div>
          <div>
            <Label className="text-xs">공인중개사 등록번호</Label>
            <Input
              value={form.regNo}
              onChange={(e) => setForm({ ...form, regNo: e.target.value })}
              placeholder="예: 제주-1234"
              className="font-mono"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">사무소</Label>
          <Input
            value={form.office}
            onChange={(e) => setForm({ ...form, office: e.target.value })}
            placeholder="예: 제주시 애월읍"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button onClick={handleSubmit}>
          <Plus className="size-4" /> 등록 요청
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
