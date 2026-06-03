# Phase 2: Scan Accuracy And Matching

Phase 2 improves the core scan and identify loop while it is still easy to iterate on the server.

## Goals

- Improve OCR quality for real labels and tags.
- Improve inventory match quality before adding more deployment complexity.
- Make low-confidence matches visible instead of silently choosing the wrong item.
- Add diagnostics so scan failures can be debugged from the server.

## Server Behavior

The server should add image preprocessing before Tesseract:

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
- Return ranked candidates when the best match is uncertain.

The server should support diagnostics when debug mode is enabled:

- OCR text.
- Ranked match scores.
- Preprocessing mode used.
- Optional saved original and processed images.
- A scan ID that can be used to inspect debug output.

## Firmware Behavior

The firmware API should remain the same. Phase 2 firmware changes should focus on how match results are presented:

- Show the best match when confidence is high.
- Show candidate selection when confidence is below the configured threshold.
- Allow D-pad left/right to move between candidate matches.
- Require confirm/select before quantity editing when a match is uncertain.

## Configuration Defaults

Additional server configuration:

- `MATCH_MIN_SCORE`: minimum score for an automatic best match.
- `SCAN_DEBUG_ENABLED`: enables scan diagnostics.
- `SCAN_DEBUG_DIR`: stores debug images and metadata when diagnostics are enabled.
- `OCR_PREPROCESS_MODE`: selects the preprocessing profile, default `auto`.

## Acceptance Criteria

- A representative label image set produces better OCR or better matches than Phase 1.
- Uncertain scans return candidates instead of selecting a weak match without confirmation.
- Debug output can explain why a scan matched or failed.
- The firmware-facing scan and quantity endpoints remain compatible with Phase 1.

