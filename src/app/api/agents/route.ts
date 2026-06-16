// GET /api/agents — 중개사 목록
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapAgent } from "@/lib/mapper";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status"); // verified | unverified | opted_out | all

  const where: any = {};
  if (status === "verified") where.verified = true;
  if (status === "unverified") where.verified = false;
  if (status === "opted_out") where.optedOut = true;

  const agents = await db.agent.findMany({
    where,
    include: { _count: { select: { listings: true } } },
    orderBy: { createdAt: "asc" },
  });

  const list = agents.map((a) =>
    mapAgent(a, (a as any)._count?.listings ?? 0),
  );
  return NextResponse.json({ agents: list, total: list.length });
}
