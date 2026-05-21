# Music Generator worker — YuE (RunPod Serverless)

Open-source full-song generator from
[M-A-P/YuE](https://github.com/multimodal-art-projection/YuE). Two-stage LM
(semantic + acoustic tokens over an Xcodec); accepts a **genre / style
prompt** and **structured lyrics**, outputs multi-minute songs **with
vocals**. Apache 2.0.

Quality sits between Suno v3 and early v3.5 in the published comparisons.
Run-time on a single H100 is ~3–5 min for a 2-segment (≈1 min) song.

## Build & deploy

```bash
docker build --platform linux/amd64 -t <registry>/moisi-yue:latest .
docker push <registry>/moisi-yue:latest
```

Or push this directory to a RunPod GitHub-integrated build (same flow as
`apps/worker`).

## RunPod endpoint settings

- **GPU:** **24 GB minimum.** Recommended: A6000 / 4090 / L40S; A100/H100
  for 2× speed. Add `--quant int8` inside the handler's YuE call if you
  must squeeze onto 16 GB.
- **Workers:** min 0, max 1–2 (scales to zero).
- **Container disk:** **~40 GB** (stage-1 7B + stage-2 1B + xcodec
  + image base ≈ 30 GB; leave headroom).
- **Execution timeout:** **600 s** (10 min). 2-segment generation runs in
  ~3-5 min on H100, ~6-8 min on 4090.
- **Env vars:**
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STEMS_BUCKET=stems`
  - `YUE_STAGE1=m-a-p/YuE-s1-7B-anneal-en-cot` (default)
  - `YUE_STAGE2=m-a-p/YuE-s2-1B-general` (default)

The app addresses this endpoint via `RUNPOD_YUE_ENDPOINT_ID`.

## Handler I/O

Input:

```json
{
  "input": {
    "genre": "inspiring female uplifting pop airy vocal electronic bright",
    "lyrics": "[verse]\nWaking up in the morning light\n...\n[chorus]\n...",
    "n_segments": 2,
    "output_prefix": "{user_id}/{job_id}",
    "job_id": "..."
  }
}
```

`lyrics` may be omitted / empty for an **instrumental** song — the handler
substitutes `[inst]\n[inst]\n` to put YuE into its instrumental mode.

Output:

```json
{
  "job_id": "...",
  "job_type": "music_generation",
  "stems": { "audio": "{user_id}/{job_id}/generated.mp3" }
}
```

Matches the separation worker's output shape so the existing Inngest
watcher writes it to `separation_jobs.stems` unchanged.

## Lyrics format

YuE expects section markers in square brackets. Example:

```
[verse]
First verse lyrics, one line per bar
keep them roughly 4 lines per verse

[chorus]
Chorus lyrics
typically 4 lines

[verse]
Second verse...
```

Supported markers: `[verse]`, `[chorus]`, `[bridge]`, `[outro]`, `[inst]`
(instrumental section).

## Model swap

For higher quality at the cost of VRAM + latency, switch to YuE's larger
stage-1:

```
YUE_STAGE1=m-a-p/YuE-s1-7B-anneal-en-icl
```

The `-icl` variant supports in-context style examples (audio prompts) but
needs ~32 GB VRAM. Out of scope for this handler today.
