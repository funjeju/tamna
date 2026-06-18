// GET /api/cron/collect-blog — 이틀에 한 번 (Vercel Cron)
// 네이버 블로그 제주 부동산 매물 수집
import { NextRequest, NextResponse } from "next/server";
import { runBlogCollection } from "@/lib/collect-blog";
import { adminDb } from "@/lib/firebase";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  let collected: any = null;
  try {
    const job = await runBlogCollection();
    collected = { found: job.found, processed: job.processed, failed: job.failed };
  } catch (e: any) {
    collected = { error: String(e?.message || e) };
  }

  // confidence 0.95 이상 draft → 자동 게시
  let autoPublish: any = null;
  try {
    const snap = await adminDb.collection("listings")
      .where("status", "==", "draft")
      .where("sourceType", "==", "blog")
      .get();
    const targets = snap.docs.filter((d) => {
      const c = (d.data() as any).confidence;
      return typeof c === "number" && c >= 0.95;
    });
    const batch = adminDb.batch();
    for (const d of targets) {
      batch.set(d.ref, { status: "published", reviewedBy: "auto", publishedAt2: new Date(), updatedAt: new Date() }, { merge: true });
    }
    if (targets.length > 0) await batch.commit();
    autoPublish = { published: targets.length };
  } catch (e: any) {
    autoPublish = { error: String(e?.message || e) };
  }

  return NextResponse.json({ ok: true, collected, autoPublish, at: new Date().toISOString() });
}
