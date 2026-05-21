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
import traceback

import numpy as np
import librosa
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

# Cap the analysis input at 2 minutes. BPM and key are stationary enough that
# more audio doesn't help; capping keeps librosa under ~5s even on long tracks.
ANALYSIS_MAX_DURATION = 120

# Krumhansl–Kessler key profiles. Correlation against rotated chroma gives a
# decent tonic + mode estimate without pulling in a heavier key-detection lib.
_KEY_NAMES = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
_MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
_MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)


def _analyze_audio(path: str) -> dict | None:
    """Run librosa over the input audio and return BPM/key/loudness/brightness.

    Returns None (and logs) if analysis fails — failing the whole separation
    over a non-critical feature would be a bad trade.
    """
    try:
        y, sr = librosa.load(
            path, sr=None, mono=True, duration=ANALYSIS_MAX_DURATION
        )
        if y.size == 0:
            return None

        duration = float(librosa.get_duration(y=y, sr=sr))

        # BPM (tempo). librosa.beat.beat_track can return a 0-d array.
        tempo_arr, _ = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(np.asarray(tempo_arr).mean()) if tempo_arr is not None else 0.0
        bpm = int(round(tempo)) if tempo > 0 else None

        # Key + mode via chroma correlation with Krumhansl–Kessler profiles.
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = chroma.mean(axis=1)
        best = (-2.0, "C", "major")
        for i in range(12):
            for profile, mode in (
                (_MAJOR_PROFILE, "major"),
                (_MINOR_PROFILE, "minor"),
            ):
                rotated = np.roll(profile, i)
                if chroma_mean.std() == 0 or rotated.std() == 0:
                    continue
                corr = float(np.corrcoef(chroma_mean, rotated)[0, 1])
                if corr > best[0]:
                    best = (corr, _KEY_NAMES[i], mode)
        _, key, mode = best

        # Loudness (approximate dBFS via RMS) + spectral centroid ("brightness").
        rms = float(np.sqrt(np.mean(np.square(y))))
        loudness_db = float(20 * np.log10(rms + 1e-9))
        centroid = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())

        return {
            "bpm": bpm,
            "key": key,
            "mode": mode,
            "duration_seconds": round(duration, 2),
            "loudness_db": round(loudness_db, 1),
            "spectral_centroid_hz": int(round(centroid)),
            "energy": round(rms, 4),
        }
    except Exception:
        traceback.print_exc()
        return None


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

        # Run librosa over the original input audio for BPM/key/loudness.
        # Cheap (~3-5s) and powers the Track Inspector. Non-fatal on failure.
        analysis = _analyze_audio(src)

        result = {"job_id": job_id, "job_type": job_type, "stems": stems}
        if analysis is not None:
            result["analysis"] = analysis
        return result

    finally:
        shutil.rmtree(work, ignore_errors=True)


runpod.serverless.start({"handler": handler})
