"""RunPod serverless handler. Two job types share one worker image:

    job_type="separation"        -> full 7-stem pipeline
        1a. Mel-Roformer (vocals)
        1b. HTDemucs_6s (drums, bass, guitar, piano, other)
        2.  MDX23C-InstVoc cleans the vocal
        3.  UVR-DeEcho-DeReverb -> studio-acapella

    job_type="vocal_isolation"   -> 2-stem fast path for the Vocal Isolator
                                    and Karaoke Maker tools
        1.  Mel-Roformer on the raw mix
            -> { vocals, instrumental }

Inputs (event["input"]):
    job_type       'separation' (default) | 'vocal_isolation'
    audio_url      signed URL to download the original audio
    output_prefix  storage path prefix, e.g. "{user_id}/{job_id}"
    job_id         our separation_jobs row id (echoed back to the caller)

Returns:
    { "job_id": ..., "stems": { ... }, "job_type": ... }
"""

import os
import pathlib
import shutil
import tempfile

import requests
from audio_separator.separator import Separator
import runpod


MEL_ROFORMER_VOCAL = "vocals_mel_band_roformer.ckpt"
HTDEMUCS_6S = "htdemucs_6s.yaml"
MDX23C_INSTVOC = "MDX23C-InstVoc HQ.ckpt"
DEECHO_DEREVERB = "UVR-DeEcho-DeReverb.pth"

MODEL_DIR = "/app/models"

# Stem sets per job_type. The app reads these via lib/separation.ts.
FULL_STEMS = ("vocals", "vocals_acapella", "drums", "bass", "guitar", "piano", "other")
VOCAL_ISOLATION_STEMS = ("vocals", "instrumental")


def _config():
    url = os.environ["SUPABASE_URL"].rstrip("/")
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    bucket = os.environ.get("STEMS_BUCKET", "stems")
    return url, key, bucket


def _upload(supabase_url: str, key: str, bucket: str, path: str, data: bytes) -> None:
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
    """audio-separator names outputs `<input>_(Marker)_<model>.mp3`. Pick the
    one whose filename contains the marker (e.g. 'Vocals', 'No Reverb')."""
    matches = sorted(pathlib.Path(out_dir).glob(f"*{marker}*.mp3"))
    if not matches:
        raise RuntimeError(f"audio-separator produced no `{marker}` output in {out_dir}")
    return matches[-1]


def _download_audio(audio_url: str, dest: str) -> None:
    with requests.get(audio_url, stream=True, timeout=180) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


def _upload_stems(
    paths: dict, supabase_url: str, key: str, bucket: str, output_prefix: str
) -> dict:
    stems = {}
    for name, local in paths.items():
        storage_path = f"{output_prefix}/{name}.mp3"
        _upload(supabase_url, key, bucket, storage_path, local.read_bytes())
        stems[name] = storage_path
    return stems


def _run_full_separation(sep: Separator, src: str, work: str) -> dict:
    """Three-stage SOTA pipeline → 7 stems."""
    sep.load_model(model_filename=MEL_ROFORMER_VOCAL)
    sep.separate(src)
    mel_vocal = _find_output(work, "Vocals")

    sep.load_model(model_filename=HTDEMUCS_6S)
    sep.separate(src)
    demucs_stems = {
        "drums": _find_output(work, "Drums"),
        "bass": _find_output(work, "Bass"),
        "guitar": _find_output(work, "Guitar"),
        "piano": _find_output(work, "Piano"),
        "other": _find_output(work, "Other"),
    }

    sep.load_model(model_filename=MDX23C_INSTVOC)
    sep.separate(str(mel_vocal))
    cleaned_vocal = _find_output(work, "Vocals")

    sep.load_model(model_filename=DEECHO_DEREVERB)
    sep.separate(str(cleaned_vocal))
    dry_vocal = _find_output(work, "No Reverb")

    return {
        "vocals": cleaned_vocal,
        "vocals_acapella": dry_vocal,
        **demucs_stems,
    }


def _run_vocal_isolation(sep: Separator, src: str, work: str) -> dict:
    """One-stage fast path → vocals + instrumental."""
    sep.load_model(model_filename=MEL_ROFORMER_VOCAL)
    sep.separate(src)
    return {
        "vocals": _find_output(work, "Vocals"),
        "instrumental": _find_output(work, "Instrumental"),
    }


def handler(event):
    job = event["input"]
    audio_url = job["audio_url"]
    output_prefix = job["output_prefix"].strip("/")
    job_id = job["job_id"]
    job_type = job.get("job_type", "separation")

    supabase_url, key, bucket = _config()

    work = tempfile.mkdtemp(prefix="moisi-")
    src = os.path.join(work, "input.mp3")

    try:
        _download_audio(audio_url, src)

        sep = Separator(
            output_dir=work,
            output_format="MP3",
            model_file_dir=MODEL_DIR,
        )

        if job_type == "vocal_isolation":
            paths = _run_vocal_isolation(sep, src, work)
            order = VOCAL_ISOLATION_STEMS
        else:
            paths = _run_full_separation(sep, src, work)
            order = FULL_STEMS

        # Keep upload order deterministic so the app can find stems
        # predictably while the job is still in flight.
        ordered_paths = {name: paths[name] for name in order if name in paths}
        stems = _upload_stems(ordered_paths, supabase_url, key, bucket, output_prefix)

        return {"job_id": job_id, "job_type": job_type, "stems": stems}

    finally:
        shutil.rmtree(work, ignore_errors=True)


runpod.serverless.start({"handler": handler})
