// GET /api/cron/policy-refresh — 정책값 RAG 갱신 (웹검색 → Firestore 캐시)
import { NextRequest, NextResponse } from "next/server";
import { fetchLatestPolicy } from "@/lib/decision/policy-rag";
import { savePolicy } from "@/lib/decision/policy-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const snap = await fetchLatestPolicy();
  if (!snap) {
    return NextResponse.json({ ok: false, reason: "검색 실패/범위이탈 — 시드 유지", at: new Date().toISOString() });
  }
  await savePolicy(snap);
  return NextResponse.json({ ok: true, snapshot: snap, at: new Date().toISOString() });
}
