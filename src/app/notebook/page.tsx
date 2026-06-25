// /notebook — 실장님 수첩 (음성/텍스트 상담 → 상담일지)
import Link from "next/link";
import type { Metadata } from "next";
import { Compass, NotebookPen } from "lucide-react";
import { NotebookTool } from "@/components/public/NotebookTool";

const SITE_URL = "https://tamna-iota.vercel.app";

export const metadata: Metadata = {
  title: "실장님 수첩 — 음성 상담을 상담일지로 | 탐라인덱스",
  description: "상담을 녹음하거나 메모만 넣으면 고객정보·희망조건·예산·다음 액션을 자동 추출해 상담일지 PDF로 정리합니다.",
  alternates: { canonical: `${SITE_URL}/notebook` },
  robots: { index: false }, // 실무 도구 — 색인 제외
};

export default function NotebookPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-stone/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-sea text-sea-foreground">
              <Compass className="size-4" />
            </span>
            <span className="text-sm font-bold text-basalt">탐라인덱스</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-sea">매물 지도</Link>
            <Link href="/calculator" className="text-muted-foreground hover:text-sea">계산기</Link>
            <Link href="/notebook" className="font-semibold text-sea">실장님 수첩</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-5">
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-basalt md:text-3xl">
            <NotebookPen className="size-6 text-sea" />
            실장님 수첩
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            상담을 녹음하거나 메모만 붙여넣으면 고객정보·희망조건·예산·다음 액션을 자동으로 추출합니다.
            검수 후 상담일지 PDF로 바로 출력하세요.
          </p>
        </div>
        <NotebookTool />
      </main>

      <footer className="border-t border-stone/40 py-8 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-sea">탐라인덱스</Link>
      </footer>
    </div>
  );
}
