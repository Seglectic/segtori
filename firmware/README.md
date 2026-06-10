# Firmware

The current firmware is an early ESP32-CAM testing scaffold that captures images with the onboard camera and relays scans to the Segtori service. The default hardware target is the nulllab ESP32-S3-CAM.

## Supported Boards

- `nulllab_esp32s3_cam` (default): [nulllab ESP32-S3-CAM](https://github.com/nulllaborg/esp32s3-cam), with 8 MB flash, 8 MB octal PSRAM, and native USB CDC/JTAG
- `ai_thinker_esp32cam`: legacy AI Thinker ESP32-CAM target

Build the default target from this directory with:

```bash
pio run
```

Build a specific target with:

```bash
pio run -e nulllab_esp32s3_cam
pio run -e ai_thinker_esp32cam
```

PlatformIO discovers the connected upload and monitor port automatically. The nulllab board normally appears as an Espressif USB JTAG/serial debug unit.

## Serial Console

Open the serial console at `115200` baud:

```bash
pio device monitor
```

The console accepts line-oriented commands:

- `help` shows available commands
- `status` prints the current device state as JSON
- `health` checks the Segtori service
- `discover` retries service discovery
- `preview` starts the camera, warms exposure, and pumps preview frames
- `preview-off` shuts down the camera without scanning
- `snap` captures from the warmed camera when preview is active, otherwise
  starts and warms the camera before capture

On the nulllab ESP32-S3-CAM, pressing the onboard Boot button after startup also triggers a snap. Holding Boot during reset still selects the chip's download mode.

The board's double white camera flashlight is connected to GPIO3. The firmware
drives it low immediately at boot because leaving the pin unconfigured can
cause the LEDs to glow dimly or flicker. See the
[board hardware reference](../docs/hardware/nulllab-esp32s3-cam.md) for
relevant schematic details and pin assignments.

When a snap starts, the flashlight turns on at full brightness, remains on
through capture, and quickly fades out before upload. Preview does not hold the
flashlight on.

This is not yet the final handheld UX described in the broader project docs. Right now, the firmware is best understood as:

- a Wi-Fi + mDNS client
- a thin relay to the Segtori OCR service
- a serial and physical-button capture interface

## What It Currently Owns

- camera initialization for the supported OV2640/OV3660 boards
- half-linear-resolution JPEG capture for the current latency trial: 800×600 on
  OV2640 and 1024×768 on OV3660
- Wi-Fi connection and retry behavior
- mDNS startup and Segtori service discovery
- periodic health checks against the Segtori service
- image capture and multipart upload to `POST /api/scan`
- local status tracking for debugging the current flow
- per-snap camera initialization and shutdown to reduce idle power and stale frames
- a preview lifecycle that keeps the camera and exposure warm until snap
- a controller-agnostic handheld display facade for preview and state rendering

## Handheld Display Framework

The camera preview loop now passes throttled JPEG frames to `HandheldDisplay`.
The default backend is intentionally disabled until a panel controller and
wiring are selected. A panel implementation replaces the weak hooks in
`include/display_backend.h`:

- `begin()` configures the display controller and SPI bus.
- `renderJpeg()` decodes preview JPEGs in small RGB565 blocks and pushes them
  directly to the panel.
- `renderState()` draws compact boot, network, upload, result, and error states.

Preview is capped at 10 FPS and naturally pauses while the blocking final
capture and upload path runs. The backend should avoid retaining a full display
framebuffer; block or scanline JPEG decode keeps memory and copy overhead low.
The final still remains JPEG in PSRAM for upload.

## Current Firmware State Model

The firmware reports compact screen states from `ScreenState` in [include/app_state.h](./include/app_state.h):

- `Boot`
- `Wi-Fi`
- `Discovery`
- `Ready`
- `Capture`
- `Upload`
- `Match`
- `Edit`
- `Update`
- `Error`

In the current scaffold, the states most actively exercised are:

- `Boot`
- `Wi-Fi`
- `Discovery`
- `Ready`
- `Capture`
- `Upload`
- `Match`
- `Error`

`Edit` and `Update` exist in the shared state model but are not yet part of the active firmware flow in `main.cpp`.

## Current Debug Flow

This chart reflects the code path in [src/main.cpp](./src/main.cpp) as it exists now.

```mermaid
flowchart TD
    subgraph FW[ESP32 Firmware]
        A[setup starts]
        B[Set state to Boot]
        C[Validate camera, then shut it down]
        D[Connect to Wi-Fi]
        E[Start mDNS responder]
        F[Discover Segtori service]
        G[Health check /api/health]
        H[Set state to Ready]
        I[loop polls serial, Boot button,<br/>and network state]
        J[User enters snap or presses Boot]
        K[Validate Wi-Fi and service availability]
        L[Set state to Capture]
        M[Run CPU at capture speed]
        N[Initialize camera and warm exposure]
        O[Discard stale frames]
        P[Capture maximum-resolution JPEG]
        Q[Set state to Upload]
        R[Send multipart POST /api/scan to Segtori service]
        S[Return frame buffer and shut down camera]
        T[Return CPU to idle speed]
        U[Parse scanId, ocrText, match.id, match.name,<br/>match.quantity, match.score]
        V[Set state to Match or Error]
    end

    subgraph SRV[Segtori Service]
        W[Receive image at /api/scan]
        X[Persist scan job and image]
        Y[Run OCR]
        Z[Rank inventory matches]
        AA[Persist result or failure diagnostics]
        AB[Return JSON scan response]
        AC[Answer periodic /api/health checks]
    end

    A --> B --> C --> D --> E --> F --> G --> H --> I
    I --> F
    I --> G
    I --> J --> K
    K -->|ready| L --> M --> N --> O --> P --> Q --> R --> W --> X --> Y --> Z --> AA --> AB --> S --> T --> U --> V
    K -->|Wi-Fi or service unavailable| V
    G --> AC

    classDef firmware fill:#d8f0ff,stroke:#1f6f8b,stroke-width:2px,color:#0f2f3a;
    classDef service fill:#e8f5d6,stroke:#5c8a2d,stroke-width:2px,color:#233612;
    class A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V firmware;
    class W,X,Y,Z,AA,AB,AC service;
```

## Actual Request Flow Today

The ESP32 is an HTTP client only. It uploads captured JPEGs directly to the
Segtori service's `POST /api/scan` endpoint and periodically checks
`GET /api/health`. It does not host a web server.

The service hosts the browser-facing development dashboard. That dashboard
reads persisted jobs from `service/process/`; it does not trigger the camera.

For reliable captures, the nulllab target initializes the camera for preview or
a cold snap, warms automatic exposure at low resolution, discards stale
frames, captures the final frame, and shuts the camera down after upload. The
current latency trial captures at half the sensor's maximum width and height.
The CPU runs at full speed while the camera is active and at a reduced speed
while idle.

The future display/control flow can call the same lifecycle used by the serial
`preview` command while the operator holds a preview button. Preview frames are
currently consumed and discarded where a display renderer will later receive
them. A simultaneous snap captures from the warmed session and uploads it.
Because the JPEG remains in the camera-owned framebuffer during upload, the
camera shuts down immediately after upload returns that buffer rather than
between capture and upload.

## Current Retry And Recovery Behavior

The firmware continuously re-checks network state from `loop()`:

- Wi-Fi reconnect attempts every `12s`
- service rediscovery every `15s`
- service health checks every `15s`

If Wi-Fi is unavailable:

- the device state becomes `Error`
- the IP displays as `offline`
- scans are rejected

If service discovery fails:

- the firmware falls back to `fallbackHost` and `fallbackPort` from `app_config.h`
- later discovery attempts continue in the background

If the Segtori service is not healthy:

- scans are rejected with `service unavailable`
- the state moves to `Error` or back to `Discovery`/waiting behavior depending on timing

## Data The Firmware Extracts From The Server

After a successful scan upload, the firmware currently parses:

- `scanId`
- `ocrText`
- `match.id`
- `match.name`
- `match.quantity`
- `match.score`

It does not currently parse or render the full candidate list from the server response.

## Important Caveats

- This firmware currently uses the serial console and Boot button rather than the final dedicated controls and display.
- JSON parsing is intentionally minimal and string-based for now.
- The scan path depends on the server already being reachable and healthy.
- Service discovery is mDNS-first, with a configured fallback host.
- The quantity-edit flow is not yet active in this firmware even though related states exist.
- The service may persist a scan image and OCR diagnostics even when the final
  request fails because Airtable is unavailable or misconfigured.

## Files To Read While Debugging

- [src/main.cpp](./src/main.cpp) current boot, network, serial/button snap, and scan relay flow
- [include/app_state.h](./include/app_state.h) firmware state model
- [include/app_config.example.h](./include/app_config.example.h) Wi-Fi, mDNS, and fallback config shape
- [include/display.h](./include/display.h) controller-independent handheld display facade
- [include/display_backend.h](./include/display_backend.h) panel-specific SPI/JPEG backend contract
