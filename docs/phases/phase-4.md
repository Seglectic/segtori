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

### Service Frontend

- [x] Move the scan-job gallery from `/` to `/log`.
- [x] Serve a primary inventory console at `/`.
- [x] Render the same inventory console against Airtable and local backends.
- [x] Hide quantity controls when the active backend is read-only.
- [ ] Support quantity increment and decrement controls when the active backend is writable.
- [ ] Prompt for one-time Airtable migration when local mode is empty and Airtable data is available.

### Exit Criteria

- [ ] Airtable and local modes satisfy the same scan and quantity contract.
- [ ] Switching inventory backends requires no firmware changes.
- [ ] Local inventory persists across service restarts.
- [ ] Imported inventory works with the Phase 2 matching layer.
- [ ] The root inventory console works against both backends without changing its UI contract.
- [ ] The scan-job log remains available at `/log` for diagnostics.

## Goals

- Support Airtable and local inventory behind the same server API.
- Keep the ESP32 unaware of which backend is active.
- Make local inventory portable and easy to back up.
- Make the service homepage a practical inventory console instead of a diagnostics-first landing page.

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

The service frontend should expose:

- `GET /`: a custom inventory console for browsing active inventory.
- `GET /log`: the existing scan-job diagnostics gallery.
- The same inventory layout for Airtable and local backends.
- Quantity adjustment controls only when the active backend supports writes.
- Read-only inventory browsing when Airtable or another backend is configured without write support.
- A migration prompt when local mode is empty, Airtable credentials are valid,
  and Airtable inventory can be read.

Additional endpoints for local inventory support:

- `GET /api/items`: lists inventory items.
- `POST /api/items`: creates a local inventory item.
- `POST /api/import`: imports local inventory data.
- `POST /api/items/import-airtable`: performs a one-time Airtable-to-local import
  after explicit operator confirmation.

Migration behavior should stay explicit and conservative:

- Only offer Airtable migration when `INVENTORY_BACKEND=local`.
- Only offer it when the local SQLite database contains zero items.
- Only offer it when Airtable credentials are valid and reads succeed.
- Never run migration automatically during service startup.
- Import through a transaction and report created, skipped, and failed records.

## Acceptance Criteria

- Airtable mode and local mode both satisfy the Phase 1 scan and quantity API contract.
- Switching backends does not require firmware changes.
- Local inventory data persists across server restarts.
- Import data can be matched by the same Phase 2 matching layer.
- The root inventory console remains backend-agnostic and exposes controls according to backend capabilities.
- Scan-job diagnostics stay available under `/log`.
- Airtable migration requires an explicit operator action and does not run automatically.
