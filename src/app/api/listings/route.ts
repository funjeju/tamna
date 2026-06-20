// GET /api/listings — 매물 목록 (필터/정렬/상태)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing } from "@/lib/mapper";
import type { ListingFilters, PropertyType, DealType, Theme } from "@/lib/types";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const sp = url.searchParams;

  const q = sp.get("q") || undefined;
  const status = sp.get("status") || "published";
  const propertyTypes = sp.getAll("propertyTypes") as PropertyType[];
  const dealTypes = sp.getAll("dealTypes") as DealType[];
  const themes = sp.getAll("themes") as Theme[];
  const regions = sp.getAll("regions");
  const keywords = sp.getAll("keywords");
  const priceMin = sp.get("priceMin") ? Number(sp.get("priceMin")) : undefined;
  const priceMax = sp.get("priceMax") ? Number(sp.get("priceMax")) : undefined;
  const areaMin = sp.get("areaMin") ? Number(sp.get("areaMin")) : undefined;
  const areaMax = sp.get("areaMax") ? Number(sp.get("areaMax")) : undefined;
  const sort = (sp.get("sort") || "latest") as ListingFilters["sort"];
  const limit = sp.get("limit") ? Number(sp.get("limit")) : 200;
  const sourceType = sp.get("sourceType") || undefined;

  const where: any = {};
  if (status && status !== "all") where.status = status;
  if (sourceType && sourceType !== "all") where.sourceType = sourceType;
  if (propertyTypes.length) where.propertyType = { in: propertyTypes };
  if (dealTypes.length) where.dealType = { in: dealTypes };
  if (regions.length) where.region = { in: regions };
  if (priceMin !== undefined || priceMax !== undefined) {
    where.priceManwon = {};
    if (priceMin !== undefined) where.priceManwon.gte = priceMin;
    if (priceMax !== undefined) where.priceManwon.lte = priceMax;
  }
  if (areaMin !== undefined || areaMax !== undefined) {
    where.areaPyeong = {};
    if (areaMin !== undefined) where.areaPyeong.gte = areaMin;
    if (areaMax !== undefined) where.areaPyeong.lte = areaMax;
  }
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { summary: { contains: q } },
      { addressText: { contains: q } },
      { region: { contains: q } },
    ];
  }

  const rows = await db.listing.findMany({
    where,
    include: { agent: true },
    orderBy: getOrderBy(sort),
    take: limit,
  });

  let list = rows.map((r) => mapListing(r));

  // 키워드/테마는 JSON 배열이라 앱단 필터
  if (keywords.length) {
    list = list.filter((l) =>
      keywords.every((k) => l.keywords.some((kw) => kw.includes(k))),
    );
  }
  if (themes.length) {
    list = list.filter((l) => themes.every((t) => l.themes.includes(t)));
  }

  // 공개(게시중) 목록은 엣지 캐시 — 실시간성이 낮고 cron/관리자 변경은 짧은 지연 허용
  const headers: Record<string, string> =
    status === "published"
      ? { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=180" }
      : {};

  return NextResponse.json({ listings: list, total: list.length }, { headers });
}

function getOrderBy(sort: ListingFilters["sort"]) {
  switch (sort) {
    case "price_asc":
      return { priceManwon: "asc" as const };
    case "price_desc":
      return { priceManwon: "desc" as const };
    case "area":
      return { areaPyeong: "desc" as const };
    case "just_published":
      return { publishedAt2: "desc" as const };
    case "latest":
    default:
      return { publishedAt: "desc" as const };
  }
}
