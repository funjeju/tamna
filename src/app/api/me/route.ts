// GET /api/me — 현재 사용자 역할 조회
// POST /api/me — 로그인 시 프로필 업서트 + 역할 반환
import { NextRequest, NextResponse } from "next/server";
import { lookupAccount, upsertUser, getRole } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const acc = await lookupAccount(req.headers.get("authorization"));
  if (!acc) return NextResponse.json({ role: "guest" });
  const role = await getRole(acc.uid);
  return NextResponse.json({
    uid: acc.uid,
    email: acc.email,
    displayName: acc.displayName,
    photoURL: acc.photoUrl,
    role,
  });
}

export async function POST(req: NextRequest) {
  const acc = await lookupAccount(req.headers.get("authorization"));
  if (!acc) return NextResponse.json({ role: "guest" }, { status: 401 });
  const role = await upsertUser(acc);
  return NextResponse.json({
    uid: acc.uid,
    email: acc.email,
    displayName: acc.displayName,
    photoURL: acc.photoUrl,
    role,
  });
}
