// GET /api/cron/content — 권위/자동 글 생성·발행 (완전 자동, 검수 없음)
// 정책: 권위 20개가 다 채워질 때까지 매 실행 권위 2 + 자동 2 (=4),
//       권위 완료 후 자동 3.
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase";
import { AUTHORITY_TOPICS, AUTO_KEYWORD_POOL, existingSlugs, createArticle } from "@/lib/articles";
import { generateAuthorityArticle, generateAutoArticle } from "@/lib/generate-article";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const have = await existingSlugs();
  const pendingAuthority = AUTHORITY_TOPICS.filter((t) => !have.has(t.slug));
  const authorityToMake = Math.min(2, pendingAuthority.length);
  const autoToMake = pendingAuthority.length > 0 ? 2 : 3;

  const made: unknown[] = [];
  const failed: unknown[] = [];

  // ── 권위 글 ──
  for (let i = 0; i < authorityToMake; i++) {
    const spec = pendingAuthority[i];
    try {
      const a = await generateAuthorityArticle(spec);
      if (a) {
        await createArticle(a);
        made.push({ type: "authority", slug: a.slug, title: a.title });
      } else {
        failed.push({ type: "authority", slug: spec.slug, reason: "품질게이트/빈응답" });
      }
    } catch (e) {
      failed.push({ type: "authority", slug: spec.slug, reason: String((e as Error)?.message ?? e).slice(0, 120) });
    }
  }

  // ── 자동 글 (키워드 라운드로빈) ──
  const stateRef = adminDb.doc("settings/contentState");
  const stateSnap = await stateRef.get();
  let autoIndex = (stateSnap.exists ? (stateSnap.data() as { autoIndex?: number }).autoIndex : 0) ?? 0;
  for (let i = 0; i < autoToMake; i++) {
    const kw = AUTO_KEYWORD_POOL[autoIndex % AUTO_KEYWORD_POOL.length];
    autoIndex++;
    try {
      const a = await generateAutoArticle(kw);
      if (a) {
        await createArticle(a);
        made.push({ type: "auto", slug: a.slug, title: a.title, kw });
      } else {
        failed.push({ type: "auto", kw, reason: "품질게이트/빈응답" });
      }
    } catch (e) {
      failed.push({ type: "auto", kw, reason: String((e as Error)?.message ?? e).slice(0, 120) });
    }
  }
  await stateRef.set({ autoIndex, lastRunAt: new Date().toISOString() }, { merge: true });

  return NextResponse.json({
    ok: true,
    pendingAuthorityBefore: pendingAuthority.length,
    made,
    failed,
    at: new Date().toISOString(),
  });
}
