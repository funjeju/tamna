// /calculator — 독립 부동산 계산기 (자금·세금·역산·자금계획서)
import Link from "next/link";
import type { Metadata } from "next";
import { Compass, Calculator } from "lucide-react";
import { CalculatorTool } from "@/components/public/CalculatorTool";

const SITE_URL = "https://tamna-iota.vercel.app";

export const metadata: Metadata = {
  title: "부동산 자금·세금 계산기 — 대출·DSR·취득세·역산 | 탐라인덱스",
  description:
    "매매가·소득·현금만 넣으면 가능 매매가(역산)·대출·월상환·DSR·취득세·중개보수·필요현금까지 한 번에. 자금계획서 PDF 출력. 정책값은 최신 검색 기준.",
  alternates: { canonical: `${SITE_URL}/calculator` },
  openGraph: {
    title: "부동산 자금·세금 계산기 | 탐라인덱스",
    description: "대출·DSR·취득세·역산·자금계획서. 한 화면에서 연쇄 계산.",
    type: "website",
    url: `${SITE_URL}/calculator`,
  },
};

export default function CalculatorPage() {
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
            <Link href="/guide" className="text-muted-foreground hover:text-sea">가이드</Link>
            <Link href="/calculator" className="font-semibold text-sea">계산기</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
        <div className="mb-5">
          <h1 className="inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-basalt md:text-3xl">
            <Calculator className="size-6 text-sea" />
            부동산 자금·세금 계산기
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            매물 정보와 내 자금만 입력하면 가능 매매가(역산)·대출·월상환·DSR·취득세·필요현금까지 즉시 계산하고,
            AI 해석과 자금계획서 PDF까지 만들어 드립니다. 참고용이며 정책값은 최신 검색 기준으로 갱신됩니다.
          </p>
        </div>

        <CalculatorTool />
      </main>

      <footer className="border-t border-stone/40 py-8 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-sea">탐라인덱스 — 지도가 곧 인덱스</Link>
      </footer>
    </div>
  );
}
