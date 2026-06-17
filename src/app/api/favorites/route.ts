// GET /api/favorites — 찜 목록 (로그인 사용자별)
// POST /api/favorites — 찜 토글
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing } from "@/lib/mapper";
import { verifyUid } from "@/lib/firebase";

// 로그인 시 uid, 비로그인 시 "guest"
async function resolveUser(req: NextRequest): Promise<string> {
  const uid = await verifyUid(req.headers.get("authorization"));
  return uid ?? "guest";
}

export async function GET(req: NextRequest) {
  const userId = await resolveUser(req);
  const favs = await db.favorite.findMany({
    where: { userId },
    include: { listing: { include: { agent: true } } },
    orderBy: { savedAt: "desc" },
  });
  return NextResponse.json({
    favorites: favs.map((f) => ({
      ...mapListing(f.listing),
      isFavorited: true,
      notifyPriceDrop: f.notifyPriceDrop,
      savedAt: f.savedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const userId = await resolveUser(req);
  const body = await req.json();
  const listingId = body.listingId as string;
  const notifyPriceDrop = !!body.notifyPriceDrop;

  const existing = await db.favorite.findUnique({
    where: { userId_listingId: { userId, listingId } },
  });
  if (existing) {
    await db.favorite.delete({
      where: { userId_listingId: { userId, listingId } },
    });
    return NextResponse.json({ favorited: false });
  }
  await db.favorite.create({
    data: { userId, listingId, notifyPriceDrop },
  });
  return NextResponse.json({ favorited: true, notifyPriceDrop });
}
