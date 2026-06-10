# Phase 3: Containerized Network Service

Phase 3 packages the improved OCR service for repeatable LAN deployment.

## Progress Checklist

### Packaging

- [x] Add a service Dockerfile.
- [x] Add Docker Compose defaults.
- [x] Add `.env.example` and a locked Node.js dependency install.
- [ ] Install Tesseract and all runtime OCR dependencies in the image.
- [ ] Add a container health check.
- [ ] Add persistent storage for configuration and scan diagnostics.
- [ ] Document and validate mDNS behavior for supported network modes.

### Exit Criteria

- [ ] OCR works in the container without host-installed Tesseract.
- [ ] Airtable reads and quantity updates work from the container.
- [ ] Supported container networking permits service discovery.
- [ ] Restarts preserve configuration and enabled diagnostics.

## Goals

- Run the OCR service in Docker with Tesseract installed in the image.
- Preserve Phase 2 scan and match behavior inside the container.
- Make service configuration and diagnostics restart-safe.
- Keep LAN discovery easy for the ESP32 device.

Docker becomes a first-class deployment target in Phase 3, but it should still remain optional for ordinary feature development when host execution is sufficient.

## Server Behavior

The `service/` project should include:

- Dockerfile with Node.js and Tesseract installed.
- Docker Compose defaults.
- `.env.example` for service configuration.
- Health check for `GET /api/health`.
- Persistent volume for local config and scan diagnostics.
- mDNS advertisement notes for host-network and bridge-network deployments.

## Acceptance Criteria

- The container can OCR an uploaded image without using host-installed Tesseract.
- Airtable reads and quantity updates work from the container.
- mDNS discovery works when the network mode supports it.
- The service restarts without losing persistent configuration or enabled diagnostics.
