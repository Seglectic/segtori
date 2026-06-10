# Phase 3: Containerized Network Service

Phase 3 packages the improved OCR service for repeatable LAN deployment.

## Progress Checklist

### Packaging

- [x] Add a service Dockerfile.
- [x] Add Docker Compose defaults.
- [x] Add `.env.example` and a locked Node.js dependency install.
- [ ] Package RapidOCR ONNX and its locked Python runtime in the image.
- [ ] Prefer CUDA and clearly report automatic CPU fallback.
- [ ] Add a container health check.
- [ ] Add persistent storage for configuration and scan diagnostics.
- [ ] Document and validate mDNS behavior for supported network modes.

### Exit Criteria

- [ ] RapidOCR ONNX works in the container without host-managed Python dependencies.
- [ ] CUDA is used when available and CPU fallback is clearly reported.
- [ ] Airtable reads work from the container and the quantity endpoint contract remains available.
- [ ] Supported container networking permits service discovery.
- [ ] Restarts preserve configuration and enabled diagnostics.

## Goals

- Run the OCR service in Docker with the warmed RapidOCR ONNX worker.
- Preserve Phase 2 scan and match behavior inside the container.
- Make service configuration and diagnostics restart-safe.
- Keep LAN discovery easy for the ESP32 device.

Docker becomes a first-class deployment target in Phase 3, but it should still remain optional for ordinary feature development when host execution is sufficient.

## Server Behavior

The `service/` project should include:

- Dockerfile with Node.js, Python, RapidOCR, ONNX Runtime, and the warmed worker.
- Automatic ONNX provider selection with visible CUDA or CPU startup status.
- Docker Compose defaults.
- `.env.example` for service configuration.
- Health check for `GET /api/health`.
- Persistent volume for local config and scan diagnostics.
- mDNS advertisement notes for host-network and bridge-network deployments.

## Acceptance Criteria

- The container can OCR an uploaded image without host-managed Python or OCR dependencies.
- The deployment uses CUDA when available and continues on CPU with a clear
  startup warning when CUDA is unavailable.
- Airtable reads work from the container.
- The quantity endpoint remains compatible; write validation stays with the
  Phase 4 local backend rather than mutating live Airtable inventory.
- mDNS discovery works when the network mode supports it.
- The service restarts without losing persistent configuration or enabled diagnostics.
