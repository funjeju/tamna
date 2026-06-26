// /calculator/[slug] — 개별 계산기 페이지 (SSR, FAQ JSON-LD, 설명 콘텐츠, 상단 메뉴)
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Compass, Calculator } from "lucide-react";
import { CALC_META, getCalc } from "@/lib/calc-content";
import { CalcWidget } from "@/components/public/CalcWidget";

const SITE_URL = "https://tamna-iota.vercel.app";
export const revalidate = 3600;

export function generateStaticParams() {
  return CALC_META.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const c = getCalc(slug);
  if (!c) return { title: "계산기 | 탐라인덱스" };
  const url = `${SITE_URL}/calculator/${c.slug}`;
  return {
    title: `${c.title} | 탐라인덱스`,
    description: c.metaDescription,
    keywords: c.keywords,
    alternates: { canonical: url },
    openGraph: { title: c.title, description: c.metaDescription, type: "website", url },
  };
}

function Menu({ active }: { active: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CALC_META.map((c) => (
        <Link
          key={c.slug}
          href={`/calculator/${c.slug}`}
          className={
            "rounded-full border px-2.5 py-1 text-xs transition " +
            (c.slug === active
              ? "border-transparent bg-sea text-sea-foreground"
              : "border-stone/50 text-muted-foreground hover:border-sea/40 hover:text-sea")
          }
        >
          {c.label}
        </Link>
      ))}
    </div>
  );
}

export default async function CalcPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const c = getCalc(slug);
  if (!c) notFound();
  const url = `${SITE_URL}/calculator/${c.slug}`;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: c.title,
      url,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
      description: c.metaDescription,
    },
    c.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        }
      : null,
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "홈", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "계산기", item: `${SITE_URL}/calculator` },
        { "@type": "ListItem", position: 3, name: c.label, item: url },
      ],
    },
  ].filter(Boolean);

  const related = CALC_META.filter((x) => x.category === c.category && x.slug !== c.slug).slice(0, 4);

  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <header className="sticky top-0 z-30 border-b border-stone/50 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-sea text-sea-foreground"><Compass className="size-4" /></span>
            <span className="text-sm font-bold text-basalt">탐라인덱스</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            <Link href="/" className="text-muted-foreground hover:text-sea">매물 지도</Link>
            <Link href="/calculator" className="font-semibold text-sea">계산기</Link>
            <Link href="/guide" className="text-muted-foreground hover:text-sea">가이드</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 md:px-6 md:py-8">
        <nav className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/calculator" className="hover:text-sea">계산기</Link><span>/</span><span>{c.label}</span>
        </nav>

        {/* 상단 메뉴 */}
        <Menu active={c.slug} />

        <h1 className="mt-5 inline-flex items-center gap-2 text-2xl font-bold tracking-tight text-basalt md:text-3xl">
          <Calculator className="size-6 text-sea" />{c.label} 계산기
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.intro}</p>

        {/* 계산기 */}
        <div className="mt-4">
          <CalcWidget widgetId={c.widgetId} />
        </div>

        {/* 설명 콘텐츠 (SEO/AEO) */}
        <article className="mt-8 space-y-5">
          {c.legalNote && (
            <section>
              <h2 className="mb-1.5 text-base font-bold text-basalt">법정·현행 기준</h2>
              <p className="rounded-lg border-l-4 border-sea bg-sea/5 p-3 text-sm leading-relaxed text-basalt">{c.legalNote}</p>
            </section>
          )}
          <section>
            <h2 className="mb-1.5 text-base font-bold text-basalt">계산 방법</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{c.formula}</p>
          </section>
          {c.notes.length > 0 && (
            <section>
              <h2 className="mb-1.5 text-base font-bold text-basalt">주의사항</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {c.notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </section>
          )}
          {c.faq.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-bold text-basalt">자주 묻는 질문</h2>
              <div className="space-y-2">
                {c.faq.map((f, i) => (
                  <details key={i} className="rounded-lg border border-stone/50 bg-card p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-basalt">{f.q}</summary>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
          {related.length > 0 && (
            <section>
              <h2 className="mb-2 text-base font-bold text-basalt">관련 계산기</h2>
              <div className="flex flex-wrap gap-1.5">
                {related.map((r) => (
                  <Link key={r.slug} href={`/calculator/${r.slug}`} className="rounded-full border border-stone/50 px-3 py-1 text-xs text-sea hover:border-sea">{r.label}</Link>
                ))}
              </div>
            </section>
          )}
        </article>

        <p className="mt-8 text-[10px] leading-relaxed text-muted-foreground/80">
          본 계산기는 참고용 간이 계산이며, 세율·요율·정책은 시점에 따라 달라질 수 있습니다. 실제 거래·납세 전 공인중개사·세무사·금융기관에 최신 사항을 확인하세요.
        </p>
      </main>

      <footer className="border-t border-stone/40 py-8 text-center text-xs text-muted-foreground">
        <Link href="/calculator" className="hover:text-sea">← 전체 계산기</Link>
      </footer>
    </div>
  );
}
