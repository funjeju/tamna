import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tamna-iota.vercel.app"),
  title: "탐라인덱스 — 지도가 곧 인덱스 | 제주 부동산 영상 매물",
  description:
    "제주의 흩어진 유튜브 부동산 매물 영상을 수집·표준화·지도화해 한 곳에서 검색·비교하는 플랫폼. 육지인 세컨하우스·이주 검토자를 위한 비대면 임장 맥락까지.",
  keywords: [
    "제주 부동산",
    "탐라인덱스",
    "제주 매물",
    "세컨하우스",
    "한달살기",
    "애월",
    "제주 유튜브 부동산",
    "원격 임장",
  ],
  authors: [{ name: "TamnaIndex" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "탐라인덱스 — 지도가 곧 인덱스",
    description: "제주 부동산 영상 매물, 한 장의 지도로.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        className={`${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {/* Organization + WebSite 구조화데이터 (GEO/SEO) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                name: "탐라인덱스",
                url: "https://tamna-iota.vercel.app",
                description: "제주 부동산 영상·블로그 매물을 지도로 모아 검색·비교하는 플랫폼.",
              },
              {
                "@context": "https://schema.org",
                "@type": "WebSite",
                name: "탐라인덱스",
                url: "https://tamna-iota.vercel.app",
                potentialAction: {
                  "@type": "SearchAction",
                  target: "https://tamna-iota.vercel.app/?q={search_term_string}",
                  "query-input": "required name=search_term_string",
                },
              },
            ]),
          }}
        />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
