# Segtori OCR Service

The service runs the warmed RapidOCR ONNX worker, matches recognized text
against inventory data, persists scan diagnostics, and advertises the
firmware-facing API on the LAN.

## Host Development

Host execution remains the normal edit-run-test workflow:

```bash
npm install
npm run dev
```

Provision the host ONNX environment with:

```bash
uv sync --project onnx --python 3.12
```

## Production Container

Build and run the production service on Linux with host networking:

```bash
docker compose up --build
```

Host networking allows the service's mDNS advertisement to reach the LAN.
Scan jobs and diagnostics persist through the bind mount at `./process`.
Bridge networking is not a supported direct-discovery mode because Docker does
not forward multicast DNS advertisements onto the LAN. Use host networking
when the ESP32 must discover the service.

Expose an NVIDIA GPU to the same image with:

```bash
docker compose -f compose.yaml -f compose.gpu.yaml up --build
```

`ONNX_PROVIDER=auto` uses CUDA when every RapidOCR model attaches successfully.
When CUDA is unavailable or incomplete, startup logs a clear warning and the
worker continues through the CPU execution provider. `GET /api/health` reports
the active provider under `ocrProvider`.

If `nvidia-smi` works in the container but CUDA returns error 999, regenerate
the NVIDIA CDI spec. Dynamic UVM device numbers can change after a driver or
kernel-module update while the existing spec remains stale:

```bash
sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
```

Stop and remove the service without deleting persisted diagnostics:

```bash
docker compose down
```

## Configuration

Copy `.env.example` to the untracked `.env` file and configure inventory
credentials there. Do not commit `.env`.

The production image contains Node.js, Python, RapidOCR, ONNX Runtime, CUDA and
cuDNN runtime libraries, and the locked worker dependencies from `onnx/uv.lock`.
It does not depend on host-installed Python packages or Tesseract.
