-- Pre-computed waveform peaks per stem, keyed by stem name. Lets the track
-- page render WaveSurfer instances instantly without fetching the audio
-- files for waveform extraction (audio still loads on-demand for playback).
--
-- Shape (jsonb):
--   { "vocals": [[number, number, ...]], "drums": [[...]], ... }
--
-- Each stem value is a number[][] (wavesurfer's peaks format — one inner
-- array per channel; mono = 1 channel, stereo = 2). Sample length is
-- typically ~2048 per channel, normalized to [-1, 1].
--
-- NULL means "peaks not computed yet" — the client computes them after the
-- first slow load and posts back via a server action.

alter table public.separation_jobs
  add column waveform_peaks jsonb;
