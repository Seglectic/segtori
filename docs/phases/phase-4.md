# Phase 4: Local Inventory Backend

Phase 4 adds a local inventory option for home or offline use while preserving the firmware API.

## Progress Checklist

### Backend

- [x] Establish a stable firmware-facing scan and quantity API.
- [x] Implement the Airtable inventory backend.
- [ ] Add `INVENTORY_BACKEND` selection.
- [ ] Add a SQLite local inventory backend.
- [ ] List and create local inventory items through the API.
- [ ] Import local inventory from CSV or JSON.
- [ ] Export local inventory to CSV or JSON.

### Exit Criteria

- [ ] Airtable and local modes satisfy the same scan and quantity contract.
- [ ] Switching inventory backends requires no firmware changes.
- [ ] Local inventory persists across service restarts.
- [ ] Imported inventory works with the Phase 2 matching layer.

## Goals

- Support Airtable and local inventory behind the same server API.
- Keep the ESP32 unaware of which backend is active.
- Make local inventory portable and easy to back up.

## Server Behavior

The server should add backend selection:

- `INVENTORY_BACKEND=airtable|local`
- `LOCAL_DB_PATH`: SQLite database path for local mode.

Local mode should use SQLite by default and support:

- Item list browsing through the API.
- Item creation through the API.
- Quantity updates through the existing quantity endpoint.
- CSV or JSON import.
- CSV or JSON export.

Additional endpoints for local inventory support:

- `GET /api/items`: lists inventory items.
- `POST /api/items`: creates a local inventory item.
- `POST /api/import`: imports local inventory data.

## Acceptance Criteria

- Airtable mode and local mode both satisfy the Phase 1 scan and quantity API contract.
- Switching backends does not require firmware changes.
- Local inventory data persists across server restarts.
- Import data can be matched by the same Phase 2 matching layer.
