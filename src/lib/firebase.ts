// Firebase Admin (server-only). 빌드 시 모듈 로드만으로 초기화되지 않도록 지연 초기화.
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function loadServiceAccount() {
  let raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT 환경변수가 없습니다. (.env.local 또는 Vercel 환경변수 설정 필요)",
    );
  }
  // BOM/따옴표/공백 방어
  raw = raw.replace(/^﻿/, "").trim();
  if (
    (raw.startsWith("'") && raw.endsWith("'")) ||
    (raw.startsWith('"') && raw.endsWith('"'))
  ) {
    raw = raw.slice(1, -1);
  }
  const sa = JSON.parse(raw);
  if (typeof sa.private_key === "string") {
    sa.private_key = sa.private_key.replace(/\\n/g, "\n");
  }
  return sa;
}

let _app: App | undefined;
let _db: Firestore | undefined;

function app(): App {
  if (_app) return _app;
  _app = getApps()[0] ?? initializeApp({ credential: cert(loadServiceAccount()) });
  return _app;
}

// 첫 사용 시점에만 초기화되는 Firestore 프록시
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_t, prop) {
    if (!_db) _db = getFirestore(app());
    const v = (_db as any)[prop];
    return typeof v === "function" ? v.bind(_db) : v;
  },
});

// ID 토큰 검증 → uid 반환 (실패 시 null)
// firebase-admin/auth 는 jwks-rsa→jose(ESM) 의존성으로 번들이 깨지므로
// Firebase REST(identitytoolkit accounts:lookup)로 토큰을 검증한다.
export async function verifyUid(authHeader?: string | null): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const idToken = authHeader.slice(7).trim();
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
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}
