// GET /api/cron/warm — 공개 API 워밍 (서버리스 콜드스타트 + 엣지 캐시 유지)
// 트래픽이 적어 캐시가 만료되면 매 방문이 콜드(3~4s)라, 주기적으로 origin을 깨워둔다.
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const urls = [
    `${base}/api/listings?status=published&limit=200`,
    `${base}/api/featured`,
    `${base}/api/dashboard`,
  ];
  // no-store 로 origin을 강제로 깨워 함수 warm 유지 + 응답의 s-maxage로 엣지 캐시 갱신
  const results = await Promise.allSettled(
    urls.map((u) => fetch(u, { cache: "no-store" })),
  );
  return NextResponse.json({
    ok: true,
    at: new Date().toISOString(),
    warmed: results.map((r, i) => ({
      url: urls[i].replace(base, ""),
      ok: r.status === "fulfilled" && (r.value as Response).ok,
    })),
  });
}
