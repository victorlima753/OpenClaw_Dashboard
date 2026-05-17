import { NextRequest, NextResponse } from "next/server";
import { updateJobStatus } from "@/lib/server/tasks";
import { updateStatusSchema } from "@/lib/validation/schemas";
import { isDatabaseUnavailable, mockStore } from "@/lib/server/mock-store";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  const body = updateStatusSchema.parse(await request.json());
  try {
    const job = await updateJobStatus(jobId, body.status, body.reason);
    return NextResponse.json(job);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      const job = mockStore.updateTaskStatus(jobId, body.status, body.reason);
      return job
        ? NextResponse.json(job, { headers: { "x-techsouls-data-source": "mock" } })
        : NextResponse.json({ error: "Tarefa nao encontrada." }, { status: 404 });
    }
    throw error;
  }
}
