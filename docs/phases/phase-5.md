# Phase 5: Device UX And Provisioning

Phase 5 improves setup, device state handling, and day-to-day usability.

## Goals

- Make Wi-Fi and server setup possible without recompiling firmware.
- Expand display states for real scan and update failures.
- Make candidate selection and quantity editing feel fast on the handheld controls.

## Firmware Behavior

The firmware should add:

- Persistent Wi-Fi and server fallback settings.
- A setup mode for provisioning.
- Candidate browsing on D-pad left/right.
- Quantity step changes or candidate movement using D-pad left/right depending on screen state.
- Confirm/select for match confirmation and quantity submission.
- Back/cancel for returning to ready state or dismissing errors.
- Clear states for no-match, offline, server error, OCR error, and update failure.

## Acceptance Criteria

- A user can configure Wi-Fi/server settings without editing firmware source.
- The device can recover cleanly from server discovery failure.
- Candidate confirmation and quantity update states are clear on the display.
- Button behavior is consistent across ready, scan, candidate, edit, and error states.

