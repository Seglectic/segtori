# Phase 5: Device UX And Provisioning

Phase 5 improves setup, device state handling, and day-to-day usability.

## Progress Checklist

### Firmware UX

- [x] Establish explicit device scan and error states.
- [x] Recover from mDNS discovery failure using a configured fallback host.
- [ ] Persist Wi-Fi and server fallback settings.
- [ ] Add an on-device provisioning mode.
- [ ] Add candidate browsing and confirmation.
- [ ] Add quantity editing and submission.
- [ ] Render clear no-match, offline, OCR, service, and update-failure states.
- [ ] Make controls consistent across all device states.

### Exit Criteria

- [ ] Configure Wi-Fi and server settings without recompiling firmware.
- [ ] Recover cleanly from service discovery and connectivity failures.
- [ ] Make candidate confirmation and quantity updates clear on the display.
- [ ] Validate consistent control behavior across the full handheld workflow.

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
