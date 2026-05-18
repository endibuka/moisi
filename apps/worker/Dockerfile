# RunPod serverless worker: SOTA vocal pipeline (Mel-Roformer + htdemucs_6s
# + MDX23C-InstVoc + UVR-DeEcho-DeReverb).
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

# ffmpeg is needed to decode mp3/m4a/etc. and to encode the MP3 outputs.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download every model weight into /app/models so cold starts don't
# fetch them from HuggingFace. ~2-3 GB total, in addition to ~3 GB of deps.
RUN python -c "\
from audio_separator.separator import Separator;\
s = Separator(model_file_dir='/app/models');\
s.download_model_files('vocals_mel_band_roformer.ckpt');\
s.download_model_files('htdemucs_6s.yaml');\
s.download_model_files('MDX23C-InstVoc HQ.ckpt');\
s.download_model_files('UVR-DeEcho-DeReverb.pth');\
"

COPY handler.py .

CMD ["python", "-u", "handler.py"]
