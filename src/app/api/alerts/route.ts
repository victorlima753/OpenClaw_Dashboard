import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = await prisma.systemAlert.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100
    });
    return NextResponse.json(alerts);
  } catch (error) {
    return apiErrorResponse(error, "api/alerts:list");
  }
}
