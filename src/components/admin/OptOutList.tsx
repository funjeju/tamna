"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Ban,
  Building2,
  Clock,
  Eye,
  EyeOff,
  Info,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTime, fmtTimeAgo } from "./lib/canPublish";
import type { Agent } from "@/lib/types";

interface DummyOptOut {
  key: string;
  reason: string;
  requestedBy: string;
  at: string;
  isChannel: boolean;
}

const DUMMY_OPTOUTS: DummyOptOut[] = [
  {
    key: "UC_dummy_001",
    reason: "소유자 요청 — 비대면 임장 후 철회",
    requestedBy: "owner",
    at: new Date(Date.now() - 3 * 86400000).toISOString(),
    isChannel: false,
  },
  {
    key: "UC_dummy_channel_002",
    reason: "채널 운영자 요청 — 채널 폐쇄",
    requestedBy: "agent",
    at: new Date(Date.now() - 10 * 86400000).toISOString(),
    isChannel: true,
  },
];

export function OptOutList() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  // 옵트아웃 중개사 조회
  const { data, isLoading } = useQuery<{ agents: Agent[]; total: number }>({
    queryKey: ["agents", "opted_out"],
    queryFn: async () => {
      const res = await fetch(`/api/agents?status=opted_out`);
      if (!res.ok) throw new Error("fetch failed");
      return res.json();
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optedOut: false }),
      });
      if (!res.ok) throw new Error("release failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      toast({
        title: "옵트아웃 해제됨",
        description: "해당 채널의 매물이 다시 수집 대상에 포함됩니다.",
      });
    },
  });

  const handleDummyRelease = (key: string) => {
    toast({
      title: "옵트아웃 해제 요청 (더미)",
      description: `${key} — 해제 처리는 운영자 승인 후 적용됩니다.`,
    });
  };

  const agents = data?.agents ?? [];
  const filteredAgents = useMemo(() => {
    if (!search) return agents;
    const s = search.toLowerCase();
    return agents.filter(
      (a) =>
        a.channelName.toLowerCase().includes(s) ||
        a.channelId.toLowerCase().includes(s),
    );
  }, [agents, search]);

  const filteredDummy = useMemo(() => {
    if (!search) return DUMMY_OPTOUTS;
    const s = search.toLowerCase();
    return DUMMY_OPTOUTS.filter(
      (d) => d.key.toLowerCase().includes(s) || d.reason.toLowerCase().includes(s),
    );
  }, [search]);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-basalt flex items-center gap-2">
          <EyeOff className="size-6 text-muted-jeju" />
          옵트아웃 관리
          <Badge variant="outline" className="font-mono text-sm">
            {agents.length + DUMMY_OPTOUTS.length}건
          </Badge>
        </h1>
        <p className="text-sm text-muted-jeju mt-0.5">
          중개사·소유자 요청에 의한 노출 중단 리스트 — 즉시 takedown + 재수집 제외
        </p>
      </div>

      {/* 정책 안내 */}
      <Alert>
        <Info className="size-4 text-sea" />
        <AlertTitle className="text-sea">옵트아웃 정책</AlertTitle>
        <AlertDescription className="text-muted-jeju">
          중개사 또는 소유자 요청 시 <strong className="text-basalt">즉시 takedown</strong>{" "}
          + <strong className="text-basalt">재수집 제외</strong>됩니다.
          <strong className="text-basalt"> 채널 단위 옵트아웃</strong>을 지원하며,
          해제 시에만 다시 수집 대상에 포함됩니다.
          모든 옵트아웃 요청은 운영 로그에 기록됩니다.
        </AlertDescription>
      </Alert>

      {/* 검색 */}
      <div className="relative w-full max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-jeju" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="채널명/ID/사유 검색"
          className="pl-8"
        />
      </div>

      {/* 채널 단위 옵트아웃 (DB) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="size-4 text-tangerine" />
            채널 단위 옵트아웃
            <Badge variant="outline" className="ml-auto text-muted-jeju">
              {agents.length}건
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-jeju">
              채널 단위 옵트아웃이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>채널</TableHead>
                    <TableHead>채널 ID</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>요청자</TableHead>
                    <TableHead>일시</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map((a) => (
                    <TableRow key={a.id} className="hover:bg-paper/40">
                      <TableCell className="font-medium">{a.channelName}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-jeju">
                        {a.channelId}
                      </TableCell>
                      <TableCell className="text-xs text-muted-jeju">
                        채널 단위 옵트아웃
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          admin
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-jeju">
                        {fmtTimeAgo(a.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => releaseMutation.mutate(a.id)}
                          disabled={releaseMutation.isPending}
                          className="text-sea hover:text-sea"
                        >
                          <RotateCcw className="size-3.5" /> 해제
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 영상 단위 옵트아웃 (더미) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="size-4 text-destructive" />
            영상 단위 옵트아웃
            <Badge variant="outline" className="ml-auto text-muted-jeju">
              {filteredDummy.length}건 (더미 포함)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredDummy.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-jeju">
              영상 단위 옵트아웃이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>영상/채널 ID</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>요청자</TableHead>
                    <TableHead>일시</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDummy.map((d, i) => (
                    <TableRow key={`${d.key}-${i}`} className="hover:bg-paper/40">
                      <TableCell className="font-mono text-xs text-muted-jeju">
                        {d.key}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            d.isChannel
                              ? "border-tangerine/40 text-tangerine text-[11px]"
                              : "border-stone text-muted-jeju text-[11px]"
                          }
                        >
                          {d.isChannel ? "채널" : "영상"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <AlertCircle className="size-3 text-muted-jeju" />
                          {d.reason}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {d.requestedBy === "owner" ? (
                            <User className="size-3" />
                          ) : (
                            <ShieldAlert className="size-3" />
                          )}
                          {d.requestedBy}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-jeju">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {fmtDateTime(d.at)} ({fmtTimeAgo(d.at)})
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDummyRelease(d.key)}
                          className="text-sea hover:text-sea"
                        >
                          <RotateCcw className="size-3.5" /> 해제
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 푸터 안내 */}
      <Card className="bg-paper/40">
        <CardContent className="p-3 flex items-center gap-3 text-xs text-muted-jeju">
          <Trash2 className="size-4 text-stone" />
          <p>
            영상 단위 옵트아웃은 운영자가 직접 사유를 등록합니다. 자동화된
            takedown 파이프라인은 영상 ID 기준으로 optOut 테이블을 조회하여 즉시
            적용됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
