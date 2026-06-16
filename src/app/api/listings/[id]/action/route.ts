// POST /api/listings/[id]/action — 승인/반려/중단/재시도/가격갱신
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing, canPublish } from "@/lib/mapper";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const action = body.action as
    | "approve"
    | "reject"
    | "takedown"
    | "retry"
    | "update_price";

  const row = await db.listing.findUnique({
    where: { id },
    include: { agent: true },
  });
  if (!row)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  if (action === "approve") {
    const gate = canPublish(row);
    if (!gate.ok) {
      return NextResponse.json(
        { error: "게시 불가", reasons: gate.reasons },
        { status: 400 },
      );
    }
    const updated = await db.listing.update({
      where: { id },
      data: {
        status: "published",
        reviewedBy: "editor",
        publishedAt2: new Date(),
      },
      include: { agent: true },
    });
    return NextResponse.json({ listing: mapListing(updated) });
  }

  if (action === "reject") {
    const updated = await db.listing.update({
      where: { id },
      data: { status: "rejected", reviewedBy: "editor" },
      include: { agent: true },
    });
    return NextResponse.json({ listing: mapListing(updated) });
  }

  if (action === "takedown") {
    const reason = body.reason || "운영자 노출 중단";
    await db.optOut.upsert({
      where: { key: row.videoId },
      update: { reason, requestedBy: "admin", at: new Date() },
      create: {
        key: row.videoId,
        reason,
        requestedBy: "admin",
        at: new Date(),
      },
    });
    const updated = await db.listing.update({
      where: { id },
      data: { status: "opted_out", takedownAt: new Date() },
      include: { agent: true },
    });
    return NextResponse.json({ listing: mapListing(updated) });
  }

  if (action === "retry") {
    const updated = await db.listing.update({
      where: { id },
      data: { status: "structuring", confidence: 0.5 },
      include: { agent: true },
    });
    // 1.2초 후 구조화 완료 시뮬레이션
    setTimeout(async () => {
      try {
        await db.listing.update({
          where: { id },
          data: { status: "draft", confidence: 0.82 },
        });
      } catch {}
    }, 1200);
    return NextResponse.json({ listing: mapListing(updated) });
  }

  if (action === "update_price") {
    const newPrice = Number(body.priceManwon);
    if (!newPrice || newPrice <= 0)
      return NextResponse.json(
        { error: "가격 오류" },
        { status: 400 },
      );
    const hist = JSON.parse(row.priceHistory || "[]");
    hist.push({ manwon: row.priceManwon, at: new Date().toISOString() });
    const updated = await db.listing.update({
      where: { id },
      data: {
        priceManwon: newPrice,
        priceText: body.priceText || `${newPrice.toLocaleString()}만원`,
        priceHistory: JSON.stringify(hist),
      },
      include: { agent: true },
    });
    return NextResponse.json({ listing: mapListing(updated) });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
