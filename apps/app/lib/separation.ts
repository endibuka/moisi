export type StemName =
  | "vocals"
  | "vocals_acapella"
  | "instrumental"
  | "drums"
  | "bass"
  | "guitar"
  | "piano"
  | "other";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export type JobType = "separation" | "vocal_isolation" | "music_generation";

// Jobs run before the 6-stem rollout only have {vocals, drums, bass, other},
// so consumers must tolerate missing keys.
export type StemPaths = Partial<Record<StemName, string>>;

/**
 * WaveSurfer-style peaks per stem. Each stem value is one inner array per
 * audio channel (mono = 1, stereo = 2). NULL on the job row means peaks
 * haven't been computed yet — the client populates them after the first
 * track view.
 */
export type WaveformPeaks = Partial<Record<StemName, number[][]>>;

export type SeparationJob = {
  id: string;
  status: JobStatus;
  original_name: string;
  input_path: string;
  stems: StemPaths | null;
  error: string | null;
  created_at: string;
  duration_seconds: number | null;
  waveform_peaks: WaveformPeaks | null;
  /** Storage path of the AI-generated cover (Gemini), null until generated.
   *  Music-gen jobs get one auto-created post-completion by the Inngest
   *  watcher; separations stay null until the user runs Cover Art on them. */
  cover_art_path: string | null;
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
  instrumental: "Instrumental",
  drums: "Drums",
  bass: "Bass",
  guitar: "Guitar",
  piano: "Piano",
  other: "Other",
};

/** Max upload size accepted by the client before hitting Storage. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024; // 30 MB

export const ACCEPTED_AUDIO_EXT = [".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg"];
