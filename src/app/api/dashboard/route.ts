// GET /api/dashboard — 운영자 대시보드 KPI
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const yesterday = new Date(now.getTime() - dayMs);
  const weekAgo = new Date(now.getTime() - 7 * dayMs);

  const [
    total,
    published,
    draft,
    error,
    optedOut,
    rejected,
    agents,
    verifiedAgents,
    optedOutAgents,
    todayCollected,
    weekCollected,
    todayJobs,
    weekJobs,
    optOuts,
    favoritesCount,
    failedJobs,
  ] = await Promise.all([
    db.listing.count(),
    db.listing.count({ where: { status: "published" } }),
    db.listing.count({ where: { status: "draft" } }),
    db.listing.count({ where: { status: "error" } }),
    db.listing.count({ where: { status: "opted_out" } }),
    db.listing.count({ where: { status: "rejected" } }),
    db.agent.count(),
    db.agent.count({ where: { verified: true } }),
    db.agent.count({ where: { optedOut: true } }),
    db.listing.count({ where: { collectedAt: { gte: yesterday } } }),
    db.listing.count({ where: { collectedAt: { gte: weekAgo } } }),
    db.collectionJob.count({ where: { startedAt: { gte: yesterday } } }),
    db.collectionJob.count({ where: { startedAt: { gte: weekAgo } } }),
    db.optOut.count(),
    db.favorite.count(),
    db.collectionJob.aggregate({ _sum: { failed: true } }),
  ]);

  const jobs = await db.collectionJob.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
  });

  // 신선도: 최근 7일 신규 비율
  const freshness =
    total > 0 ? Math.round((weekCollected / total) * 100) : 0;
  // 수집 실패율
  const totalFound = jobs.reduce((s, j) => s + j.found, 0);
  const totalFailedRecent = jobs.reduce((s, j) => s + j.failed, 0);
  const failRate =
    totalFound > 0 ? Math.round((totalFailedRecent / totalFound) * 100) : 0;

  return NextResponse.json(
    {
    kpi: {
      total,
      published,
      draft,
      error,
      optedOut,
      rejected,
      todayCollected,
      weekCollected,
      freshness,
      failRate,
      agents,
      verifiedAgents,
      optedOutAgents,
      todayJobs,
      weekJobs,
      optOuts,
      favoritesCount,
      failedJobsTotal: failedJobs._sum.failed ?? 0,
    },
    recentJobs: jobs.map((j) => ({
      id: j.id,
      trigger: j.trigger,
      region: j.region,
      found: j.found,
      processed: j.processed,
      failed: j.failed,
      startedAt: j.startedAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
    })),
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=180" } },
  );
}
