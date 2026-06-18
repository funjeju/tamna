// GET /api/cron/collect — 매일 새벽 1시 KST 자동 실행 (Vercel Cron)
// 1) 신규 매물 수집  2) 기존 매물 가격 변경 재확인  3) confidence 0.95↑ draft 자동 게시
import { NextRequest, NextResponse } from "next/server";
import { runCollection, recheckUpdates } from "@/lib/collect";
import { adminDb } from "@/lib/firebase";

export const maxDuration = 300; // Vercel Pro
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Vercel Cron 은 CRON_SECRET 설정 시 Authorization: Bearer <secret> 를 보냄
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  // 딥 수집: 넓은 기간(약 4개월) + 다변화 쿼리(searchCandidates 내부 7종×2페이지)로
  // 후보를 깊게 훑고, 신규만 검수큐(draft)로 적재.
  let collected: any = null;
  try {
    const job = await runCollection({
      region: "전체",
      periodDays: 120,
      keyword: "매물",
      trigger: "cron",
    });
    collected = { found: job.found, processed: job.processed, failed: job.failed };
  } catch (e: any) {
    collected = { error: String(e?.message || e) };
  }

  let recheck = null;
  try {
    recheck = await recheckUpdates(15);
  } catch (e: any) {
    recheck = { error: String(e?.message || e) };
  }

  // 3) confidence 0.95 이상 draft → 자동 게시 (force: 게이트 조건 미충족도 포함)
  let autoPublish: any = null;
  try {
    const snap = await adminDb
      .collection("listings")
      .where("status", "==", "draft")
      .get();
    const targets = snap.docs.filter((d) => {
      const c = (d.data() as any).confidence;
      return typeof c === "number" && c >= 0.95;
    });
    const batch = adminDb.batch();
    for (const d of targets) {
      batch.set(
        d.ref,
        { status: "published", reviewedBy: "auto", publishedAt2: new Date(), updatedAt: new Date() },
        { merge: true },
      );
    }
    if (targets.length > 0) await batch.commit();
    autoPublish = { published: targets.length };
  } catch (e: any) {
    autoPublish = { error: String(e?.message || e) };
  }

  return NextResponse.json({ ok: true, collected, recheck, autoPublish, at: new Date().toISOString() });
}
