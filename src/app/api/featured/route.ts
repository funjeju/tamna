// GET /api/featured — 주목할 매물 (설정 기반, 없으면 최신매물 폴백)
// POST /api/featured — 주목 설정 변경 ({mode, agentQuery, listingIds})
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing } from "@/lib/mapper";
import { getFeaturedConfig, saveFeaturedConfig } from "@/lib/featured";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 6;

function ts(l: Listing): number {
  const s = l.publishedAt2 ?? l.collectedAt;
  return s ? new Date(s).getTime() : 0;
}

export async function GET() {
  const cfg = await getFeaturedConfig();
  const rows = await db.listing.findMany({
    where: { status: "published" },
    include: { agent: true },
  });
  const all = rows.map((r) => mapListing(r as Parameters<typeof mapListing>[0]));

  let picked: Listing[] = [];

  if (cfg.mode === "ids" && cfg.listingIds.length) {
    const byId = new Map(all.map((l) => [l.id, l]));
    picked = cfg.listingIds.map((id) => byId.get(id)).filter((l): l is Listing => !!l);
  } else if (cfg.agentQuery) {
    const q = cfg.agentQuery.toLowerCase();
    picked = all
      .filter((l) => {
        const hay = [
          l.agent?.channelName,
          l.agent?.office,
          l.agent?.name,
          l.title,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => ts(b) - ts(a));
  }

  let isFallback = false;
  if (picked.length === 0) {
    // 매칭 매물이 없으면 최신매물로 폴백 (배너가 비지 않도록)
    isFallback = true;
    picked = [...all].sort((a, b) => ts(b) - ts(a));
  }

  return NextResponse.json({
    listings: picked.slice(0, LIMIT),
    isFallback,
    config: cfg,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.mode === "agent" || body.mode === "ids") patch.mode = body.mode;
  if (typeof body.agentQuery === "string") patch.agentQuery = body.agentQuery;
  if (Array.isArray(body.listingIds)) {
    patch.listingIds = body.listingIds.filter((x: unknown) => typeof x === "string");
  }
  await saveFeaturedConfig(patch);
  return NextResponse.json({ ok: true });
}
