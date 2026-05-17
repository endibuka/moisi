# RunPod serverless worker: Demucs (htdemucs_ft) 4-stem separation.
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

# ffmpeg is needed to decode mp3/m4a/etc.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the model weights into the image so cold starts don't re-download them.
RUN python -c "from demucs.pretrained import get_model; get_model('htdemucs_ft')"

COPY handler.py .

CMD ["python", "-u", "handler.py"]
