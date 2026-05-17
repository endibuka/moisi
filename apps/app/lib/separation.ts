export type StemName = "vocals" | "drums" | "bass" | "other";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type SeparationJob = {
  id: string;
  status: JobStatus;
  original_name: string;
  input_path: string;
  stems: Record<StemName, string> | null;
  error: string | null;
  created_at: string;
};

export const STEM_NAMES: StemName[] = ["vocals", "drums", "bass", "other"];

export const STEM_LABELS: Record<StemName, string> = {
  vocals: "Vocals",
  drums: "Drums",
  bass: "Bass",
  other: "Other",
};

/** Max upload size accepted by the client before hitting Storage. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

export const ACCEPTED_AUDIO_EXT = [".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"];
