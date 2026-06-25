// GET /api/admin/cron-config — 설정 조회
// POST /api/admin/cron-config — 설정 저장
// POST /api/admin/cron-config?trigger=youtube|blog — 즉시 수집 실행
import { NextRequest, NextResponse } from "next/server";
import { getCronConfig, saveCronConfig } from "@/lib/cron-config";

export async function GET() {
  const cfg = await getCronConfig();
  return NextResponse.json(cfg);
}

export async function POST(req: NextRequest) {
  const trigger = req.nextUrl.searchParams.get("trigger") as
    | "youtube"
    | "blog"
    | "rotation"
    | "content"
    | "policy"
    | null;

  // 즉시 수집 트리거 — 서버에서 CRON_SECRET을 붙여 cron 라우트 호출
  if (
    trigger === "youtube" || trigger === "blog" || trigger === "rotation" ||
    trigger === "content" || trigger === "policy"
  ) {
    const path =
      trigger === "youtube"
        ? "/api/cron/collect"
        : trigger === "blog"
          ? "/api/cron/collect-blog"
          : trigger === "rotation"
            ? "/api/cron/collect-rotation"
            : trigger === "content"
              ? "/api/cron/content"
              : "/api/cron/policy-refresh";
    const base = req.nextUrl.origin;
    const res = await fetch(`${base}${path}?force=true`, {
      headers: {
        authorization: process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : "",
      },
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ triggered: trigger, result: data });
  }

  // 설정 저장
  const body = await req.json();
  await saveCronConfig(body);
  return NextResponse.json({ ok: true });
}
