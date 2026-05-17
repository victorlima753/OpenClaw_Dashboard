import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { settingsUpdateSchema } from "@/lib/validation/schemas";
import type { Prisma } from "@prisma/client";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";
import { apiErrorResponse } from "@/lib/server/api-error";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
    return NextResponse.json(settings);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.listSettings(), { headers: { "x-techsouls-data-source": "mock" } });
    }
    return apiErrorResponse(error, "api/settings:list");
  }
}

export async function PATCH(request: NextRequest) {
  const body = settingsUpdateSchema.parse(await request.json());
  try {
    const updated = [];

    for (const [key, value] of Object.entries(body)) {
      updated.push(
        await prisma.systemSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue }
        })
      );
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return NextResponse.json(mockStore.updateSettings(body), { headers: { "x-techsouls-data-source": "mock" } });
    }
    return apiErrorResponse(error, "api/settings:update");
  }
}
