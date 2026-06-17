"use client";
// 회원 관리 — 사용자 목록 + 운영자(admin) 권한 토글
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, User as UserIcon, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { authHeaders } from "@/lib/authToken";

interface MemberRow {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  role: "admin" | "member";
  isSuper: boolean;
  lastLoginAt: string | null;
}

export function MemberManagement() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<{ users: MemberRow[] }>({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { headers: authHeaders() });
      if (!res.ok) throw new Error("권한이 없거나 조회 실패");
      return res.json();
    },
  });

  const mutation = useMutation({
    mutationFn: async (payload: { uid: string; role: "admin" | "member" }) => {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "변경 실패");
      }
      return res.json();
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "권한 변경됨",
        description: `${d.role === "admin" ? "운영자로 지정" : "일반 회원으로 변경"}했습니다.`,
      });
    },
    onError: (e: any) => {
      toast({ title: "변경 실패", description: String(e?.message), variant: "destructive" });
    },
  });

  const users = data?.users ?? [];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold text-basalt">회원 관리</h1>
        <p className="mt-0.5 text-sm text-muted-jeju">
          가입한 회원 목록과 운영자 권한 지정. 운영자로 지정하면 운영자 콘솔에
          접근할 수 있습니다.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-dashed border-stone/70 bg-paper/50 p-8 text-center text-sm text-muted-foreground">
          회원 목록을 불러올 수 없습니다. (운영자 권한 필요)
        </div>
      ) : isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone/70 bg-paper/50 p-8 text-center text-sm text-muted-foreground">
          아직 로그인한 회원이 없습니다. 구글 로그인하면 여기 표시됩니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stone/60">
          <table className="w-full text-sm">
            <thead className="bg-paper/60 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">회원</th>
                <th className="px-4 py-2 font-medium">역할</th>
                <th className="px-4 py-2 text-right font-medium">운영자 권한</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.uid} className="border-t border-stone/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={u.photoURL}
                          alt=""
                          className="size-8 rounded-full border border-stone/50"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <UserIcon className="size-4" />
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="truncate font-medium text-basalt">
                          {u.displayName || u.email || u.uid}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.isSuper ? (
                      <Badge className="border-transparent bg-tangerine/90 text-tangerine-foreground">
                        <Crown className="size-3" /> 슈퍼관리자
                      </Badge>
                    ) : u.role === "admin" ? (
                      <Badge className="border-transparent bg-sea text-sea-foreground">
                        <ShieldCheck className="size-3" /> 운영자
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-stone/60 text-muted-foreground">
                        일반 회원
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Switch
                      checked={u.role === "admin"}
                      disabled={u.isSuper || mutation.isPending}
                      onCheckedChange={(checked) =>
                        mutation.mutate({
                          uid: u.uid,
                          role: checked ? "admin" : "member",
                        })
                      }
                      aria-label={`${u.email} 운영자 권한`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MemberManagement;
