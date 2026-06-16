// PATCH /api/agents/[id] — verified/plan/optedOut 토글
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapAgent } from "@/lib/mapper";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();
  const data: any = {};
  if (body.verified !== undefined) data.verified = !!body.verified;
  if (body.plan !== undefined) data.plan = body.plan;
  if (body.optedOut !== undefined) {
    data.optedOut = !!body.optedOut;
    if (body.optedOut) {
      // 채널 단위 옵트아웃 → optOut 리스트에 채널 ID 추가
      const agent = await db.agent.findUnique({ where: { id } });
      if (agent) {
        await db.optOut.upsert({
          where: { key: agent.channelId },
          update: {
            reason: "채널 단위 옵트아웃",
            requestedBy: "admin",
            at: new Date(),
          },
          create: {
            key: agent.channelId,
            reason: "채널 단위 옵트아웃",
            requestedBy: "admin",
            at: new Date(),
          },
        });
        // 해당 채널의 모든 매물 opted_out 처리
        await db.listing.updateMany({
          where: { channelId: agent.channelId },
          data: { status: "opted_out", takedownAt: new Date() },
        });
      }
    }
  }

  const updated = await db.agent.update({
    where: { id },
    data,
    include: { _count: { select: { listings: true } } },
  });
  return NextResponse.json({
    agent: mapAgent(updated, (updated as any)._count?.listings ?? 0),
  });
}
