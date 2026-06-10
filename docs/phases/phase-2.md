# Phase 2: Scan Accuracy And Matching

Phase 2 improves the core scan and identify loop while it is still easy to
iterate on the server. This phase is accepted based on the current dataset,
confidence behavior, diagnostics, and handheld latency measurements.

## Progress Checklist

### Recognition And Matching

- [x] Add normalized and thresholded Tesseract preprocessing profiles.
- [x] Select the strongest OCR profile per scan.
- [x] Normalize inventory text and support optional aliases.
- [x] Add configurable score and runner-up margin confidence gates.
- [x] Return ranked candidates while withholding uncertain automatic matches.
- [x] Add a swappable Ollama vision backend and evaluate small local models.
- [x] Add RapidOCR ONNX recognition with verified GPU acceleration.
- [x] Evaluate RapidOCR behavior on the representative dataset.
- [x] Evaluate a persistent ONNX worker against the process-per-scan baseline.

### Diagnostics And Evaluation

- [x] Add an ignored paired high/low-resolution evaluation dataset.
- [x] Add a repeatable dataset benchmark utility.
- [x] Persist backend, preprocessing, OCR, match, and timing diagnostics.
- [x] Support optional processed debug images.
- [x] Expose operator roundtrip and server-stage timings in the scan frontend.
- [x] Demonstrate improved OCR coverage, candidate coverage, and confidence behavior.

### Firmware And Exit Criteria

- [x] Return uncertain candidates without silently accepting them.
- [x] Demonstrate materially improved match behavior on representative labels.
- [x] Keep uncertain matches from silently producing incorrect updates.
- [x] Validate acceptable handheld trigger-to-result latency.

### Deferred Validation

- Establish labeled ground truth and annotate invalid samples when accuracy
  tuning resumes.
- Compare OCR backends against a labeled holdout set before making future model
  or preprocessing changes.
- Implement candidate browsing and confirmation with the physical handheld UX
  in Phase 5.

## Goals

- Improve OCR quality for real labels and tags.
- Improve inventory match quality before adding more deployment complexity.
- Make low-confidence matches visible instead of silently choosing the wrong item.
- Add diagnostics so scan failures can be debugged from the server.

## Server Behavior

The server should support swappable recognition backends so accuracy and
resource tradeoffs can be evaluated without changing the firmware API:

- Keep Tesseract as the lightweight default backend.
- Support a local Ollama vision backend for experimental visual transcription.
- Keep RapidOCR ONNX available as the dedicated GPU-accelerated OCR path.
- Keep the RapidOCR worker warm so scans avoid repeated model startup cost.
- Keep backend name, model, latency, and preprocessing diagnostics visible.
- Treat handheld trigger-to-result roundtrip as the primary operator latency
  metric, with capture, network/upload, OCR, inventory, and matching stages
  exposed for diagnosis.

The Tesseract backend should add image preprocessing:

- Resize images to a predictable OCR-friendly range.
- Convert images to grayscale.
- Normalize contrast.
- Apply thresholding where it improves label readability.
- Support an optional crop/preprocess mode through configuration.

The matching layer should become more robust:

- Normalize OCR text and inventory names before scoring.
- Score item names with token-aware fuzzy matching.
- Support aliases or keywords for inventory records when available.
- Use a configurable minimum confidence threshold.
- Require enough separation between the best and runner-up candidates before
  accepting an automatic match.
- Return ranked candidates when the best match is uncertain.

The server should support diagnostics when debug mode is enabled:

- OCR text.
- Ranked match scores.
- Preprocessing mode used.
- Optional saved original and processed images.
- A scan ID that can be used to inspect debug output.

The server diagnostic web interface should make this information easy to scan:

- Prioritize scan status, accepted or withheld match, confidence, and latency.
- Make OCR text, ranked candidates, and provider/stage metrics easy to inspect.
- Clearly distinguish weak OCR, weak score, and insufficient runner-up margin.
- Keep the interface focused on development diagnostics rather than becoming a
  second device-facing product UI.

## Firmware Behavior

The firmware API remains the same. Candidate browsing and confirmation are
deferred to Phase 5, where the physical display and controls own that behavior:

- Show the best match when confidence is high.
- Show candidate selection when confidence is below the configured threshold.
- Allow D-pad left/right to move between candidate matches.
- Require confirm/select before quantity editing when a match is uncertain.

## Configuration Defaults

Additional server configuration:

- `MATCH_MIN_SCORE`: minimum score for an automatic best match.
- `MATCH_MIN_MARGIN`: minimum score separation from the runner-up.
- `SCAN_DEBUG_ENABLED`: enables scan diagnostics.
- `SCAN_DEBUG_DIR`: stores debug images and metadata when diagnostics are enabled.
- `OCR_PREPROCESS_MODE`: selects the preprocessing profile, default `auto`.
- `OCR_BACKEND`: selects `tesseract`, `ollama`, or `onnx`.
- `OLLAMA_VISION_MODEL`: selects the local vision model.
- `OLLAMA_KEEP_ALIVE`: keeps a loaded model resident between scans.
- `OLLAMA_CONTEXT_SIZE`: sets an explicit vision-capable context size.
- `OLLAMA_IMAGE_MAX_SIZE`: limits image size before visual inference.
- `ONNX_PROVIDER`: selects `auto`, `cpu`, or strict `cuda` execution.
- `ONNX_PYTHON_PATH`: selects the isolated RapidOCR worker environment.
- `ONNX_TIMEOUT_MS`: limits one ONNX worker request.

## Evaluation Approach

- Keep local evaluation images and generated reports outside Git.
- Treat blurry or otherwise unusable images as annotated invalid samples rather
  than tuning preprocessing around them.
- Use broad preprocessing profiles that generalize beyond the current dataset.
- Measure accuracy against labeled ground truth or a labeled holdout set.
- Treat OCR coverage, confidence scores, and high/low pair agreement as
  diagnostics only when ground truth is unavailable.
- Reject a backend when its latency, resource use, or false-confidence behavior
  is unsuitable even if its transcriptions appear stronger on a small sample.
- The persistent ONNX worker is now the baseline; keep measuring it against
  dataset and handheld latency targets as the backend evolves.

## Acceptance Criteria

- A representative label image set produces better OCR or better match behavior than Phase 1.
- Uncertain scans return candidates instead of selecting a weak match without confirmation.
- Debug output can explain why a scan matched or failed.
- The firmware-facing scan and quantity endpoints remain compatible with Phase 1.
