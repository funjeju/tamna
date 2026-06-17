"use client";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "./AuthProvider";
import { useToast } from "@/hooks/use-toast";

export function AuthButton() {
  const { user, loading, signInGoogle, logout } = useAuth();
  const { toast } = useToast();

  if (loading) {
    return (
      <Button variant="ghost" size="sm" disabled className="text-muted-foreground">
        …
      </Button>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-1.5">
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={user.displayName ?? "프로필"}
            className="size-7 rounded-full border border-stone/60"
            referrerPolicy="no-referrer"
          />
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-basalt"
          onClick={() => logout()}
          aria-label="로그아웃"
        >
          <LogOut className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">로그아웃</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5 border-stone/60 text-basalt"
      onClick={async () => {
        try {
          await signInGoogle();
        } catch (e: any) {
          toast({
            title: "로그인 실패",
            description: String(e?.message || e),
            variant: "destructive",
          });
        }
      }}
    >
      <LogIn className="size-4 text-sea" aria-hidden="true" />
      <span className="hidden sm:inline">구글 로그인</span>
    </Button>
  );
}
