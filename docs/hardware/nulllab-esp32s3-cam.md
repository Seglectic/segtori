# nulllab ESP32-S3-CAM Hardware Reference

The primary Phase 1 development board is the
[nulllab ESP32-S3-CAM](https://github.com/nulllaborg/esp32s3-cam).
The upstream repository remains the source of truth for the complete
[schematic](https://github.com/nulllaborg/esp32s3-cam/blob/main/esp32s3_cam_sch.pdf).
This document records the board details that directly affect Segtori.

## Board Configuration

- SoC: ESP32-S3R8, dual-core up to 240 MHz
- Flash: 8 MB
- PSRAM: 8 MB octal PSRAM
- Camera used for current development: OV3660
- Camera support listed upstream: OV3660 and OV2640
- Programming and serial monitoring: native USB-C USB Serial/JTAG
- PlatformIO environment: `nulllab_esp32s3_cam`

## Segtori-Relevant Pins

| Function | GPIO | Notes |
| --- | ---: | --- |
| Boot / current snap button | 0 | Active-low; holding during reset enters download mode |
| Double white camera flashlight | 3 | Active-high; Segtori drives it low at boot |
| Camera SCCB SDA | 4 | Camera control bus |
| Camera SCCB SCL | 5 | Camera control bus |
| Camera VSYNC | 6 | Camera interface |
| Camera HREF | 7 | Camera interface |
| Camera Y4 | 8 | Camera interface |
| Camera Y3 | 9 | Camera interface |
| Camera Y5 | 10 | Camera interface |
| Camera Y2 | 11 | Camera interface |
| Camera Y6 | 12 | Camera interface |
| Camera PCLK | 13 | Camera interface |
| Camera XCLK | 15 | Camera interface |
| Camera Y9 | 16 | Camera interface |
| Camera Y8 | 17 | Camera interface |
| Camera Y7 | 18 | Camera interface |
| USB D- | 19 | Reserved for native USB |
| USB D+ | 20 | Reserved for native USB |
| TF card CMD / MOSI | 38 | Card interface |
| TF card CLK | 39 | Card interface |
| TF card DAT0 / MISO | 40 | Card interface |

## Double White Flashlight

The two white LEDs beside the camera are the onboard camera flashlight. The
schematic shows GPIO3 driving both SS8050 transistor bases through a shared
10 kΩ resistor. Each transistor switches one LED, with the LED supplied from
3.3 V through its own 2 kΩ resistor.

The flashlight is active-high, controlled as a pair, and can appear dim or
flicker if GPIO3 is left unconfigured. Segtori configures GPIO3 for PWM and
holds it off immediately at boot.

When a snap is accepted, the firmware turns the flashlight fully on before
camera initialization and exposure warm-up. It remains on through the final
capture, then fades out over roughly 200 ms before image upload begins. Error
paths also fade the flashlight out so it cannot remain stuck on.

## Other Onboard LEDs

- A yellow/green charge-status LED is connected to the battery charger IC. It
  is not controlled by ESP32 firmware.
- A separate yellow/green extension-interface LED is connected to GPIO2. It is
  not currently used by Segtori.

## Power Notes

The board includes USB-C power, a PH2.0 battery connector, charging circuitry,
and onboard regulators. The camera and ESP32 can normally become warm during
operation, but a board that becomes too hot to comfortably touch should be
disconnected and inspected.

Segtori reduces idle load by shutting down the camera and lowering CPU
frequency between snaps. During capture, the CPU returns to full speed to
support reliable maximum-resolution camera DMA.

## Firmware Ownership

Board pin assignments live in
[`firmware/include/camera_pins.h`](../../firmware/include/camera_pins.h).
Keep that file and this reference aligned when adding peripherals or changing
board behavior.
