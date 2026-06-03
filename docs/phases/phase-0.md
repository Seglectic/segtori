# Phase 0: Project Scaffolding

Phase 0 establishes the repository shape and project contracts before feature work starts.

## Goals

- Keep firmware and service work separate but coordinated.
- Document the minimum APIs and configuration needed for Phase 1.
- Make the repo ready for incremental firmware, server, and Docker implementation.

## Repository Shape

- `firmware/`: ESP32 firmware project root.
- `service/`: Node.js server and Docker project root.
- `docs/`: product, architecture, phase, and design documentation.

## Firmware Scaffolding

The `firmware/` project should be initialized as a PlatformIO Arduino project for ESP32-CAM hardware. It should include placeholders for:

- Camera setup and capture.
- Wi-Fi configuration.
- mDNS service discovery.
- HTTP client upload/update calls.
- Button and D-pad input handling.
- Display rendering.
- Local device state for scan results and quantity editing.

## Service Scaffolding

The `service/` project should be initialized as a Node.js service. It should include placeholders for:

- Express HTTP server.
- Image upload handling.
- Tesseract OCR command execution.
- Airtable API client.
- Inventory matching.
- Quantity update endpoint.
- mDNS advertisement.
- Dockerfile and container runtime configuration.

## Configuration Defaults

The server should read configuration from environment variables:

- `PORT`: HTTP server port, default `8020`.
- `AIRTABLE_API_TOKEN`: Airtable API token.
- `AIRTABLE_BASE_ID`: Airtable base ID.
- `AIRTABLE_TABLE_NAME`: Airtable table name.
- `AIRTABLE_ITEM_ID_FIELD`: field used as the stable item identifier.
- `AIRTABLE_ITEM_NAME_FIELD`: field used for matching OCR text.
- `AIRTABLE_QUANTITY_FIELD`: field updated by the device.
- `TORI_MDNS_NAME`: advertised device/service name, default `tori-ocr`.

The firmware should eventually support Wi-Fi and server settings through a development-time config file that is not committed with secrets.

