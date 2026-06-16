// GET /api/collection — 수집잡 목록
// POST /api/collection — 수집 실행(시뮬레이션)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapCollectionJob } from "@/lib/mapper";

export async function GET() {
  const jobs = await db.collectionJob.findMany({
    orderBy: { startedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({ jobs: jobs.map(mapCollectionJob) });
}

// 수집 시뮬레이션: 가짜 videoId 5~8개 생성 → 1~2개는 실패로 표시
export async function POST(req: NextRequest) {
  const body = await req.json();
  const region = body.region || "전체";
  const periodDays = body.periodDays || 2;
  const keyword = body.keyword || "제주 부동산";

  const found = 5 + Math.floor(Math.random() * 4); // 5~8
  const failed = Math.random() < 0.5 ? 1 : 0;
  const processed = found - failed;

  const items = Array.from({ length: found }).map((_, i) => {
    const isFail = i === found - 1 && failed > 0;
    const steps = ["search", "transcript", "structuring", "geocode", "saved"];
    return {
      videoId: `sim_${Date.now()}_${i}_${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      step: isFail ? steps[1 + Math.floor(Math.random() * 2)] : "saved",
      source: i % 2 === 0 ? "socialkit" : "youtube",
      status: isFail ? ("fail" as const) : ("ok" as const),
      detail: isFail
        ? "자막 추출 3회 재시도 실패"
        : `키워드 "${keyword}" 매칭`,
    };
  });

  const startedAt = new Date();
  const job = await db.collectionJob.create({
    data: {
      trigger: "manual",
      region,
      found,
      processed,
      failed,
      items: JSON.stringify(items),
      startedAt,
      finishedAt: new Date(startedAt.getTime() + 90 * 1000),
    },
  });
  return NextResponse.json({ job: mapCollectionJob(job) });
}
