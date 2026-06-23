"use client";

import { useState } from "react";
import {
  Activity,
  Ban,
  BarChart3,
  Building2,
  ClipboardList,
  Eye,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Dashboard } from "./Dashboard";
import { CollectionConsole } from "./CollectionConsole";
import { ReviewQueue } from "./ReviewQueue";
import { PublishManagement } from "./PublishManagement";
import { AgentManagement } from "./AgentManagement";
import { OptOutList } from "./OptOutList";
import { MemberManagement } from "./MemberManagement";
import { CronSettings } from "./CronSettings";
import { StatsPanel } from "./StatsPanel";
import { AdminFooter } from "./AdminFooter";

export type AdminSection =
  | "dashboard"
  | "stats"
  | "collection"
  | "review"
  | "published"
  | "agents"
  | "members"
  | "optout"
  | "cron";

interface AdminAppProps {
  /** 공개 사이트로 전환 콜백 — 메인 page.tsx에서 mode 전환 */
  onExitAdmin?: () => void;
}

interface NavItem {
  id: AdminSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "대시보드", icon: LayoutDashboard, desc: "전체 KPI" },
  { id: "stats", label: "접속통계", icon: BarChart3, desc: "방문·상세조회 수치" },
  { id: "collection", label: "수집콘솔", icon: Zap, desc: "자동·수동 수집" },
  { id: "review", label: "검수큐", icon: ClipboardList, desc: "드래프트 검수" },
  { id: "published", label: "게시관리", icon: Eye, desc: "게시중·반려·옵트아웃" },
  { id: "agents", label: "중개사관리", icon: Building2, desc: "검증·플랜·옵트아웃" },
  { id: "members", label: "회원관리", icon: Users, desc: "운영자 권한 지정" },
  { id: "optout", label: "설정·옵트아웃", icon: Ban, desc: "옵트아웃 리스트" },
  { id: "cron", label: "수집 스케줄", icon: Activity, desc: "주기·시각·즉시실행" },
];

const SECTION_TITLES: Record<AdminSection, { title: string; sub: string }> = {
  dashboard: { title: "운영 대시보드", sub: "전체 지표 한눈에 보기" },
  stats: { title: "접속 통계", sub: "방문·매물 상세조회 집계" },
  collection: { title: "수집 콘솔", sub: "유튜브 매물 자동·수동 수집" },
  review: { title: "검수 큐", sub: "AI 구조화 드래프트 검수" },
  published: { title: "게시 관리", sub: "게시중·반려·옵트아웃 통합 관리" },
  agents: { title: "중개사 관리", sub: "검증·플랜·옵트아웃" },
  members: { title: "회원 관리", sub: "회원 목록·운영자 권한 지정" },
  optout: { title: "옵트아웃 설정", sub: "중개사·소유자 요청 노출 중단" },
  cron: { title: "수집 스케줄", sub: "유튜브·블로그 주기·시각·즉시실행" },
};

