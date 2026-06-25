// GET /api/decision/rules — 유효 정책값(갱신 over 시드) 조회
import { NextResponse } from "next/server";
import { getEffectivePolicy } from "@/lib/decision/policy-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const policy = await getEffectivePolicy();
  return NextResponse.json(policy, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
