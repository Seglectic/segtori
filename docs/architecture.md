# Segtori Architecture

Segtori has two primary subsystems: firmware on the handheld ESP32 device and an OCR/inventory service on the local network.

## Firmware

The firmware is responsible for the physical user workflow:

- Connect to Wi-Fi.
- Discover the Segtori OCR service with mDNS.
- Capture still images with supported OV2640 and OV3660 cameras.
- Upload images to the server.
- Render scan status, match results, quantity editing, and error states.
- Read the scan button and D-pad.
- Send quantity updates back to the server.

The firmware should keep local state small:

- Current server host and port.
- Current screen state.
- Latest scan result.
- Editable quantity value.
- Last request status.

## Service

The service is responsible for OCR, inventory lookup, and inventory mutation:

- Advertise itself on the network with mDNS.
- Receive image uploads from the ESP32.
- Run the configured Tesseract, Ollama, or RapidOCR ONNX recognition backend.
- Normalize OCR text.
- Fetch inventory records from Airtable.
- Match OCR text to the closest inventory item.
- Return the best match to the device.
- Update item quantity by inventory ID.
- Persist scan images, results, and failure diagnostics for local inspection.
- Serve a local development dashboard for browsing persisted scan jobs.

For Phase 1, the service can call the host `tesseract` binary directly. Later containerized versions should install Tesseract inside the Docker image.

Phase 2 should improve recognition and matching before deployment packaging. OCR preprocessing, confidence thresholds, candidate ranking, and scan diagnostics should stay server-side so they can be tuned without changing the ESP32 firmware.

The RapidOCR ONNX backend runs in an isolated Python environment that the
Node.js service keeps warm across scans. Its CUDA 12 and cuDNN 9 runtime
libraries coexist with the host CUDA toolkit. Provider and stage diagnostics
are returned through the same scan-result path used by the other recognition
backends. See [onnx-ocr.md](./onnx-ocr.md) for setup, measurements, and the
current warm-worker shape.

## Discovery

The server should advertise an HTTP service over mDNS:

- Service type: `_segtori-ocr._tcp.local`
- Default instance name: `segtori-ocr`
- Default port: `8674`

The firmware should try mDNS discovery first. If discovery fails, it should use a configured fallback host and port.

## HTTP API

### `GET /api/health`

Returns service health and basic metadata.

Example response:

```json
{
  "ok": true,
  "service": "segtori-ocr",
  "version": "0.1.0"
}
```

### `POST /api/scan`

Accepts a camera image as multipart form data under the field name `image`.

Example response:

```json
{
  "ocrText": "ACME 12MM HEX BOLT BIN A17",
  "match": {
    "id": "rec123",
    "name": "ACME 12mm Hex Bolt",
    "quantity": 42,
    "score": 0.86
  },
  "candidates": [
    {
      "id": "rec123",
      "name": "ACME 12mm Hex Bolt",
      "quantity": 42,
      "score": 0.86
    }
  ]
}
```

If no acceptable match is found, the server should still return OCR text and an empty or null match.

When scan diagnostics are enabled, the response may also include a scan ID for server-side debug output.

### `POST /api/items/:id/quantity`

Updates quantity for a specific inventory item.

Example request:

```json
{
  "quantity": 43
}
```

Example response:

```json
{
  "ok": true,
  "id": "rec123",
  "quantity": 43
}
```

## Airtable Integration

The Airtable integration should use one configured table as the Phase 1 source of truth.

Required fields:

- Stable item ID field.
- Human-readable item name field.
- Quantity field.

The service should treat Airtable record IDs as valid item IDs when no custom item ID field is configured.

## Local Inventory Direction

Local inventory support should be added behind the same service API. The firmware should not need to know whether inventory data came from Airtable or a local database. The server should expose a consistent scan and quantity update contract across both backends.

Planned local inventory endpoints:

- `GET /api/items`: lists inventory items.
- `POST /api/items`: creates a local inventory item.
- `POST /api/import`: imports local CSV or JSON inventory data.

Planned diagnostic endpoint:

- `GET /api/scans/:id`: returns scan diagnostics when debug mode is enabled.

Current Phase 1 development endpoints:

- `GET /`: serves a live, incrementally loaded gallery of persisted scan jobs.
- `GET /api/jobs`: lists persisted scan jobs in cursor-paginated batches.
- `GET /api/jobs/:id`: returns one persisted scan job.
- `GET /jobs/:id/image`: returns the original image for a persisted scan job.
- `WS /ws/jobs`: publishes ingested, completed, and failed scan-job updates.

These endpoints expose development diagnostics and are not part of the
firmware-facing API contract.

The service advertises `tori.local` as its default mDNS host so the dashboard
is reachable on the LAN at `http://tori.local:8674/`.

## Scan Job Persistence

During the current host-run development phase, each scan request creates a job
under `service/process/<scan-id>/`. The original image and `job.json` are
retained even when inventory lookup or matching fails. This allows camera,
OCR, and integration failures to be investigated independently.

Failed jobs should preserve any OCR text already produced under
`diagnostics.ocrText`.

## Future Configuration

Phase 2 scan quality configuration:

- `MATCH_MIN_SCORE`: minimum score for automatic match acceptance.
- `SCAN_DEBUG_ENABLED`: enables scan diagnostics.
- `SCAN_DEBUG_DIR`: stores diagnostic output.
- `OCR_PREPROCESS_MODE`: selects the preprocessing profile.
- `OCR_BACKEND`: selects `tesseract`, `ollama`, or `onnx`.
- `ONNX_PROVIDER`: selects automatic, CPU, or strict CUDA ONNX execution.
- `ONNX_PYTHON_PATH`: selects the isolated RapidOCR worker environment.

Later inventory configuration:

- `INVENTORY_BACKEND`: `airtable` or `local`.
- `LOCAL_DB_PATH`: SQLite path for local inventory mode.

## Error Handling

The firmware should show clear short states for:

- Server not found.
- Upload failed.
- OCR failed.
- No confident item match.
- Quantity update failed.

The server should return structured JSON errors with an HTTP status code and a concise message.
