import { notFound, redirect } from "next/navigation";
import TrackMixer from "@/components/TrackMixer";
import {
  type SeparationJob,
  STEM_NAMES,
  type StemName,
} from "@/lib/separation";
import { createClient } from "@/lib/supabase/server";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: job } = await supabase
    .from("separation_jobs")
    .select(
      "id,status,original_name,input_path,stems,error,created_at,duration_seconds,waveform_peaks",
    )
    .eq("id", id)
    .single<SeparationJob>();

  if (!job) notFound();
  if (job.status !== "completed" || !job.stems) {
    redirect("/");
  }

  const stems = job.stems;
  // Batch all stem signed URLs in a single Storage round-trip via
  // createSignedUrls (plural) — was 7 parallel calls; now one. Drops typical
  // track-page TTFB by ~300ms.
  const pathToName = new Map<string, StemName>();
  const paths: string[] = [];
  for (const name of STEM_NAMES) {
    const path = stems[name];
    if (path) {
      paths.push(path);
      pathToName.set(path, name);
    }
  }

  const { data: signed } = paths.length
    ? await supabase.storage.from("stems").createSignedUrls(paths, 60 * 60)
    : { data: null };

  const stemUrls: Partial<Record<StemName, string | null>> = {};
  for (const name of STEM_NAMES) stemUrls[name] = null;
  for (const row of signed ?? []) {
    const name = row.path ? pathToName.get(row.path) : undefined;
    if (name) stemUrls[name] = row.signedUrl ?? null;
  }

  return <TrackMixer job={job} stemUrls={stemUrls} />;
}
