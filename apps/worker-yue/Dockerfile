# RunPod serverless worker: full-song generation via YuE (M-A-P).
# Apache-2.0, 7B stage-1 + 1B stage-2 LM over an Xcodec. Accepts a genre /
# style prompt and structured lyrics; outputs multi-minute songs WITH vocals.
#
# Sized for a single 24 GB GPU (A6000/4090/L40S) with bf16; fits in 16 GB
# with int8 quantisation flags inside YuE's inference script.
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends git ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python deps first so re-builds don't re-download everything on a handler edit.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Clone YuE inference code (Apache 2.0).
RUN git clone --depth 1 https://github.com/multimodal-art-projection/YuE.git /app/YuE

# Pre-fetch the model weights into the HuggingFace cache so cold starts skip
# the multi-GB download. Switch checkpoints via the YUE_STAGE1 / YUE_STAGE2
# env vars at deploy time.
ARG YUE_STAGE1=m-a-p/YuE-s1-7B-anneal-en-cot
ARG YUE_STAGE2=m-a-p/YuE-s2-1B-general
ENV YUE_STAGE1=${YUE_STAGE1}
ENV YUE_STAGE2=${YUE_STAGE2}
RUN python -c "from huggingface_hub import snapshot_download; \
snapshot_download('${YUE_STAGE1}'); \
snapshot_download('${YUE_STAGE2}')"

COPY handler.py .

CMD ["python", "-u", "handler.py"]
