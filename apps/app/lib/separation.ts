export type StemName =
  | "vocals"
  | "vocals_acapella"
  | "drums"
  | "bass"
  | "guitar"
  | "piano"
  | "other";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

// Jobs run before the 6-stem rollout only have {vocals, drums, bass, other},
// so consumers must tolerate missing keys.
export type StemPaths = Partial<Record<StemName, string>>;

export type SeparationJob = {
  id: string;
  status: JobStatus;
  original_name: string;
  input_path: string;
  stems: StemPaths | null;
  error: string | null;
  created_at: string;
};

export const STEM_NAMES: StemName[] = [
  "vocals",
  "vocals_acapella",
  "drums",
  "bass",
  "guitar",
  "piano",
  "other",
];

export const STEM_LABELS: Record<StemName, string> = {
  vocals: "Vocals",
  vocals_acapella: "Studio Acapella",
  drums: "Drums",
  bass: "Bass",
  guitar: "Guitar",
  piano: "Piano",
  other: "Other",
};

/** Max upload size accepted by the client before hitting Storage. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

export const ACCEPTED_AUDIO_EXT = [".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"];
