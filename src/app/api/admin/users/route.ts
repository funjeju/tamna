// GET /api/admin/users — 회원 목록 (admin 전용)
// PATCH /api/admin/users — 회원 역할 변경 (admin 전용)
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase";
import { requireAdmin, isSuperAdmin } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUid = await requireAdmin(req.headers.get("authorization"));
  if (!adminUid)
    return NextResponse.json({ error: "운영자 권한 필요" }, { status: 403 });

  const snap = await adminDb.collection("users").get();
  const users = snap.docs
    .map((d) => {
      const u = d.data() as any;
      return {
        uid: u.uid ?? d.id,
        email: u.email ?? "",
        displayName: u.displayName ?? null,
        photoURL: u.photoURL ?? null,
        role: u.role ?? "member",
        isSuper: isSuperAdmin(u.email),
        lastLoginAt: u.lastLoginAt?.toDate?.()?.toISOString?.() ?? null,
        createdAt: u.createdAt?.toDate?.()?.toISOString?.() ?? null,
      };
    })
    .sort((a, b) => (b.lastLoginAt ?? "").localeCompare(a.lastLoginAt ?? ""));

  return NextResponse.json({ users, total: users.length });
}

export async function PATCH(req: NextRequest) {
  const adminUid = await requireAdmin(req.headers.get("authorization"));
  if (!adminUid)
    return NextResponse.json({ error: "운영자 권한 필요" }, { status: 403 });

  const body = await req.json();
  const uid = body.uid as string;
  const role = body.role === "admin" ? "admin" : "member";
  if (!uid) return NextResponse.json({ error: "uid 누락" }, { status: 400 });

  const ref = adminDb.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists)
    return NextResponse.json({ error: "사용자 없음" }, { status: 404 });

  // 슈퍼관리자는 강등 불가
  if (isSuperAdmin((snap.data() as any).email) && role !== "admin") {
    return NextResponse.json(
      { error: "슈퍼관리자는 권한을 내릴 수 없습니다" },
      { status: 400 },
    );
  }

  await ref.set({ role }, { merge: true });
  return NextResponse.json({ uid, role });
}
