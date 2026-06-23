"use client";
// TamnaIndex — 접속 통계 대시보드
// 방문·상세조회·검색 + 지역별/유형별/소스별 관심 + 인기 검색어/매물
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  MapPin,
  MousePointerClick,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StatsResponse {
  totals: { visits: number; detailViews: number; searches: number };
  daily: { date: string; visits: number; detailViews: number; searches: number }[];
  topListings: { listingId: string; title: string; region: string; views: number }[];
  byRegion: { region: string; views: number }[];
  byType: { type: string; views: number }[];
  bySource: { youtube: number; blog: number };
  topKeywords: { keyword: string; count: number }[];
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
  const engagement =
    data && data.totals.visits > 0
      ? Math.round((data.totals.detailViews / data.totals.visits) * 100)
      : 0;
  const sourceTotal = (data?.bySource.youtube ?? 0) + (data?.bySource.blog ?? 0);

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-basalt">접속 통계</h1>
          <p className="text-sm text-muted-jeju mt-0.5">
            방문·상세조회·검색 + 지역·유형·소스별 관심도
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          새로고침
        </Button>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="총 방문" value={data?.totals.visits} loading={isLoading} icon={<Users className="size-4" />} color="#176b6b" />
        <StatCard label="오늘 방문" value={today?.visits} loading={isLoading} icon={<TrendingUp className="size-4" />} color="#e2702a" />
        <StatCard label="총 상세조회" value={data?.totals.detailViews} loading={isLoading} icon={<Eye className="size-4" />} color="#176b6b" />
        <StatCard label="상세/방문" value={engagement} suffix="%" loading={isLoading} icon={<MousePointerClick className="size-4" />} color="#176b6b" />
        <StatCard label="총 검색" value={data?.totals.searches} loading={isLoading} icon={<Search className="size-4" />} color="#e2702a" />
      </div>

      {/* 14일 방문 추이 */}
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
                      title={`${d.date} · 방문 ${d.visits} · 상세 ${d.detailViews} · 검색 ${d.searches}`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-muted-jeju">{d.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 지역별 · 유형별 관심 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="지역별 관심 (상세조회)"
          icon={<MapPin className="size-4 text-tangerine" />}
          loading={isLoading}
          items={data?.byRegion.map((r) => ({ label: r.region, value: r.views })) ?? []}
          color="#176b6b"
          empty="아직 지역별 조회가 없습니다."
        />
        <BreakdownCard
          title="유형별 관심 (상세조회)"
          loading={isLoading}
          items={data?.byType.map((t) => ({ label: t.type, value: t.views })) ?? []}
          color="#e2702a"
          empty="아직 유형별 조회가 없습니다."
        />
      </div>

      {/* 소스 분포 · 인기 검색어 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-basalt mb-3">소스 분포 (상세조회)</h2>
            {isLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : sourceTotal === 0 ? (
              <p className="py-6 text-center text-sm text-muted-jeju">아직 조회가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex h-4 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-red-500"
                    style={{ width: `${((data!.bySource.youtube / sourceTotal) * 100).toFixed(1)}%` }}
                    title={`유튜브 ${data!.bySource.youtube}`}
                  />
                  <div
                    className="bg-emerald-500"
                    style={{ width: `${((data!.bySource.blog / sourceTotal) * 100).toFixed(1)}%` }}
                    title={`블로그 ${data!.bySource.blog}`}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-red-500" /> 유튜브
                    <b className="font-mono text-basalt">{data!.bySource.youtube.toLocaleString("ko-KR")}</b>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-emerald-500" /> 블로그
                    <b className="font-mono text-basalt">{data!.bySource.blog.toLocaleString("ko-KR")}</b>
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h2 className="text-sm font-semibold text-basalt mb-3 inline-flex items-center gap-1.5">
              <Search className="size-4 text-sea" /> 인기 검색어
            </h2>
            {isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : data && data.topKeywords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {data.topKeywords.map((k, i) => (
                  <span
                    key={k.keyword}
                    className="inline-flex items-center gap-1 rounded-full border border-stone/50 bg-paper/50 px-2.5 py-1 text-xs"
                    style={{ fontSize: `${Math.min(15, 11 + (data.topKeywords[0].count ? (k.count / data.topKeywords[0].count) * 4 : 0))}px` }}
                  >
                    {i < 3 ? <span className="text-tangerine font-bold">#{i + 1}</span> : null}
                    <span className="text-basalt">{k.keyword}</span>
                    <span className="font-mono text-muted-jeju">{k.count}</span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-jeju">아직 검색 기록이 없습니다.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 인기 매물 */}
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
                <li key={l.listingId} className="flex items-center gap-3 rounded-md border border-stone/40 px-3 py-2">
                  <span className="font-mono text-sm font-bold text-stone w-5 text-center">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-basalt truncate">{l.title}</p>
                    {l.region ? <p className="text-[11px] text-muted-jeju">{l.region}</p> : null}
                  </div>
                  <span className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-sea">
                    <Eye className="size-3.5" />
                    {l.views.toLocaleString("ko-KR")}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="py-8 text-center text-sm text-muted-jeju">아직 집계된 상세조회가 없습니다.</p>
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
  suffix,
}: {
  label: string;
  value: number | undefined;
  loading?: boolean;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
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
            {suffix ? <span className="text-base">{suffix}</span> : null}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownCard({
  title,
  icon,
  items,
  color,
  loading,
  empty,
}: {
  title: string;
  icon?: React.ReactNode;
  items: { label: string; value: number }[];
  color: string;
  loading?: boolean;
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Card>
      <CardContent className="p-4">
        <h2 className="text-sm font-semibold text-basalt mb-3 inline-flex items-center gap-1.5">
          {icon}
          {title}
        </h2>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-jeju">{empty}</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.label} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs text-basalt">{it.label}</span>
                <div className="flex-1 h-5 rounded bg-paper overflow-hidden">
                  <div
                    className="h-full rounded transition-all"
                    style={{ width: `${Math.max(4, (it.value / max) * 100)}%`, backgroundColor: color, opacity: 0.85 }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-xs font-semibold" style={{ color }}>
                  {it.value.toLocaleString("ko-KR")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default StatsPanel;
