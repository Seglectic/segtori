# Phase 1: MVP Scan And Identify Flow

Phase 1 builds the smallest useful read-only scan-and-identify system.

## Progress Checklist

### Firmware

- [x] Build firmware for the nulllab ESP32-S3-CAM and legacy AI Thinker target.
- [x] Connect to Wi-Fi and discover the service through mDNS or a fallback host.
- [x] Capture a real camera frame and upload it on the scan control.
- [x] Discard stale frames and shut down the camera between scans.
- [x] Report scan states and errors over serial.
- [x] Display scan status, accepted identification results, and inventory
  quantity through the ESP-hosted handheld web console.

### Service And Inventory

- [x] Implement health, scan, and job-diagnostics endpoints.
- [x] Reject scan requests without an image.
- [x] Run Tesseract OCR and fuzzy inventory matching.
- [x] Fetch Airtable inventory records with the configured credentials.
- [x] Advertise the service through mDNS.
- [x] Persist scan diagnostics and expose the scan gallery.
- [x] Return ranked candidates corresponding to Airtable inventory records.
- [x] Keep Airtable access read-only during the MVP.

### Exit Criteria

- [x] A handheld scan sends an actual camera image to the service.
- [x] The service returns OCR output and ranked Airtable inventory candidates.
- [x] The handheld web console displays identification results.
- [x] Service discovery and configured fallback-host recovery work.

## Goals

- Device can capture an image on button press.
- Device can discover or connect to the Segtori server.
- Server can OCR the image with the system `tesseract` binary.
- Server can fetch Airtable inventory records.
- Server can fuzzy-match OCR text to ranked inventory candidates.
- Handheld web console can display identification results and current quantity.
- Airtable remains a read-only inventory source during the MVP.

## Delivery Approach

Phase 1 implementation work should use a coordinating-agent model:

- The primary agent the user interacts with owns the plan, sequencing, and final integration decisions.
- Parallel agents may be used for distinct workstreams such as firmware, service API/OCR, Airtable integration, and container packaging.
- The coordinating agent should keep the firmware-facing API and shared configuration contract aligned across those workstreams.
- Before Phase 1 is considered complete, the coordinating agent should reconcile parallel changes, run the narrowest relevant verification for each area, and report any remaining gaps clearly.

## Server Behavior

The Phase 1 server runs from `service/` as a Node.js Express app.

Required endpoints:

- `GET /api/health`: returns readiness and basic service metadata.
- `POST /api/scan`: accepts an uploaded image, runs OCR, fetches inventory records, and returns recognized text plus the best inventory match.

The existing quantity-update endpoint is outside Phase 1 acceptance. Airtable
write access remains disabled until it is explicitly enabled after safe
quantity workflows are validated against the Phase 4 local inventory backend.

`POST /api/scan` should return:

- OCR text.
- Best matching item ID.
- Best matching item name.
- Current quantity when available.
- Match score.
- A short list of lower-ranked candidates if available.

The matching implementation can start with a simple fuzzy string comparison between OCR text and Airtable item names. Phase 1 should prefer a transparent, debuggable algorithm over a complex model.

Phase 1 should also tighten a few scaffold-level contracts before broader feature work:

- Reject `POST /api/scan` requests that do not include an image upload.
- Derive health metadata such as service name and version from runtime or package metadata instead of hard-coding duplicate values.
- Start real mDNS advertisement only after the HTTP listener is bound successfully.

## Firmware Behavior

The Phase 1 firmware runs from `firmware/` on ESP32-CAM hardware.

Required flow:

1. Join the configured Wi-Fi network.
2. Discover the server through mDNS, falling back to a configured host if needed.
3. Initialize the camera, scan control, and handheld web console.
4. On scan button press, capture a still image.
5. Upload the image to `POST /api/scan`.
6. Show OCR/matching progress and identification results in the web console.
7. Show success or failure feedback.

Physical display, dedicated control, and quantity-edit workflows are deferred
to Phase 5. Camera orientation and enclosure validation are deferred to Phase
6.

## Container Direction

Phase 1 may run the Node.js service directly on a development machine and call the system `tesseract` installation. Docker packaging should be scaffolded in `service/` so the later production version can run as a container that includes Tesseract and advertises itself on the local network.

During development, direct host execution should remain the default workflow. Docker should stay optional for local iteration and should mainly be used for packaging checks or deployment-specific testing.

The Phase 1 container setup should also become reproducible:

- Commit a lockfile for the Node service.
- Use `npm ci` in container builds instead of `npm install`.

## Acceptance Criteria

- Pressing the device scan button sends an actual camera image to the server.
- The server returns OCR output and ranked Airtable inventory candidates.
- The handheld web console displays scan and identification results.
- Airtable access remains read-only.
- The server can be found without hard-coding an IP address when mDNS is available.
- A configured server host fallback exists for networks where mDNS is unavailable.

## Current Implementation Status

The current Phase 1 development setup has validated the capture-to-service
portion of the flow on the nulllab ESP32-S3-CAM:

- The onboard Boot button and serial `snap` command trigger real captures.
- The firmware discovers the service with mDNS and supports a configured host
  fallback.
- Maximum-resolution OV3660 images upload to `POST /api/scan`.
- The camera is initialized per snap, stale frames are discarded, and the
  camera is shut down while idle.
- The service runs Tesseract and persists each image plus job diagnostics.
- A service-hosted local gallery allows manual inspection of uploaded jobs.
- Airtable credentials provide read access to inventory records, and scan
  results include ranked candidates from those records.
- The ESP-hosted handheld web console displays scan state, OCR output,
  identification candidates, quantity, confidence, and timing feedback.

Phase 1 is complete. Recognition accuracy and uncertain-match behavior continue
in Phase 2; writable local inventory, physical controls, and enclosure work
remain in later phases.
