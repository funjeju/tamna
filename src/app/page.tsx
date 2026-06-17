"use client";

// TamnaIndex — 메인 페이지 (단일 라우트 /)
// 공개 서비스(PublicApp) + 운영자 콘솔(AdminApp)을 모드 전환으로 제공.

import { useMemo, useState } from "react";
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
import { AuthProvider } from "@/components/auth/AuthProvider";

type Mode = "public" | "admin";

function ModeSwitch({
  mode,
  onToggle,
}: {
  mode: Mode;
  onToggle: () => void;
}) {
  // 운영자 모드일 땐 AdminApp 헤더에 별도 "공개 사이트 보기" 버튼이 있으므로
  // 이 플로팅 버튼은 공개 모드에서만 노출.
  if (mode === "admin") return null;
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
            수집 · 검수 · 게시 · 중개사 관리
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
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
          <AdminApp onExitAdmin={exitAdmin} />
        )}
        <ModeSwitch mode={mode} onToggle={enterAdmin} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
