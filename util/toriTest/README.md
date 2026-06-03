# TORI Server Tester

`toriTest.py` is a local developer utility for exercising the TORI service without the ESP32 firmware.

It can:

- discover the service over `_tori-ocr._tcp.local`
- show health and connection metadata
- upload an image to `POST /api/scan`
- send manual text to `POST /api/match-text`
- show OCR text, the best match, and ranked candidates

## Requirements

- `uv`
- Python 3.11 or newer
- A running TORI service on the local network or host

## Setup

```bash
cd util/toriTest
```

## Run

```bash
uv run toriTest.py
```

## Notes

- The image input is terminal-friendly rather than native desktop drag-and-drop.
- You can drag an image file into the terminal and most shells will paste its path into the input field.
- If mDNS discovery fails, enter the host and port manually and refresh health.
- `uv` will install the script dependencies declared at the top of `toriTest.py`.
