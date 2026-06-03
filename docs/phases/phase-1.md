# Phase 1: MVP Scan And Quantity Flow

Phase 1 builds the smallest useful end-to-end system.

## Goals

- Device can capture an image on button press.
- Device can discover or connect to the Segtori server.
- Server can OCR the image with the system `tesseract` binary.
- Server can fetch Airtable inventory records.
- Server can fuzzy-match OCR text to the closest inventory item name.
- Device can display the best match and current quantity.
- Device can adjust quantity with the D-pad and send the update.

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
- `POST /api/items/:id/quantity`: updates the matched inventory item quantity.

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
3. Initialize camera, display, primary scan button, and D-pad.
4. On scan button press, capture a still image.
5. Upload the image to `POST /api/scan`.
6. Show OCR/matching progress on the display.
7. Show the best item match and current quantity.
8. Use D-pad up/down to change quantity.
9. Use confirm/select to submit the quantity update.
10. Show success or failure feedback.

## Container Direction

Phase 1 may run the Node.js service directly on a development machine and call the system `tesseract` installation. Docker packaging should be scaffolded in `service/` so the later production version can run as a container that includes Tesseract and advertises itself on the local network.

During development, direct host execution should remain the default workflow. Docker should stay optional for local iteration and should mainly be used for packaging checks or deployment-specific testing.

The Phase 1 container setup should also become reproducible:

- Commit a lockfile for the Node service.
- Use `npm ci` in container builds instead of `npm install`.

## Acceptance Criteria

- Pressing the device scan button sends an actual camera image to the server.
- The server returns OCR output and a best inventory match.
- The displayed item ID or name corresponds to an Airtable record.
- Quantity edits from the device update Airtable.
- The server can be found without hard-coding an IP address when mDNS is available.
- A configured server host fallback exists for networks where mDNS is unavailable.
