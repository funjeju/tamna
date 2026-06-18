// GET /api/cron/collect — 매일 새벽 1시 KST 자동 실행 (Vercel Cron)
// 1) 신규 매물 수집  2) 기존 매물 가격 변경 재확인  3) confidence 0.95↑ draft 자동 게시
import { NextRequest, NextResponse } from "next/server";
import { runCollection, recheckUpdates } from "@/lib/collect";
import { adminDb } from "@/lib/firebase";
import { getCronConfig, shouldRun, markRan } from "@/lib/cron-config";

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

  // 어드민 설정 확인 — skip 가능 (force=true 쿼리 파라미터로 강제 실행)
  const force = req.nextUrl.searchParams.get("force") === "true";
  if (!force) {
    const cfg = await getCronConfig();
    if (!shouldRun(cfg.youtube)) {
      return NextResponse.json({ ok: true, skipped: true, reason: "interval 미충족 또는 비활성", at: new Date().toISOString() });
    }
  }
  await markRan("youtube");

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
