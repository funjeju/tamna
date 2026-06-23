// POST /api/stats — 접속/상세조회 집계 (방문수·상세조회·매물별 조회)
// GET  /api/stats — 통계 조회 (누적·오늘·최근 14일·인기 매물)
import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

// KST 기준 YYYY-MM-DD
function kstDate(d = new Date()): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const type = body?.type;
  const today = kstDate();
  const totalsRef = adminDb.collection("stats").doc("totals");
  const dailyRef = adminDb.collection("statsDaily").doc(today);

  try {
    if (type === "detail") {
      const tasks: Promise<unknown>[] = [
        totalsRef.set({ detailViews: FieldValue.increment(1) }, { merge: true }),
        dailyRef.set({ date: today, detailViews: FieldValue.increment(1) }, { merge: true }),
      ];
      if (typeof body.listingId === "string" && body.listingId) {
        const data: Record<string, unknown> = {
          listingId: body.listingId,
          views: FieldValue.increment(1),
          lastAt: new Date(),
        };
        if (typeof body.title === "string" && body.title) data.title = body.title;
        if (typeof body.region === "string" && body.region) data.region = body.region;
        tasks.push(
          adminDb.collection("statsListings").doc(body.listingId).set(data, { merge: true }),
        );
      }
      await Promise.all(tasks);
    } else {
      // 기본: 사이트 방문
      await Promise.all([
        totalsRef.set({ visits: FieldValue.increment(1) }, { merge: true }),
        dailyRef.set({ date: today, visits: FieldValue.increment(1) }, { merge: true }),
      ]);
    }
  } catch {
    /* 통계 실패는 무시 (사용자 흐름 방해 금지) */
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const today = kstDate();
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    days.push(kstDate(new Date(Date.now() - i * 86400000)));
  }

  const [totalsSnap, dailySnaps, topSnap] = await Promise.all([
    adminDb.collection("stats").doc("totals").get(),
    Promise.all(days.map((d) => adminDb.collection("statsDaily").doc(d).get())),
    adminDb.collection("statsListings").orderBy("views", "desc").limit(8).get(),
  ]);

  const totals = (totalsSnap.exists ? totalsSnap.data() : {}) as Record<string, number>;
  const daily = dailySnaps.map((s, i) => {
    const d = (s.exists ? s.data() : {}) as Record<string, number>;
    return {
      date: days[i],
      visits: d.visits ?? 0,
      detailViews: d.detailViews ?? 0,
    };
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

  return NextResponse.json({
    totals: { visits: totals.visits ?? 0, detailViews: totals.detailViews ?? 0 },
    daily,
    topListings,
    today,
  });
}
