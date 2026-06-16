// GET/PATCH /api/listings/[id]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing, canPublish } from "@/lib/mapper";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = await db.listing.findUnique({
    where: { id },
    include: { agent: true },
  });
  if (!row)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ listing: mapListing(row) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const row = await db.listing.findUnique({
    where: { id },
    include: { agent: true },
  });
  if (!row)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: any = {};
  const editable = [
    "title",
    "priceText",
    "priceManwon",
    "areaM2",
    "areaPyeong",
    "addressText",
    "region",
    "lat",
    "lng",
    "zoning",
    "summary",
    "propertyType",
    "dealType",
    "confidence",
  ];
  for (const k of editable) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.highlights !== undefined)
    data.highlights = JSON.stringify(body.highlights);
  if (body.keywords !== undefined)
    data.keywords = JSON.stringify(body.keywords);
  if (body.themes !== undefined) data.themes = JSON.stringify(body.themes);

  const updated = await db.listing.update({
    where: { id },
    data,
    include: { agent: true },
  });
  const gate = canPublish(updated);
  return NextResponse.json({ listing: mapListing(updated), canPublish: gate });
}
