// GET /api/favorites — 찜 목록
// POST /api/favorites — 찜 토글
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing } from "@/lib/mapper";

const USER_ID = "guest";

export async function GET() {
  const favs = await db.favorite.findMany({
    where: { userId: USER_ID },
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
  const body = await req.json();
  const listingId = body.listingId as string;
  const notifyPriceDrop = !!body.notifyPriceDrop;

  const existing = await db.favorite.findUnique({
    where: { userId_listingId: { userId: USER_ID, listingId } },
  });
  if (existing) {
    await db.favorite.delete({
      where: { userId_listingId: { userId: USER_ID, listingId } },
    });
    return NextResponse.json({ favorited: false });
  }
  await db.favorite.create({
    data: { userId: USER_ID, listingId, notifyPriceDrop },
  });
  return NextResponse.json({ favorited: true, notifyPriceDrop });
}
