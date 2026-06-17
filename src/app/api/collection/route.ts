// GET /api/collection — 수집잡 목록
// POST /api/collection — 실제 수집 실행 (YouTube → AI 구조화 → 지오코딩 → 저장)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapCollectionJob } from "@/lib/mapper";
import { runCollection } from "@/lib/collect";

export const maxDuration = 300; // Vercel Pro
export const dynamic = "force-dynamic";

export async function GET() {
  const jobs = await db.collectionJob.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ jobs: jobs.map(mapCollectionJob) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const region = body.region || "전체";
  const periodDays = Number(body.periodDays) || 7;
  const keyword = body.keyword || "매물";

  try {
    const job = await runCollection({ region, periodDays, keyword, trigger: "manual" });
    return NextResponse.json({
      job: {
        id: job.id,
        trigger: job.trigger,
        region: job.region,
        found: job.found,
        processed: job.processed,
        failed: job.failed,
        items: job.items,
        startedAt: job.startedAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: "수집 실패", detail: String(e?.message || e) },
      { status: 500 },
    );
  }
}
