import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const reviews = await prisma.humanReview.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: {
        job: {
          include: {
            assignedAgent: true,
            sources: true,
            logs: {
              where: { severity: { in: ["warning", "error", "critical"] } },
              orderBy: { createdAt: "desc" },
              take: 8,
              include: { agent: { select: { id: true, name: true, slug: true } } }
            }
          }
        }
      }
    });

    return NextResponse.json(reviews);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.reviewQueue(), { headers: { "x-techsouls-data-source": "mock" } });
    }
    throw error;
  }
}
