# ╭──────────────────────────────╮
# │  Segtori OCR Service         │
# │  Packages Node and the locked│
# │  RapidOCR ONNX worker.       │
# ╰──────────────────────────────╯

FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production \
    OCR_BACKEND=onnx \
    ONNX_PROVIDER=auto \
    ONNX_PYTHON_PATH=/opt/segtori-onnx/bin/python \
    ONNX_WORKER_PATH=/app/onnx/worker.py \
    SCAN_JOB_INGEST_DIR=/app/process \
    SCAN_DEBUG_DIR=/app/process

RUN apt-get update \
    && apt-get install --no-install-recommends -y \
       ca-certificates \
       libgl1 \
       libglib2.0-0 \
       libsm6 \
       libxext6 \
       libxrender1 \
       libxcb1 \
       python3 \
       python3-venv \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY onnx/pyproject.toml onnx/uv.lock ./onnx/
RUN python3 -m venv /opt/uv \
    && /opt/uv/bin/pip install --no-cache-dir uv \
    && UV_PROJECT_ENVIRONMENT=/opt/segtori-onnx \
       /opt/uv/bin/uv sync --frozen --no-dev --project /app/onnx \
    && rm -rf /root/.cache /opt/uv

COPY src ./src
COPY onnx/worker.py ./onnx/worker.py

# RapidOCR copies its selected model variants into this directory on first warmup.
RUN mkdir -p /app/process \
    && chown -R node:node \
       /app/process \
       /opt/segtori-onnx/lib/python3.11/site-packages/rapidocr/models

USER node

EXPOSE 8674

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT||8674}/api/health`).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["npm", "start"]
