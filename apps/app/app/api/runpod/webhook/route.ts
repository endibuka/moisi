import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * RunPod posts here when a separation job finishes. The shared secret in the
 * `token` query param guards the route; updates use the service-role client
 * since RunPod is not an authenticated user.
 */
export async function POST(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== process.env.RUNPOD_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    status?: string;
    error?: string;
    output?: { job_id?: string; stems?: Record<string, string> };
  };

  const admin = createAdminClient();
  const done = body.status === "COMPLETED" && body.output?.stems;

  const update = done
    ? {
        status: "completed" as const,
        stems: body.output!.stems,
        updated_at: new Date().toISOString(),
      }
    : {
        status: "failed" as const,
        error:
          typeof body.error === "string"
            ? body.error
            : "Separation failed on the GPU worker.",
        updated_at: new Date().toISOString(),
      };

  // Completed jobs carry our row id in the handler output; failed jobs may
  // not, so fall back to matching on the stored RunPod job id.
  let query = admin.from("separation_jobs").update(update);
  if (body.output?.job_id) {
    query = query.eq("id", body.output.job_id);
  } else if (body.id) {
    query = query.eq("runpod_id", body.id);
  } else {
    return NextResponse.json({ error: "missing job id" }, { status: 400 });
  }

  const { error } = await query;

  if (error) {
    console.error("Webhook DB update failed:", error);
    return NextResponse.json({ error: "db update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
