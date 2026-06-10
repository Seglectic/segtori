# RapidOCR ONNX Backend

Segtori's Phase 2 ONNX backend uses RapidOCR with ONNX Runtime. It runs behind
the existing Node.js OCR boundary, so selecting it does not change the
firmware-facing scan API.

## Runtime Shape

- Node.js persists the uploaded scan image and routes ONNX scans through a
  long-lived Python worker.
- The worker loads RapidOCR detection, classification, and recognition models
  once, then stays warm for repeated requests.
- ONNX Runtime executes every model through the selected provider.
- The worker returns normalized text, recognized lines, line confidence scores,
  provider diagnostics, and stage timings as JSON.
- The existing inventory matcher ranks candidates and applies confidence gates.

The Python environment is isolated under `service/onnx/.venv`. Its locked
dependencies include ONNX Runtime GPU plus CUDA 12 and cuDNN 9 runtime
libraries. These coexist with the host's CUDA 13 toolkit without changing
system packages or the active NVIDIA driver.

## Setup

Provision the isolated environment:

```sh
uv sync --project service/onnx --python 3.12
```

Run the service with strict CUDA execution:

```sh
OCR_BACKEND=onnx ONNX_PROVIDER=cuda npm --prefix service start
```

Provider modes:

- `auto`: use CUDA when every model session attaches successfully; otherwise
  report CPU execution.
- `cpu`: force CPU execution.
- `cuda`: require CUDA for every model session and fail instead of silently
  falling back.

## High-Resolution Benchmark

The first complete high-resolution benchmark ran all 44 dataset images through
`POST /api/scan` with `ONNX_PROVIDER=cuda`.

| Signal | Result |
| --- | ---: |
| Successful requests | 44 / 44 |
| Non-empty OCR | 44 / 44 |
| Scans with ranked candidates | 44 / 44 |
| Automatically accepted matches | 37 / 44 |
| Withheld uncertain matches | 7 / 44 |
| Average best-candidate score | 0.905 |
| Average HTTP roundtrip | 2.15 s |
| Median HTTP roundtrip | 2.15 s |
| p95 HTTP roundtrip | 2.33 s |
| Maximum HTTP roundtrip | 2.60 s |

All detection, classification, and recognition model sessions reported
`CUDAExecutionProvider`.

Six withheld scans had weak or incomplete OCR and appropriately failed the
confidence gates. One scan recognized the correct `24 x 18 x 5` / `S-4552`
record at score `1.0`, but duplicate-ranked inventory records produced a zero
runner-up margin.

These are diagnostic signals, not accuracy measurements. The dataset still
needs representative ground-truth labels and invalid-sample annotations before
the backend can be evaluated as an accuracy improvement.

## Performance Direction

The current Node.js adapter keeps one Python process warm and reuses the
RapidOCR models for repeated scans. The next useful benchmark is the delta
between that warmed worker and a fresh process startup on the same dataset.
Across the full high-resolution run on the older cold-start path:

- Average worker initialization: about 0.41 seconds.
- Average ONNX inference: about 0.85 seconds.
- Average detection: about 0.46 seconds.
- Average recognition: about 0.26 seconds.

The next meaningful latency experiment is a persistent local worker that loads
the models once and accepts repeated requests from Node.js. That change should
be measured against the existing process-per-scan implementation before it is
adopted. Image resizing, detector limits, batching, and recognition-model
changes should only be tuned against labeled data.

## Reproducing The Benchmark

Start the service with strict CUDA execution, then run:

```sh
node util/ocrBenchmark.js --variant hires
```

The benchmark report is written under ignored `util/dataset/` storage.
