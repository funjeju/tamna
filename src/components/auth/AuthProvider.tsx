"use client";
// 구글 로그인 컨텍스트 — 인증 상태 + 로그인/로그아웃 + ID 토큰 + 역할(admin/member)
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
import { setAuthToken, authHeaders } from "@/lib/authToken";

type Role = "admin" | "member" | "guest";

interface AuthCtx {
  user: User | null;
  loading: boolean;
  role: Role;
  isAdmin: boolean;
  signInGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  role: "guest",
  isAdmin: false,
  signInGoogle: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("guest");

  useEffect(() => {
    const unsub = onIdTokenChanged(clientAuth, async (u) => {
      setUser(u);
      if (u) {
        setAuthToken(await u.getIdToken());
        // 로그인 시 프로필 업서트 + 역할 수신
        try {
          const res = await fetch("/api/me", {
            method: "POST",
            headers: authHeaders(),
          });
          const data = await res.json();
          setRole((data.role as Role) ?? "member");
        } catch {
          setRole("member");
        }
      } else {
        setAuthToken(null);
        setRole("guest");
      }
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
    <Ctx.Provider
      value={{
        user,
        loading,
        role,
        isAdmin: role === "admin",
        signInGoogle,
        logout,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
