import { NextResponse } from "next/server";
import { getOpenClawAdapter, isRealOpenClawEnabled } from "@/lib/adapters/openclaw";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getOpenClawAdapter().getStatus();
    return NextResponse.json({ ...result, real: isRealOpenClawEnabled() });
  } catch (error) {
    return NextResponse.json(
      {
        accepted: false,
        real: isRealOpenClawEnabled(),
        message: error instanceof Error ? error.message : String(error)
      },
      { status: 502 }
    );
  }
}
