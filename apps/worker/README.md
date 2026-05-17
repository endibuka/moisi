# Demucs separation worker (RunPod Serverless)

GPU worker that splits a song into 4 stems (vocals / drums / bass / other)
with Demucs `htdemucs_ft`, then uploads the stems to Supabase Storage.

## Build & push the image

```bash
docker build --platform linux/amd64 -t <registry>/moises-demucs:latest .
docker push <registry>/moises-demucs:latest
```

## Create the RunPod Serverless endpoint

1. RunPod Console → Serverless → New Endpoint.
2. Container image: the image you pushed above.
3. GPU: any 16–24 GB card (e.g. RTX 4090 / A5000).
4. Workers: **min 0**, max 1–3 (scale to zero).
5. Container disk: ~15 GB.
6. Environment variables:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase service-role key (Settings → API)
   - `STEMS_BUCKET` — `stems` (optional, this is the default)
7. Copy the **Endpoint ID** — the app needs it as `RUNPOD_ENDPOINT_ID`.

The handler is invoked via `POST /v2/{endpoint}/run` and reports completion
through the `webhook` URL the app supplies in each request.
