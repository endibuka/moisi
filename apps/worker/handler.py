"""RunPod serverless handler: split a song into 4 stems with Demucs.

Input (event["input"]):
    audio_url      signed URL to download the original audio
    output_prefix  storage path prefix, e.g. "{user_id}/{job_id}"
    job_id         our separation_jobs row id (echoed back for the webhook)

Returns:
    { "job_id": ..., "stems": { "vocals": path, "drums": ..., "bass": ..., "other": ... } }
"""

import os
import pathlib
import subprocess
import tempfile

import requests
import runpod

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
STEMS_BUCKET = os.environ.get("STEMS_BUCKET", "stems")

MODEL = "htdemucs_ft"
STEMS = ["vocals", "drums", "bass", "other"]


def _upload(path: str, data: bytes) -> None:
    """Upload one stem to the Supabase Storage `stems` bucket (service role)."""
    res = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/{STEMS_BUCKET}/{path}",
        headers={
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type": "audio/mpeg",
            "x-upsert": "true",
        },
        data=data,
        timeout=180,
    )
    res.raise_for_status()


def handler(event):
    job = event["input"]
    audio_url = job["audio_url"]
    output_prefix = job["output_prefix"].strip("/")
    job_id = job["job_id"]

    work = tempfile.mkdtemp()
    src = os.path.join(work, "input")

    # 1. Download the original audio.
    with requests.get(audio_url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(src, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)

    # 2. Run Demucs on the GPU (4-stem, encoded to mp3).
    out_dir = os.path.join(work, "out")
    subprocess.run(
        ["python", "-m", "demucs", "-n", MODEL, "-d", "cuda",
         "--mp3", "-o", out_dir, src],
        check=True,
    )

    # 3. Upload each stem to Supabase Storage.
    track_dir = pathlib.Path(out_dir) / MODEL / "input"
    stems = {}
    for stem in STEMS:
        stem_file = track_dir / f"{stem}.mp3"
        storage_path = f"{output_prefix}/{stem}.mp3"
        _upload(storage_path, stem_file.read_bytes())
        stems[stem] = storage_path

    return {"job_id": job_id, "stems": stems}


runpod.serverless.start({"handler": handler})
