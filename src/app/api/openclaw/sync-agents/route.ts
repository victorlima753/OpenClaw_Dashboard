import { NextResponse } from "next/server";
import { getOpenClawAdapter } from "@/lib/adapters/openclaw";
import { syncOpenClawAgentsFromPayload } from "@/lib/server/openclaw-events";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const status = await getOpenClawAdapter().getStatus();
    const sync = await syncOpenClawAgentsFromPayload(status.response);
    return NextResponse.json({ status, sync });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 }
    );
  }
}
