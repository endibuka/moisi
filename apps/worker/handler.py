"""RunPod serverless handler: SOTA vocal-isolation pipeline.

Pipeline (three stages):
    1a. Mel-Roformer on the raw mix    -> high-quality `vocals`
    1b. HTDemucs_6s on the raw mix     -> `drums / bass / guitar / piano / other`
    2.  MDX23C-InstVoc on the vocal    -> cleaned vocal (removes leftover bleed)
    3.  UVR-DeEcho-DeReverb on it      -> studio-acapella `vocals_acapella`

Inputs (event["input"]):
    audio_url      signed URL to download the original audio
    output_prefix  storage path prefix, e.g. "{user_id}/{job_id}"
    job_id         our separation_jobs row id (echoed back to the caller)

Returns:
    { "job_id": ..., "stems": { vocals, vocals_acapella, drums, bass, guitar, piano, other } }
"""

import os
import pathlib
import shutil
import tempfile

import requests
from audio_separator.separator import Separator
import runpod


# Model file names — see audio-separator's catalog. Adjust if the package
# renames a checkpoint between releases. The Dockerfile pre-downloads each
# of these so first-job startup doesn't pay the model-download tax.
MEL_ROFORMER_VOCAL = "vocals_mel_band_roformer.ckpt"
HTDEMUCS_6S = "htdemucs_6s.yaml"
MDX23C_INSTVOC = "MDX23C-InstVoc HQ.ckpt"
DEECHO_DEREVERB = "UVR-DeEcho-DeReverb.pth"

MODEL_DIR = "/app/models"

# Final stem names written to Supabase storage. The app reads this set
# verbatim via `separation.ts`'s StemName union.
STEM_KEYS = ("vocals", "vocals_acapella", "drums", "bass", "guitar", "piano", "other")


def _config():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    bucket = os.environ.get("STEMS_BUCKET", "stems")
    return url, key, bucket


def _upload(supabase_url: str, key: str, bucket: str, path: str, data: bytes) -> None:
    """Upload one stem to the Supabase Storage `stems` bucket (service role)."""
    res = requests.post(
        f"{supabase_url}/storage/v1/object/{bucket}/{path}",
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "audio/mpeg",
            "x-upsert": "true",
        },
        data=data,
        timeout=180,
    )
    res.raise_for_status()


def _find_output(out_dir: str, marker: str) -> pathlib.Path:
    """audio-separator writes files like `<input>_(Marker)_<model>.mp3`. Pick
    the one whose filename contains the marker (e.g. 'Vocals', 'No Reverb')."""
    matches = sorted(pathlib.Path(out_dir).glob(f"*{marker}*.mp3"))
    if not matches:
        raise RuntimeError(f"audio-separator produced no `{marker}` output in {out_dir}")
    return matches[-1]


def handler(event):
    job = event["input"]
    audio_url = job["audio_url"]
    output_prefix = job["output_prefix"].strip("/")
    job_id = job["job_id"]

    supabase_url, key, bucket = _config()

    work = tempfile.mkdtemp(prefix="moisi-")
    src = os.path.join(work, "input.mp3")

    try:
        # 0. Download the original audio.
        with requests.get(audio_url, stream=True, timeout=180) as r:
            r.raise_for_status()
            with open(src, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)

        # One Separator instance, swap models between stages. Pre-baked
        # weights live in MODEL_DIR so load_model() is fast.
        sep = Separator(
            output_dir=work,
            output_format="MP3",
            model_file_dir=MODEL_DIR,
        )

        # --- Stage 1a: Mel-Roformer for the cleanest vocal ---
        sep.load_model(model_filename=MEL_ROFORMER_VOCAL)
        sep.separate(src)
        mel_vocal = _find_output(work, "Vocals")

        # --- Stage 1b: HTDemucs_6s for the 5 non-vocal stems ---
        sep.load_model(model_filename=HTDEMUCS_6S)
        sep.separate(src)
        demucs_stems = {
            "drums": _find_output(work, "Drums"),
            "bass": _find_output(work, "Bass"),
            "guitar": _find_output(work, "Guitar"),
            "piano": _find_output(work, "Piano"),
            "other": _find_output(work, "Other"),
        }

        # --- Stage 2: MDX23C-InstVoc cleans the Mel-Roformer vocal ---
        sep.load_model(model_filename=MDX23C_INSTVOC)
        sep.separate(str(mel_vocal))
        cleaned_vocal = _find_output(work, "Vocals")

        # --- Stage 3: De-reverb / de-echo on the cleaned vocal ---
        sep.load_model(model_filename=DEECHO_DEREVERB)
        sep.separate(str(cleaned_vocal))
        # DeEcho output marker is "No Reverb" (the dry signal).
        dry_vocal = _find_output(work, "No Reverb")

        # Final stem set: cleaned vocal as `vocals`, dry vocal as the acapella.
        final_paths = {
            "vocals": cleaned_vocal,
            "vocals_acapella": dry_vocal,
            **demucs_stems,
        }

        # Upload everything in parallel order — Supabase will accept these
        # sequentially; if one fails, RunPod surfaces it to the watcher.
        stems = {}
        for name in STEM_KEYS:
            local = final_paths[name]
            storage_path = f"{output_prefix}/{name}.mp3"
            _upload(supabase_url, key, bucket, storage_path, local.read_bytes())
            stems[name] = storage_path

        return {"job_id": job_id, "stems": stems}

    finally:
        shutil.rmtree(work, ignore_errors=True)


runpod.serverless.start({"handler": handler})
