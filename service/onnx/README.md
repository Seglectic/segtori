# ONNX OCR Worker

This isolated Python worker runs RapidOCR, stays warm between scans, and does
not change the firmware-facing service API.

Provision the isolated CUDA 12 environment:

```sh
uv sync --project service/onnx --python 3.12
```

Then select it with:

```sh
OCR_BACKEND=onnx
ONNX_PROVIDER=auto
```

The environment installs CUDA 12 and cuDNN 9 runtime libraries from NVIDIA
Python packages alongside the host CUDA 13 toolkit. The worker preloads those
isolated libraries before creating ONNX sessions.

`auto` uses CUDA only when every RapidOCR model session attaches to
`CUDAExecutionProvider`; otherwise metrics report CPU. `cuda` fails the scan
instead of silently falling back. The Node.js service keeps this worker alive
so repeated scans avoid repeated model initialization.

Project-level architecture, benchmark results, and optimization direction are
documented in [`docs/onnx-ocr.md`](../../docs/onnx-ocr.md).
