// GET /api/featured — 주목할 매물 (설정 기반, 없으면 최신매물 폴백)
// POST /api/featured — 주목 설정 변경 ({mode, agentQuery, listingIds})
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapListing } from "@/lib/mapper";
import { getFeaturedConfig, saveFeaturedConfig } from "@/lib/featured";
import type { Listing } from "@/lib/types";

export const dynamic = "force-dynamic";

const LIMIT = 6;
const MIN_VISIBLE = 3; // 배너에 최소 3개는 보이도록 최신 매물로 보강

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

  const matchedCount = picked.length;
  let isFallback = false;
  let isPadded = false;

  if (matchedCount === 0) {
    // 매칭 매물이 없으면 최신매물로 폴백 (배너가 비지 않도록)
    isFallback = true;
    picked = [...all].sort((a, b) => ts(b) - ts(a));
  } else if (matchedCount < MIN_VISIBLE) {
    // 매칭이 3개 미만이면 최신 매물로 자리를 채움 (지정 매물은 앞에 고정)
    isPadded = true;
    const have = new Set(picked.map((l) => l.id));
    const fillers = [...all]
      .filter((l) => !have.has(l.id))
      .sort((a, b) => ts(b) - ts(a));
    picked = [...picked, ...fillers].slice(0, MIN_VISIBLE);
  }

  return NextResponse.json({
    listings: picked.slice(0, LIMIT),
    isFallback,
    isPadded,
    matchedCount,
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
