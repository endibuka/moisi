"""RunPod serverless handler: full-song generation via YuE.

Inputs (event["input"]):
    genre           str    — style / genre prompt (e.g. "lo-fi piano 80 bpm")
    lyrics          str?   — structured lyrics with [verse] / [chorus] markers;
                             null or empty triggers instrumental mode
    n_segments      int?   — number of ~30 s segments to generate (default 2)
    output_prefix   str    — storage path prefix, e.g. "{user_id}/{job_id}"
    job_id          str    — separation_jobs row id, echoed back

Returns:
    { "job_id": ..., "job_type": "music_generation",
      "stems": { "audio": "{prefix}/generated.mp3" } }

Output shape matches the separation worker so the existing Inngest watcher
writes the result without any new code path.
"""

import os
import pathlib
import shutil
import subprocess
import tempfile

import requests
import runpod


YUE_DIR = pathlib.Path("/app/YuE")
# YuE's infer.py uses relative imports (`from models.X`) and
# `sys.path.append('./xcodec_mini_infer')`, so it MUST run with
# cwd=YuE/inference. Running it from anywhere else triggers
# ModuleNotFoundError: No module named 'models'.
INFER_CWD = YUE_DIR / "inference"
INFER_SCRIPT = INFER_CWD / "infer.py"
STAGE1 = os.environ.get("YUE_STAGE1", "m-a-p/YuE-s1-7B-anneal-en-cot")
STAGE2 = os.environ.get("YUE_STAGE2", "m-a-p/YuE-s2-1B-general")

INSTRUMENTAL_LYRICS = "[inst]\n[inst]\n"


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
        timeout=600,
    )
    res.raise_for_status()


def _run_yue(genre: str, lyrics: str, n_segments: int, out_dir: pathlib.Path) -> pathlib.Path:
    """Invoke YuE's CLI. Writes a single MP3 to `out_dir/mix.mp3`."""
    work = pathlib.Path(tempfile.mkdtemp(prefix="yue-"))
    genre_file = work / "genre.txt"
    lyrics_file = work / "lyrics.txt"
    genre_file.write_text(genre.strip() + "\n", encoding="utf-8")
    lyrics_file.write_text(lyrics, encoding="utf-8")

    out_dir.mkdir(parents=True, exist_ok=True)

    # YuE's reference inference command. The exact flag set tracks the
    # upstream repo; pin a commit in the Dockerfile if drift becomes a problem.
    cmd = [
        "python",
        str(INFER_SCRIPT),
        "--stage1_model", STAGE1,
        "--stage2_model", STAGE2,
        "--genre_txt", str(genre_file),
        "--lyrics_txt", str(lyrics_file),
        "--run_n_segments", str(n_segments),
        "--output_dir", str(out_dir),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, cwd=str(INFER_CWD))
    if proc.returncode != 0:
        raise RuntimeError(
            f"YuE inference failed (rc={proc.returncode}):\n"
            f"stdout: {proc.stdout[-2000:]}\n"
            f"stderr: {proc.stderr[-2000:]}"
        )

    # YuE writes a final MP3 to the output dir; pick the largest .mp3 (the
    # post-decoded mix) so we don't accidentally upload an intermediate stem.
    mp3s = sorted(out_dir.rglob("*.mp3"), key=lambda p: p.stat().st_size, reverse=True)
    if not mp3s:
        raise RuntimeError(
            f"YuE finished without an MP3 in {out_dir}. Last 1k of stdout: {proc.stdout[-1000:]}"
        )
    return mp3s[0]


def handler(event):
    job = event["input"]
    genre = (job.get("genre") or "").strip()
    lyrics_in = (job.get("lyrics") or "").strip()
    n_segments = max(1, min(6, int(job.get("n_segments", 2))))
    output_prefix = job["output_prefix"].strip("/")
    job_id = job["job_id"]

    if not genre:
        raise ValueError("`genre` is required.")
    lyrics = lyrics_in if lyrics_in else INSTRUMENTAL_LYRICS

    supabase_url, key, bucket = _config()

    work = pathlib.Path(tempfile.mkdtemp(prefix="moisi-yue-"))
    try:
        mp3_path = _run_yue(genre, lyrics, n_segments, work / "out")
        with open(mp3_path, "rb") as f:
            mp3_bytes = f.read()

        storage_path = f"{output_prefix}/generated.mp3"
        _upload(supabase_url, key, bucket, storage_path, mp3_bytes)

        return {
            "job_id": job_id,
            "job_type": "music_generation",
            "stems": {"audio": storage_path},
        }
    finally:
        shutil.rmtree(work, ignore_errors=True)


runpod.serverless.start({"handler": handler})
