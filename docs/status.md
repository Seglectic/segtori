# Segtori Project Status

This file tracks implementation progress against the phase documents. Update
it when a capability is demonstrated end to end, not merely scaffolded.

## Current Position

- Active phase: **Phase 3: Containerized Network Service**
- Phase 0: complete
- Phase 1: complete
- Phase 2: complete
- Phase 3: in progress

Phase 1 is complete as a read-only scan-and-identify MVP. Airtable inventory
reads and ranked OCR-to-inventory candidates are available for Phase 2 accuracy
work. Airtable writes remain intentionally disabled; quantity editing will be
validated against the Phase 4 local backend before any explicit Airtable
write-access decision.

## Phase 0: Project Scaffolding

- [x] Separate `firmware/`, `service/`, and `docs/` project areas.
- [x] Define the firmware-facing HTTP API.
- [x] Scaffold PlatformIO Arduino firmware.
- [x] Scaffold Node.js Express service.
- [x] Add Tesseract, Airtable, matching, mDNS, and Docker foundations.
- [x] Document configuration and phased implementation direction.

## Phase 1: MVP Scan And Identify Flow

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
- [x] Display scan state, accepted identification results, quantity,
  confidence, and timing feedback through the ESP-hosted handheld web console.

### Service And Integration

- [x] Serve `GET /api/health`.
- [x] Accept image uploads at `POST /api/scan`.
- [x] Reject scan requests without an image.
- [x] Run OCR with the host-installed Tesseract binary.
- [x] Implement Airtable inventory lookup.
- [x] Implement fuzzy inventory matching and ranked candidates.
- [x] Advertise the service with mDNS after the HTTP listener starts.
- [x] Persist scan images and `job.json` diagnostics.
- [x] Preserve OCR diagnostics when later processing fails.
- [x] Provide a manually refreshed local scan-job gallery.
- [x] Configure valid Airtable credentials and inventory field mappings.
- [x] Return ranked candidates corresponding to Airtable inventory records.
- [x] Keep Airtable access read-only for the MVP.

### Phase 1 Exit Criteria

- [x] Pressing a device button sends an actual camera image to the service.
- [x] The service returns OCR output and ranked Airtable inventory candidates.
- [x] The handheld web console displays identification results.
- [x] Airtable remains a read-only inventory source.
- [x] The service can be discovered without a hard-coded IP address.
- [x] A configured fallback host works when discovery is unavailable.

## Phase 2: Scan Accuracy And Matching

### Server And Evaluation

- [x] Add an ignored paired high/low-resolution evaluation dataset.
- [x] Add a repeatable dataset benchmark utility.
- [x] Add normalized and thresholded OCR preprocessing profiles.
- [x] Select the strongest OCR profile per scan.
- [x] Add configurable minimum score and runner-up margin confidence gates.
- [x] Return ranked candidates while withholding uncertain automatic matches.
- [x] Persist selected preprocessing mode and OCR variant diagnostics.
- [x] Support optional saved processed debug images.
- [x] Support optional Airtable aliases for matching.
- [x] Add swappable Tesseract and Ollama recognition backends.
- [x] Add Ollama image resizing, explicit context size, keep-alive, and timing
  diagnostics.
- [x] Evaluate small Ollama vision models on the local GPU.
- [x] Expose operator roundtrip, capture, upload/network, server total, and
  server-stage timing metrics on the handheld web console.
- [x] Publish completed handheld timing telemetry back to the active scan-job
  frontend without delaying initial operator feedback.
- [x] Add RapidOCR ONNX recognition with verified GPU acceleration.
- [x] Run the complete high-resolution dataset through strict CUDA execution.
- [x] Accept current RapidOCR dataset behavior as the Phase 2 baseline.
- [x] Withhold uncertain matches instead of silently accepting them.
- [x] Validate acceptable warmed-preview handheld latency.

Formal labeled-ground-truth evaluation remains useful when accuracy tuning
resumes, but it is no longer a Phase 2 completion blocker. Candidate-selection
UX is deferred to Phase 5 because it belongs with the physical display,
D-pad, and confirmation controls.

The initial unlabeled paired-dataset benchmark improved non-empty OCR from
77/88 to 88/88, candidate coverage from 62/88 to 88/88, average best-candidate
score from 0.421 to 0.713, and high/low pair agreement from 3/44 to 14/44.
Confidence gating accepted 37/88 scans automatically and withheld the rest as
uncertain. Average scan latency increased from 1.54 seconds to 3.67 seconds.
These figures are diagnostic signals, not accuracy measurements.

The Ollama experiment confirmed that local vision models can be selected
without changing the firmware-facing API. On this host, Ollama loads the
language models fully onto the RTX 3080, but the vision encoders remain
CPU-bound. Moondream was faster when warm but did not reliably extract useful
label text. Gemma 3 produced stronger-looking transcriptions on a five-image
sample, but averaged roughly 44 seconds per image and showed false-confidence
risk. Ollama remains an optional experimental backend. RapidOCR ONNX with
strict CUDA execution is now the default while its accuracy is evaluated
against labeled ground truth; Tesseract remains available as a fallback.

