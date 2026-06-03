# AGENTS.md

This file gives coding agents the minimum context needed to work safely in this repository.

## Project Summary

TORI, the Tagged Object Recognition Interface, is a handheld inventory device. The ESP32-CAM firmware captures images and sends them to a local OCR service, which reads text, matches it against inventory data, and returns an item record so quantity can be updated from the device.

Primary responsibilities:

- `firmware/`: ESP32-CAM capture, Wi-Fi, service discovery, display states, buttons, D-pad input, and server requests.
- `service/`: OCR service, Tesseract integration, inventory backend integration, matching, scan diagnostics, Docker packaging, and mDNS advertisement.
- `docs/`: project phases, architecture, and design direction.
- `util/`: developer utilities, including local service testers that exercise the firmware-facing server flow without the ESP32.

## Comment Style

Keep comments sparse, clean, and useful. Comments should explain file intent, assumptions, hardware or network caveats, state-machine behavior, or logic that is easy to break. Avoid comments that restate obvious code.

Every source file should start with a decorative comment header that states the file's intent. Keep the header short: name the file or module, then summarize what it owns in one to three compact lines.

```js
// ╭────────────────────────────╮
// │  OCR Runner                │
// │  Runs Tesseract on scan    │
// │  images and normalizes     │
// │  returned text.            │
// ╰────────────────────────────╯
```

```cpp
// ╭────────────────────────────╮
// │  Camera Capture            │
// │  Configures the OV2640 and │
// │  captures still frames for │
// │  upload to the OCR server. │
// ╰────────────────────────────╯
```

Larger files may also use decorative section headers for major internal regions:

```js
// ┌───────────────┐
// │ Preprocessing │
// └───────────────┘
```

Do not add decorative headers for every function or tiny internal block. Prefer clear names and small functions so comments stay rare. When comments are needed, keep them close to the behavior they clarify.

Good places for comments:

- OCR preprocessing choices that affect recognition quality.
- Matching thresholds, alias handling, and confidence behavior.
- Inventory backend boundaries between Airtable and local storage.
- mDNS discovery and fallback behavior.
- Scan diagnostics and debug image retention.
- ESP32-CAM pin, camera, memory, or timing caveats.
- Display state transitions and D-pad semantics.
- Capture/upload paths where memory pressure or network timing matters.

Avoid:

- Line-by-line narration.
- Repeating function names in prose.
- Decorative internal headers for tiny blocks.
- Long historical explanations that belong in docs.

## Firmware Guardrails

- Treat camera setup, pin mappings, display wiring, and button mappings as hardware-sensitive.
- Keep the firmware thin: capture, display, controls, Wi-Fi, discovery, and HTTP calls.
- Keep OCR, matching, diagnostics, and inventory backend logic in `service/`.
- Preserve the Phase 1 server API unless a task explicitly changes the firmware/server contract.
- Avoid committing Wi-Fi credentials, Airtable tokens, or machine-specific server addresses.
- Prefer explicit state names for UI flow so transitions are easy to reason about.

## Service Guardrails

- Keep `GET /api/health`, `POST /api/scan`, and `POST /api/items/:id/quantity` stable for the device.
- Keep Airtable and local inventory behind a consistent server API.
- Keep scan quality improvements server-side where they can be tuned without reflashing firmware.
- Make Tesseract and image preprocessing behavior debuggable.
- Avoid introducing dependencies unless they clearly improve OCR, matching, deployment, or reliability.
- Treat scan debug images as diagnostic output, not source files.

## Suggested Workflow

1. Read `docs/README.md`, `docs/phases.md`, the relevant phase file under `docs/phases/`, and `docs/architecture.md` before changing firmware or service behavior.
2. Confirm which phase the task belongs to before expanding scope.
3. For firmware work, identify the hardware assumptions before editing pin, camera, display, or button code.
4. For server work, preserve the firmware-facing API unless the user explicitly asks for an API change.
5. Give each source file a decorative top header, then add other comments only where they protect future readers from non-obvious behavior.
6. Verify changes with the narrowest relevant test or build available, and report clearly if verification is blocked.
7. Prefer the local tester under `util/toriTest/` when verifying scan or matching behavior that does not require real hardware input.
