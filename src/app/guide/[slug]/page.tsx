// /guide/[slug] — 가이드 글 상세 (SSR, Article+FAQ+Breadcrumb JSON-LD, 관련 매물 연동)
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Compass, MapPin, ArrowRight } from "lucide-react";
import { getArticleBySlug, listArticles } from "@/lib/articles";
import { db } from "@/lib/db";
import { mapListing } from "@/lib/mapper";
import { formatPrice } from "@/lib/public/format";
import { PROPERTY_PIN } from "@/lib/regions";
import { ArticleBody } from "@/components/public/ArticleBody";
import type { Listing } from "@/lib/types";

export const revalidate = 600;
const SITE_URL = "https://tamna-iota.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) return { title: "가이드 | 탐라인덱스" };
  const url = `${SITE_URL}/guide/${a.slug}`;
  return {
    title: `${a.title} | 탐라인덱스`,
    description: a.metaDescription,
    keywords: a.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: a.title,
      description: a.metaDescription,
      type: "article",
      url,
      publishedTime: a.publishedAt,
      modifiedTime: a.updatedAt,
    },
  };
}

async function relatedListings(a: { related: { regions: string[]; propertyTypes: string[] } }): Promise<Listing[]> {
  const where: Record<string, unknown> = { status: "published" };
  if (a.related.regions.length) where.region = { in: a.related.regions };
  if (a.related.propertyTypes.length) where.propertyType = { in: a.related.propertyTypes };
  try {
    const rows = await db.listing.findMany({ where, include: { agent: true }, take: 6 });
    return rows.map((r) => mapListing(r as Parameters<typeof mapListing>[0]));
  } catch {
    return [];
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = await getArticleBySlug(slug);
  if (!a) notFound();

  const [listings, all] = await Promise.all([relatedListings(a), listArticles(200)]);
  const relatedArticles = all.filter((x) => x.slug !== a.slug).slice(0, 4);
  const url = `${SITE_URL}/guide/${a.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: a.title,
      description: a.metaDescription,
      datePublished: a.publishedAt,
      dateModified: a.updatedAt,
      author: { "@type": "Organization", name: a.author },
      publisher: { "@type": "Organization", name: "탐라인덱스" },
      mainEntityOfPage: url,
      keywords: a.keywords.join(", "),
    },
    a.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: a.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "가이드", item: `${SITE_URL}/guide` },
        { "@type": "ListItem", position: 3, name: a.title, item: url },
      ],
    },
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

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
            <Link href="/guide" className="text-muted-foreground hover:text-sea">가이드</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:px-6 md:py-10">
        {/* breadcrumb */}
        <nav className="mb-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/" className="hover:text-sea">홈</Link>
          <span>/</span>
          <Link href="/guide" className="hover:text-sea">가이드</Link>
        </nav>

        <article>
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-basalt md:text-3xl">
            {a.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{a.author}</span>
            <span>·</span>
            <time dateTime={a.updatedAt}>{new Date(a.updatedAt).toLocaleDateString("ko-KR")} 업데이트</time>
            {a.cluster ? (
              <span className="rounded-full bg-sea/10 px-2 py-0.5 text-[10px] text-sea">{a.cluster}</span>
            ) : null}
          </div>

          {a.lead ? (
            <p className="mt-5 rounded-lg border-l-4 border-sea bg-sea/5 p-4 text-[15px] font-medium leading-relaxed text-basalt">
              {a.lead}
            </p>
          ) : null}

          <div className="mt-6">
            <ArticleBody markdown={a.bodyMarkdown} />
          </div>

          {/* 관련 매물 */}
          {listings.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold text-basalt">이 글과 관련된 제주 매물</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {listings.map((l) => {
                  const pin = PROPERTY_PIN[l.propertyType] ?? PROPERTY_PIN["기타"];
                  return (
                    <Link
                      key={l.id}
                      href={`/?listing=${l.id}`}
                      className="flex items-center gap-3 rounded-xl border border-stone/50 bg-card p-2.5 transition hover:border-sea/50 hover:shadow-sm"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: pin.color }}>
                        {pin.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[13px] font-medium text-basalt">{l.title}</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className="font-mono font-semibold text-basalt">{formatPrice(l.priceManwon, l.priceText)}</span>
                          <MapPin className="size-3 text-tangerine" />{l.region}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Link href="/" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-sea hover:text-tangerine">
                지도에서 더 많은 매물 보기 <ArrowRight className="size-4" />
              </Link>
            </section>
          ) : (
            <div className="mt-10 rounded-xl border border-stone/50 bg-paper/40 p-5 text-center">
              <p className="text-sm text-muted-foreground">제주 매물을 지도에서 한눈에 확인해 보세요.</p>
              <Link href="/" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-sea hover:text-tangerine">
                탐라인덱스 매물 지도 <ArrowRight className="size-4" />
              </Link>
            </div>
          )}

          {/* FAQ */}
          {a.faq.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold text-basalt">자주 묻는 질문</h2>
              <div className="space-y-2">
                {a.faq.map((f, i) => (
                  <details key={i} className="rounded-lg border border-stone/50 bg-card p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-basalt">{f.q}</summary>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {/* 관련 가이드 */}
          {relatedArticles.length > 0 ? (
            <section className="mt-10">
              <h2 className="mb-3 text-lg font-bold text-basalt">함께 보면 좋은 가이드</h2>
              <ul className="space-y-1.5">
                {relatedArticles.map((r) => (
                  <li key={r.slug}>
                    <Link href={`/guide/${r.slug}`} className="inline-flex items-center gap-1.5 text-sm text-sea hover:text-tangerine">
                      <ArrowRight className="size-3.5" />{r.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </article>
      </main>

      <footer className="border-t border-stone/40 py-8 text-center text-xs text-muted-foreground">
        <Link href="/guide" className="hover:text-sea">← 가이드 전체 보기</Link>
      </footer>
    </div>
  );
}
