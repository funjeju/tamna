// POST /api/stats — 접속/상세조회/검색 집계
// GET  /api/stats — 통계 조회 (누적·오늘·14일·지역별·유형별·소스·검색어·인기매물)
// DELETE /api/stats?listingId= — statsListings 항목 정리
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// KST 기준 YYYY-MM-DD
function kstDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}
// Firestore 문서 id 안전화 (/ 등 금지문자 제거)
function safeId(s: string): string {
  return s.replace(/[/#?\\.\[\]]/g, "_").slice(0, 80) || "_";
}
const inc = (n = 1) => FieldValue.increment(n);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const type = body?.type;
  const today = kstDate();
  const totalsRef = adminDb.collection("stats").doc("totals");
  const dailyRef = adminDb.collection("statsDaily").doc(today);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : "");

  try {
    if (type === "detail") {
      const tasks: Promise<unknown>[] = [
        totalsRef.set({ detailViews: inc() }, { merge: true }),
        dailyRef.set({ date: today, detailViews: inc() }, { merge: true }),
      ];
      const listingId = str(body.listingId);
      const region = str(body.region);
      const propertyType = str(body.propertyType);
      const sourceType = str(body.sourceType);
      if (listingId) {
        const data: Record<string, unknown> = { listingId, views: inc(), lastAt: new Date() };
        if (str(body.title)) data.title = str(body.title);
        if (region) data.region = region;
        tasks.push(adminDb.collection("statsListings").doc(listingId).set(data, { merge: true }));
      }
      if (region)
        tasks.push(adminDb.collection("statsRegion").doc(safeId(region)).set({ region, views: inc() }, { merge: true }));
      if (propertyType)
        tasks.push(adminDb.collection("statsType").doc(safeId(propertyType)).set({ type: propertyType, views: inc() }, { merge: true }));
      if (sourceType)
        tasks.push(adminDb.collection("statsSource").doc(safeId(sourceType)).set({ source: sourceType, views: inc() }, { merge: true }));
      await Promise.all(tasks);
    } else if (type === "search") {
      const q = str(body.q).slice(0, 40);
      const tasks: Promise<unknown>[] = [
        totalsRef.set({ searches: inc() }, { merge: true }),
        dailyRef.set({ date: today, searches: inc() }, { merge: true }),
      ];
      if (q)
        tasks.push(adminDb.collection("statsKeyword").doc(safeId(q)).set({ keyword: q, count: inc(), lastAt: new Date() }, { merge: true }));
      await Promise.all(tasks);
    } else {
      await Promise.all([
        totalsRef.set({ visits: inc() }, { merge: true }),
        dailyRef.set({ date: today, visits: inc() }, { merge: true }),
      ]);
    }
  } catch {
    /* 통계 실패는 무시 */
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("listingId");
  if (!id) return NextResponse.json({ error: "listingId 필요" }, { status: 400 });
  try {
    await adminDb.collection("statsListings").doc(id).delete();
  } catch {
    /* noop */
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const today = kstDate();
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) days.push(kstDate(new Date(Date.now() - i * 86400000)));

  const [totalsSnap, dailySnaps, topSnap, regionSnap, typeSnap, sourceSnap, kwSnap] =
    await Promise.all([
      adminDb.collection("stats").doc("totals").get(),
      Promise.all(days.map((d) => adminDb.collection("statsDaily").doc(d).get())),
      adminDb.collection("statsListings").orderBy("views", "desc").limit(8).get(),
      adminDb.collection("statsRegion").get(),
      adminDb.collection("statsType").get(),
      adminDb.collection("statsSource").get(),
      adminDb.collection("statsKeyword").get(),
    ]);

  const totals = (totalsSnap.exists ? totalsSnap.data() : {}) as Record<string, number>;
  const daily = dailySnaps.map((s, i) => {
    const d = (s.exists ? s.data() : {}) as Record<string, number>;
    return { date: days[i], visits: d.visits ?? 0, detailViews: d.detailViews ?? 0, searches: d.searches ?? 0 };
  });
  const topListings = topSnap.docs.map((doc) => {
    const x = doc.data() as Record<string, unknown>;
    return {
      listingId: (x.listingId as string) ?? doc.id,
      title: (x.title as string) ?? "(제목 없음)",
      region: (x.region as string) ?? "",
      views: (x.views as number) ?? 0,
    };
  });
  const byRegion = regionSnap.docs
    .map((d) => ({ region: (d.data().region as string) ?? d.id, views: (d.data().views as number) ?? 0 }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 10);
  const byType = typeSnap.docs
    .map((d) => ({ type: (d.data().type as string) ?? d.id, views: (d.data().views as number) ?? 0 }))
    .sort((a, b) => b.views - a.views);
  const bySource = { youtube: 0, blog: 0 };
  sourceSnap.docs.forEach((d) => {
    const s = (d.data().source as string) ?? d.id;
    if (s === "youtube" || s === "blog") bySource[s] = (d.data().views as number) ?? 0;
  });
  const topKeywords = kwSnap.docs
    .map((d) => ({ keyword: (d.data().keyword as string) ?? d.id, count: (d.data().count as number) ?? 0 }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    totals: {
      visits: totals.visits ?? 0,
      detailViews: totals.detailViews ?? 0,
      searches: totals.searches ?? 0,
    },
    daily,
    topListings,
    byRegion,
    byType,
    bySource,
    topKeywords,
    today,
  });
}
