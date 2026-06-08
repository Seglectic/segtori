# Segtori Project Status

This file tracks implementation progress against the phase documents. Update
it when a capability is demonstrated end to end, not merely scaffolded.

## Current Position

- Active phase: **Phase 1: MVP Scan And Quantity Flow**
- Phase 0: complete
- Phase 1: in progress
- Primary blocker: valid Airtable credentials and inventory schema are not
  currently available for end-to-end matching and quantity-update validation.

Some development diagnostics planned conceptually for Phase 2 have been added
early because they make Phase 1 hardware and integration work easier to debug.
Phase 2 has not started as a formal implementation phase.

## Phase 0: Project Scaffolding

- [x] Separate `firmware/`, `service/`, and `docs/` project areas.
- [x] Define the firmware-facing HTTP API.
- [x] Scaffold PlatformIO Arduino firmware.
- [x] Scaffold Node.js Express service.
- [x] Add Tesseract, Airtable, matching, mDNS, and Docker foundations.
- [x] Document configuration and phased implementation direction.

## Phase 1: MVP Scan And Quantity Flow

### Firmware And Hardware

- [x] Build firmware for the nulllab ESP32-S3-CAM.
- [x] Keep the AI Thinker ESP32-CAM as a legacy build target.
- [x] Join configured Wi-Fi.
- [x] Discover the Segtori service with mDNS.
- [x] Fall back to a configured service host.
- [x] Trigger a snap with the onboard Boot button.
- [x] Trigger a snap through the serial console.
- [x] Capture and upload maximum-resolution OV3660 JPEG images.
- [x] Discard stale frames before the final capture.
- [x] Shut down the camera and reduce CPU speed while idle.
- [x] Explicitly keep the onboard double flashlight off while idle.
- [x] Illuminate captures and fade the onboard flashlight after exposure.
- [x] Report useful capture, upload, and service states over serial.
- [ ] Validate image orientation with the board in its intended enclosure.
- [ ] Initialize and render states on the intended device display.
- [ ] Add the intended dedicated scan button and D-pad controls.
- [ ] Display the best inventory match and current quantity.
- [ ] Edit and submit quantity changes from the device.

### Service And Integration

- [x] Serve `GET /api/health`.
- [x] Accept image uploads at `POST /api/scan`.
- [x] Reject scan requests without an image.
- [x] Run OCR with the host-installed Tesseract binary.
- [x] Implement Airtable inventory lookup and quantity-update clients.
- [x] Implement fuzzy inventory matching and ranked candidates.
- [x] Advertise the service with mDNS after the HTTP listener starts.
- [x] Persist scan images and `job.json` diagnostics.
- [x] Preserve OCR diagnostics when later processing fails.
- [x] Provide a manually refreshed local scan-job gallery.
- [ ] Configure valid Airtable credentials and inventory field mappings.
- [ ] Validate OCR-to-Airtable best-match results end to end.
- [ ] Validate quantity updates to Airtable end to end.
- [ ] Validate a representative set of real labels and tags.

### Phase 1 Exit Criteria

- [x] Pressing a device button sends an actual camera image to the service.
- [ ] The service returns OCR output and a valid Airtable inventory match.
- [ ] The device displays the matched Airtable item.
- [ ] Quantity edits from the device update Airtable.
- [x] The service can be discovered without a hard-coded IP address.
- [x] A configured fallback host works when discovery is unavailable.

## Next Work Queue

1. Configure Airtable credentials and verify field mappings.
2. Exercise OCR, matching, and quantity updates against real inventory data.
3. Choose and connect the intended display and physical controls.
4. Implement the match display and quantity-edit workflow.
5. Run the complete Phase 1 acceptance flow and close remaining checklist items.

## Tracking Approach

Keep phase-level progress in this file and detailed requirements in the
individual phase documents. Use GitHub issues for defects or tasks that need
discussion, ownership, or their own implementation history.

A Kanban board is not necessary yet. Add a GitHub Projects board when work is
regularly split across multiple contributors or when the issue backlog becomes
difficult to prioritize from this checklist.
