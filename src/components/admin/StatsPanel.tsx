"use client";
// TamnaIndex — 접속 통계 패널 (방문·상세조회·최근 14일·인기 매물)
import { useQuery } from "@tanstack/react-query";
import { Eye, MousePointerClick, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsResponse {
  totals: { visits: number; detailViews: number };
  daily: { date: string; visits: number; detailViews: number }[];
  topListings: { listingId: string; title: string; region: string; views: number }[];
  today: string;
}

export function StatsPanel() {
  const { data, isLoading, isFetching, refetch } = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("stats fetch failed");
      return res.json();
    },
  });

  const today = data?.daily.find((d) => d.date === data.today);
  const maxVisits = Math.max(1, ...(data?.daily.map((d) => d.visits) ?? [1]));

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-basalt">접속 통계</h1>
          <p className="text-sm text-muted-jeju mt-0.5">사이트 방문·매물 상세조회 집계</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="총 방문"
          value={data?.totals.visits}
          loading={isLoading}
          icon={<Users className="size-4" />}
          color="#176b6b"
        />
        <StatCard
          label="오늘 방문"
          value={today?.visits}
          loading={isLoading}
          icon={<TrendingUp className="size-4" />}
          color="#e2702a"
        />
        <StatCard
          label="총 상세조회"
          value={data?.totals.detailViews}
          loading={isLoading}
          icon={<Eye className="size-4" />}
          color="#176b6b"
        />
        <StatCard
          label="오늘 상세조회"
          value={today?.detailViews}
          loading={isLoading}
          icon={<MousePointerClick className="size-4" />}
          color="#e2702a"
        />
      </div>

      {/* 최근 14일 방문 추이 */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold text-basalt mb-3">최근 14일 방문 추이</h2>
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {data?.daily.map((d) => (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-sea/80 transition-all hover:bg-sea"
                      style={{ height: `${Math.round((d.visits / maxVisits) * 100)}%` }}
                      title={`${d.date} · 방문 ${d.visits} · 상세 ${d.detailViews}`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-muted-jeju">
                    {d.date.slice(5)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 인기 매물 (상세조회 상위) */}
      <Card>
        <CardContent className="p-4">
          <h2 className="text-sm font-semibold text-basalt mb-3">인기 매물 (상세조회 상위)</h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : data && data.topListings.length > 0 ? (
            <ol className="space-y-1.5">
              {data.topListings.map((l, i) => (
                <li
                  key={l.listingId}
                  className="flex items-center gap-3 rounded-md border border-stone/40 px-3 py-2"
                >
                  <span className="font-mono text-sm font-bold text-stone w-5 text-center">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-basalt truncate">{l.title}</p>
                    {l.region ? (
                      <p className="text-[11px] text-muted-jeju">{l.region}</p>
                    ) : null}
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-sea">
                    <Eye className="size-3.5" />
                    {l.views.toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-muted-jeju">
              아직 집계된 상세조회가 없습니다.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  loading,
  icon,
  color,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-jeju">{label}</span>
          <span style={{ color }}>{icon}</span>
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p className="mt-1 font-mono text-2xl font-bold" style={{ color }}>
            {(value ?? 0).toLocaleString("ko-KR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default StatsPanel;