export function AdminApp({ onExitAdmin }: AdminAppProps) {
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const goSection = (s: AdminSection) => {
    setSection(s);
    setMobileNavOpen(false);
  };

  const currentTitle = SECTION_TITLES[section];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 상단 헤더 */}
      <header
        className="sticky top-0 z-30 border-b border-stone/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        role="banner"
      >
        <div className="flex items-center gap-3 px-3 sm:px-6 h-14">
          {/* 모바일 햄버거 */}
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="lg:hidden"
                aria-label="메뉴 열기"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SidebarContent
                section={section}
                onSelect={goSection}
                onExitAdmin={onExitAdmin}
              />
            </SheetContent>
          </Sheet>

          {/* 로고 + 타이틀 */}
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-md bg-sea text-sea-foreground flex items-center justify-center font-bold">
              탐
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold text-basalt leading-tight">
                탐라인덱스
              </div>
              <div className="text-[10px] text-muted-jeju leading-tight">
                운영자 콘솔
              </div>
            </div>
          </div>

          <div className="hidden md:block w-px h-6 bg-stone/60 mx-1" />

          {/* 현재 섹션 */}
          <div className="hidden md:block flex-1 min-w-0">
            <div className="text-sm font-semibold text-basalt truncate">
              {currentTitle.title}
            </div>
            <div className="text-[11px] text-muted-jeju truncate">
              {currentTitle.sub}
            </div>
          </div>

          {/* 우측 액션 */}
          <div className="ml-auto flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:inline-flex border-sea/40 text-sea"
            >
              <ShieldCheck className="size-3" />
              editor
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onExitAdmin}
              aria-label="공개 사이트로 전환"
            >
              <Eye className="size-4" />
              <span className="hidden sm:inline">공개 사이트 보기</span>
            </Button>
          </div>
        </div>
      </header>

      {/* 본문: 사이드바 + 콘텐츠 */}
      <div className="flex-1 flex">
        {/* 데스크탑 사이드바 */}
        <aside
          className="hidden lg:flex w-60 shrink-0 border-r border-stone/60 bg-card flex-col"
          role="navigation"
          aria-label="운영자 메뉴"
        >
          <SidebarContent
            section={section}
            onSelect={goSection}
            onExitAdmin={onExitAdmin}
          />
        </aside>

        {/* 메인 콘텐츠 */}
        <main className="flex-1 min-w-0 flex flex-col" role="main">
          <div className="flex-1 flex flex-col overflow-hidden">
            {section === "dashboard" && (
              <Dashboard onNavigate={(s) => goSection(s as AdminSection)} />
            )}
            {section === "stats" && <StatsPanel />}
            {section === "collection" && (
              <CollectionConsole onJobCompleted={() => {
                /* 추가 콜백 필요시 사용 */
              }} />
            )}
            {section === "review" && (
              <ReviewQueue onGoToCollection={() => goSection("collection")} />
            )}
            {section === "published" && <PublishManagement />}
            {section === "agents" && <AgentManagement />}
            {section === "members" && <MemberManagement />}
            {section === "optout" && <OptOutList />}
            {section === "cron" && <CronSettings />}
          </div>
        </main>
      </div>

      {/* 푸터 */}
      <AdminFooter />
    </div>
  );
}

interface SidebarContentProps {
  section: AdminSection;
  onSelect: (s: AdminSection) => void;
  onExitAdmin?: () => void;
}

function SidebarContent({ section, onSelect, onExitAdmin }: SidebarContentProps) {
  return (
    <div className="flex flex-col h-full">
      {/* 모바일용 로고 헤더 */}
      <div className="lg:hidden flex items-center gap-2 p-4 border-b border-stone/60">
        <div className="size-8 rounded-md bg-sea text-sea-foreground flex items-center justify-center font-bold">
          탐
        </div>
        <div>
          <div className="text-sm font-bold text-basalt leading-tight">
            탐라인덱스
          </div>
          <div className="text-[10px] text-muted-jeju leading-tight">
            운영자 콘솔
          </div>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto scroll-thin">
        <div className="px-2 py-1 text-[10px] font-semibold text-stone uppercase tracking-wider">
          운영 메뉴
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = section === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors text-left ${
                active
                  ? "bg-sea text-sea-foreground font-semibold"
                  : "text-basalt hover:bg-paper hover:text-sea"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="leading-tight">{item.label}</div>
                <div
                  className={`text-[10px] leading-tight truncate ${
                    active ? "text-sea-foreground/80" : "text-muted-jeju"
                  }`}
                >
                  {item.desc}
                </div>
              </div>
              {item.id === "collection" && (
                <span
                  className={`size-1.5 rounded-full bg-tangerine live-dot ${
                    active ? "" : ""
                  }`}
                  aria-label="활성 크론"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* 상태 정보 */}
      <div className="border-t border-stone/60 p-3 space-y-2">
        <div className="rounded-md bg-paper/60 p-2.5 text-xs">
          <div className="flex items-center gap-1.5 text-sea font-medium mb-1">
            <Activity className="size-3" />
            시스템 정상
          </div>
          <div className="text-[10px] text-muted-jeju space-y-0.5">
            <div className="flex items-center justify-between">
              <span>자동수집</span>
              <span className="font-mono">08:00 KST</span>
            </div>
            <div className="flex items-center justify-between">
              <span>RABC</span>
              <span className="font-mono text-sea">editor</span>
            </div>
            <div className="flex items-center justify-between">
              <span>신선도 목표</span>
              <span className="font-mono">20%↑</span>
            </div>
          </div>
        </div>

        {onExitAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-jeju hover:text-basalt"
            onClick={onExitAdmin}
          >
            <LogOut className="size-4" />
            공개 사이트로
          </Button>
        )}
      </div>
    </div>
  );
}

export default AdminApp;
