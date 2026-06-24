// /guide — 콘텐츠 허브 (제주 부동산 가이드 인덱스, SSR)
import Link from "next/link";
import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { listArticles } from "@/lib/articles";

export const revalidate = 120; // 새 글 반영 위해 2분 ISR

const SITE_URL = "https://tamna-iota.vercel.app";

export const metadata: Metadata = {
  title: "제주 부동산 가이드 — 토지·주택·세금·이주 총정리 | 탐라인덱스",
  description:
    "제주도 부동산 매매·토지·전원주택·세금·농취증·토지거래허가·이주까지. 제주 부동산을 처음 검토하는 분을 위한 원론적이고 실무적인 가이드 모음.",
  alternates: { canonical: `${SITE_URL}/guide` },
  openGraph: {
    title: "제주 부동산 가이드 | 탐라인덱스",
    description: "제주 부동산 매매·토지·세금·이주 총정리 가이드.",
    type: "website",
    url: `${SITE_URL}/guide`,
  },
};

export default async function GuidePage() {
  const articles = await listArticles(200);
  const authority = articles.filter((a) => a.type === "authority");
  const auto = articles.filter((a) => a.type === "auto");

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}/guide/${a.slug}`,
      name: a.title,
    })),
  };

  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }}
      />
      {/* 헤더 */}
      <header className="sticky top-0 z-30 border-b border-stone/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-sea text-sea-foreground">
              <Compass className="size-4" />
            </span>
            <span className="text-sm font-bold text-basalt">탐라인덱스</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-sea">매물 지도</Link>
            <Link href="/guide" className="font-semibold text-sea">가이드</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-basalt md:text-3xl">
            제주 부동산 가이드
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
            제주도 부동산을 처음 검토하는 분을 위한 원론·실무 가이드입니다. 토지·주택·세금·규제·이주까지,
            거래 전에 알아야 할 핵심을 정리했습니다. 매물은{" "}
            <Link href="/" className="text-sea underline underline-offset-2">지도에서 바로</Link> 확인하세요.
          </p>
        </div>

        {articles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone/60 bg-paper/50 px-6 py-16 text-center text-sm text-muted-foreground">
            가이드 글을 준비 중입니다. 곧 공개됩니다.
          </p>
        ) : (
          <div className="space-y-10">
            {authority.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-basalt">기본 가이드</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {authority.map((a) => (
                    <ArticleCard key={a.slug} slug={a.slug} title={a.title} desc={a.metaDescription} cluster={a.cluster} />
                  ))}
                </div>
              </section>
            )}
            {auto.length > 0 && (
              <section>
                <h2 className="mb-4 text-lg font-semibold text-basalt">지역·테마 인사이트</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {auto.map((a) => (
                    <ArticleCard key={a.slug} slug={a.slug} title={a.title} desc={a.metaDescription} cluster={a.cluster} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-stone/40 py-8 text-center text-xs text-muted-foreground">
        <Link href="/" className="hover:text-sea">탐라인덱스 — 지도가 곧 인덱스</Link>
      </footer>
    </div>
  );
}

function ArticleCard({ slug, title, desc, cluster }: { slug: string; title: string; desc: string; cluster: string }) {
  return (
    <Link
      href={`/guide/${slug}`}
      className="group flex flex-col rounded-xl border border-stone/50 bg-card p-4 transition hover:border-sea/50 hover:shadow-sm"
    >
      {cluster ? (
        <span className="mb-1.5 inline-flex w-fit rounded-full bg-sea/10 px-2 py-0.5 text-[10px] font-medium text-sea">
          {cluster}
        </span>
      ) : null}
      <h3 className="text-[15px] font-semibold leading-snug text-basalt group-hover:text-sea">{title}</h3>
      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
    </Link>
  );
}
