// GET /api/cron/collect-rotation — 읍면동 로테이션 수집
// 매 실행마다 다음 4개 읍면동 순서대로 처리 (15개 ÷ 4 = 약 4일 전체 순환)
import { NextRequest, NextResponse } from "next/server";
import { runRotationCollection } from "@/lib/collect-rotation";
import { getCronConfig } from "@/lib/cron-config";
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

  // 어드민 설정에서 rotation 활성화 여부 확인
  const force = req.nextUrl.searchParams.get("force") === "true";
  if (!force) {
    const cfg = await getCronConfig();
    if (!(cfg as any).rotation?.enabled) {
      return NextResponse.json({ ok: true, skipped: true, reason: "rotation 비활성", at: new Date().toISOString() });
    }
  }

  let result: any = null;
  try {
    result = await runRotationCollection();
  } catch (e: any) {
    result = { error: String(e?.message || e) };
  }

  // confidence 0.95↑ draft 자동 게시
  let autoPublish: any = null;
  try {
    const snap = await adminDb.collection("listings").where("status", "==", "draft").get();
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

  return NextResponse.json({ ok: true, result, autoPublish, at: new Date().toISOString() });
}
