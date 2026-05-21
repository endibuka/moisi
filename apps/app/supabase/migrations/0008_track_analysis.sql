-- Stores librosa-derived musical features for a track. Populated by the
-- separation worker as a side-effect of stem extraction (no extra GPU pass;
-- librosa runs on CPU against the original input audio).
--
-- Shape (kept loose intentionally — adding fields later doesn't need another
-- migration):
--   {
--     "bpm": 92,
--     "key": "A",
--     "mode": "minor",                -- "major" | "minor"
--     "duration_seconds": 187.34,
--     "loudness_db": -14.2,           -- approximate RMS dBFS
--     "spectral_centroid_hz": 2138,   -- "brightness"
--     "energy": 0.0732                -- raw RMS, 0–1 range
--   }
--
-- Old rows stay null until the user re-runs analysis on that track.
alter table public.separation_jobs
  add column if not exists analysis jsonb;
