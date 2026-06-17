// GET /api/cron/collect — 매일 자동 실행 (Vercel Cron)
// 1) 신규 매물 수집  2) 기존 매물 가격 변경 재확인
import { NextRequest, NextResponse } from "next/server";
import { runCollection, recheckUpdates } from "@/lib/collect";

export const maxDuration = 300; // Vercel Pro
export const dynamic = "force-dynamic";

// 매일 돌릴 기본 검색 세트
const DEFAULT_QUERIES = [
  { region: "전체", keyword: "매물" },
  { region: "전체", keyword: "단독주택" },
  { region: "전체", keyword: "토지" },
];

export async function GET(req: NextRequest) {
  // Vercel Cron 은 CRON_SECRET 설정 시 Authorization: Bearer <secret> 를 보냄
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const collected: any[] = [];
  for (const q of DEFAULT_QUERIES) {
    try {
      const job = await runCollection({
        region: q.region,
        periodDays: 2, // 최근 48시간 신규
        keyword: q.keyword,
        trigger: "cron",
      });
      collected.push({ keyword: q.keyword, found: job.found, processed: job.processed, failed: job.failed });
    } catch (e: any) {
      collected.push({ keyword: q.keyword, error: String(e?.message || e) });
    }
  }

  let recheck = null;
  try {
    recheck = await recheckUpdates(10);
  } catch (e: any) {
    recheck = { error: String(e?.message || e) };
  }

  return NextResponse.json({ ok: true, collected, recheck, at: new Date().toISOString() });
}