The initial RapidOCR ONNX backend is now integrated behind `OCR_BACKEND=onnx`
and kept warm between scans. On one representative high-resolution image, CPU
inference extracted eight text lines in 1.68 seconds, with a 5.83-second
first-run total including model initialization. A warm CPU smoke test through
`POST /api/scan` completed in 3.01 seconds and returned an accepted exact
inventory match. CUDA 12 and cuDNN 9 runtime libraries are now isolated inside
the ONNX worker environment alongside the host CUDA 13 toolkit. All three
RapidOCR model sessions attach to the RTX 3080 through `CUDAExecutionProvider`.
The same HTTP smoke test completed in 2.72 seconds on GPU. Strict
`ONNX_PROVIDER=cuda` still fails instead of silently accepting a CPU fallback.

The first full high-resolution RapidOCR CUDA benchmark completed all 44 scans
without request failures. Every scan produced OCR and ranked candidates; 37
were automatically accepted and 7 were withheld. Average best-candidate score
was 0.905 and average HTTP roundtrip was 2.15 seconds, with a 2.15-second median
and 2.33-second p95. One withheld scan found the correct item at score 1.0 but
hit the duplicate-result margin gate; the other six had weak or incomplete OCR.
These remain diagnostic signals until the dataset has labeled ground truth.

The first measured handheld scan after timing instrumentation completed in
5.47 seconds from trigger to result: 1.30 seconds capturing, 3.92 seconds
uploading and waiting for the server, and 3.81 seconds inside the server.
OCR consumed 2.85 seconds. The server timer begins before Multer finishes
receiving the request body, so it overlaps image transfer and cannot be
subtracted from the device request timer to derive upload latency.

Direct firmware instrumentation measured steady image writes at 333-480 ms for
180-188 KB JPEGs, roughly 0.4-0.55 MB/s, with socket connection setup taking
about 5 ms. Firmware now records socket connect, image write, and response wait
separately, handles partial socket writes, disables Wi-Fi power saving only
while a scan request is in flight, and uses larger writes to reduce per-chunk
overhead. Operator roundtrip remains the primary latency metric for further
optimization.

Increasing image write chunks from one TCP maximum-segment-sized 1460-byte
write to 16 KB reduced the steady average image-write time from 380 ms for
181-188 KB frames to 266 ms for slightly larger 187-202 KB frames. That is
about a 30% transfer-latency reduction and a 52% throughput increase, from
roughly 0.49 MB/s to 0.74 MB/s. The remaining request time is primarily
post-upload server processing, while capture itself remains near 1.3 seconds.

A follow-up OV3660 trial reduced capture dimensions from 2048x1536 to
1024x768, which is half the linear resolution and one quarter of the pixels.
Across four steady scans, JPEG size fell from about 198 KB to 42 KB and
operator roundtrip fell from 2.26 seconds to 1.67 seconds, saving 583 ms or
26%. Compared with the original pre-upload-tuning run, the half-resolution
trial saves about 916 ms or 35%. Average image-write time fell from 266 ms to
70 ms, while capture improved from 1.32 seconds to 1.15 seconds. The live
benchmark scene produced no useful OCR at either resolution, so recognition
quality still needs comparison on representative labels before adopting this
resolution permanently.

A warmed-preview lifecycle now models the intended two-control display flow.
Starting preview initializes the camera, warms automatic exposure at QVGA, and
continues pumping preview frames. Snapping from that warm session switches to
the selected capture resolution, captures, uploads, and then shuts the camera
down. Across three warm-preview half-resolution scans, average snap-time
capture fell from about 1.15 seconds cold to 127 ms, and average operator
roundtrip fell from 1.67 seconds to 660 ms. This moves roughly one second of
camera startup and exposure work into the operator-controlled preview period.
The camera-owned JPEG framebuffer must remain valid through upload, so camera
shutdown occurs immediately after the upload completes.

The firmware now also exposes a controller-independent handheld display
framework. Preview JPEG frames are throttled to 10 FPS and routed to replaceable
SPI/JPEG backend hooks, while device-state changes are routed to the same
backend for compact UI rendering. The disabled default backend keeps current
hardware behavior unchanged. A selected panel backend should use block-based
JPEG-to-RGB565 decode and pause naturally during final capture and upload.
Repurposing the unused TF-card GPIO38/39/40 pads is the leading SPI wiring
direction, but final panel control wiring and battery impact remain Phase 6
hardware-validation work.

## Phase 3: Containerized Network Service

The existing Docker files are scaffolding, not a working deployment target.
The image currently copies only the Node.js source while runtime configuration
defaults to the host-managed ONNX/CUDA worker. Phase 3 will package RapidOCR
ONNX directly and will not install Tesseract. Tesseract remains only as a
legacy host-run diagnostic fallback outside the supported container path. The
container also does not yet provide a health check, persist diagnostics, or
validate mDNS networking.

## Next Work Queue

1. Package the locked RapidOCR ONNX worker and runtime in the image.
2. Prefer CUDA and clearly report automatic CPU fallback.
3. Add a container health check and persistent scan-diagnostics volume.
4. Validate Airtable reads and the firmware-facing API from the container.
5. Document and test host-network and bridge-network mDNS behavior.
6. Verify restart persistence and run an end-to-end firmware scan.

## Tracking Approach

Use the Progress Checklist in each individual phase document as the canonical
detailed tracker. Keep current measurements, cross-phase context, and the
immediate work queue in this file. A phase is complete only when every item in
its Exit Criteria is checked.

A Kanban board is not necessary yet. Add a GitHub Projects board when work is
regularly split across multiple contributors or when the issue backlog becomes
difficult to prioritize from this checklist.
