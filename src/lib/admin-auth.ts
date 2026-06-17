// 서버 측 인증/권한 — firebase-admin/auth(jose ESM 번들 이슈) 대신 Firebase REST 사용
import { adminDb } from "./firebase";

// 부트스트랩 슈퍼관리자 (항상 admin). 콤마로 여러 명 지정 가능.
const SUPER_ADMINS = (process.env.SUPER_ADMIN_EMAILS || "naggu1999@gmail.com")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export type Role = "admin" | "member";

export interface Account {
  uid: string;
  email: string;
  displayName: string | null;
  photoUrl: string | null;
}

function parseToken(authHeader?: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const t = authHeader.slice(7).trim();
  return t || null;
}

// ID 토큰 → 계정 정보 (identitytoolkit accounts:lookup)
export async function lookupAccount(
  authHeader?: string | null,
): Promise<Account | null> {
  const idToken = parseToken(authHeader);
  if (!idToken) return null;
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.replace(/^﻿/, "").trim();
  if (!key) return null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const u = data.users?.[0];
    if (!u?.localId) return null;
    return {
      uid: u.localId,
      email: (u.email || "").toLowerCase(),
      displayName: u.displayName || null,
      photoUrl: u.photoUrl || null,
    };
  } catch {
    return null;
  }
}

// 로그인 시 users/{uid} 업서트 + 역할 결정
export async function upsertUser(acc: Account): Promise<Role> {
  const ref = adminDb.collection("users").doc(acc.uid);
  const snap = await ref.get();
  const existing = snap.exists ? (snap.data() as any) : null;
  const isSuper = SUPER_ADMINS.includes(acc.email);
  const role: Role = isSuper ? "admin" : (existing?.role ?? "member");
  await ref.set(
    {
      uid: acc.uid,
      email: acc.email,
      displayName: acc.displayName,
      photoURL: acc.photoUrl,
      role,
      lastLoginAt: new Date(),
      createdAt: existing?.createdAt ?? new Date(),
    },
    { merge: true },
  );
  return role;
}

export async function getRole(uid: string): Promise<Role> {
  const snap = await adminDb.collection("users").doc(uid).get();
  return snap.exists ? ((snap.data() as any).role ?? "member") : "member";
}

// admin 권한 확인 → uid 반환, 아니면 null
export async function requireAdmin(
  authHeader?: string | null,
): Promise<string | null> {
  const acc = await lookupAccount(authHeader);
  if (!acc) return null;
  if (SUPER_ADMINS.includes(acc.email)) return acc.uid;
  const role = await getRole(acc.uid);
  return role === "admin" ? acc.uid : null;
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMINS.includes(email.toLowerCase());
}
