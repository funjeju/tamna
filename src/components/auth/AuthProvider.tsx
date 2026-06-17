"use client";
// 구글 로그인 컨텍스트 — 인증 상태 + 로그인/로그아웃 + ID 토큰 관리
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { clientAuth, googleProvider } from "@/lib/firebase.client";
import { setAuthToken } from "@/lib/authToken";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signInGoogle: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onIdTokenChanged(clientAuth, async (u) => {
      setUser(u);
      setAuthToken(u ? await u.getIdToken() : null);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInGoogle = async () => {
    await signInWithPopup(clientAuth, googleProvider);
  };
  const logout = async () => {
    await signOut(clientAuth);
  };

  return (
    <Ctx.Provider value={{ user, loading, signInGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}
