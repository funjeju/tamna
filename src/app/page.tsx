"use client";

// TamnaIndex — 메인 페이지 (단일 라우트 /)
// 공개 서비스(PublicApp) + 운영자 콘솔(AdminApp)을 모드 전환으로 제공.

import { useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ShieldCheck, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import PublicApp from "@/components/public/PublicApp";
import AdminApp from "@/components/admin/AdminApp";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";

type Mode = "public" | "admin";

function ModeSwitch({
  mode,
  onToggle,
}: {
  mode: Mode;
  onToggle: () => void;
}) {
  const { user, isAdmin, loading, signInGoogle } = useAuth();
  const { toast } = useToast();

  // 운영자 모드일 땐 AdminApp 헤더에 별도 "공개 사이트 보기" 버튼이 있으므로
  // 이 플로팅 버튼은 공개 모드에서만 노출.
  if (mode === "admin") return null;

  // 운영자 권한이 없으면 버튼 자체를 숨김 (admin 만 노출)
  if (loading || !user || !isAdmin) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[60] print:hidden">
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggle}
              size="sm"
              variant="outline"
              className="h-10 gap-2 rounded-full border-stone bg-card/95 px-4 shadow-lg backdrop-blur hover:border-sea hover:text-sea"
              aria-label="운영자 콘솔 전환"
            >
              <ShieldCheck className="size-4" />
              <span className="text-xs font-semibold">운영자 콘솔</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            수집 · 검수 · 게시 · 회원 관리
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// 관리자만 AdminApp 렌더 (직접 진입 방어)
function AdminGate({ onExitAdmin }: { onExitAdmin: () => void }) {
  const { isAdmin, loading } = useAuth();
  useEffect(() => {
    if (!loading && !isAdmin) onExitAdmin();
  }, [loading, isAdmin, onExitAdmin]);
  if (loading || !isAdmin) return null;
  return <AdminApp onExitAdmin={onExitAdmin} />;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("public");
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 20 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  const enterAdmin = useMemo(() => () => setMode("admin"), []);
  const exitAdmin = useMemo(() => () => setMode("public"), []);

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        {mode === "public" ? (
          <PublicApp />
        ) : (
          <AdminGate onExitAdmin={exitAdmin} />
        )}
        <ModeSwitch mode={mode} onToggle={enterAdmin} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
