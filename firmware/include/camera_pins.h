// ╭──────────────────────────────╮
// │  Camera Pins                 │
// │  Selects the camera wiring   │
// │  for each supported board.   │
// ╰──────────────────────────────╯

#pragma once

namespace tori {

#if defined(SEGTORI_CAMERA_NULLLAB_ESP32S3)

constexpr int kCameraPinPwdn = -1;
constexpr int kCameraPinReset = -1;
constexpr int kCameraPinXclk = 15;
constexpr int kCameraPinSiod = 4;
constexpr int kCameraPinSioc = 5;
constexpr int kCameraPinY9 = 16;
constexpr int kCameraPinY8 = 17;
constexpr int kCameraPinY7 = 18;
constexpr int kCameraPinY6 = 12;
constexpr int kCameraPinY5 = 10;
constexpr int kCameraPinY4 = 8;
constexpr int kCameraPinY3 = 9;
constexpr int kCameraPinY2 = 11;
constexpr int kCameraPinVsync = 6;
constexpr int kCameraPinHref = 7;
constexpr int kCameraPinPclk = 13;
constexpr int kCameraFlashPin = 3;
constexpr int kSnapButtonPin = 0;

#elif defined(SEGTORI_CAMERA_AI_THINKER)

constexpr int kCameraPinPwdn = 32;
constexpr int kCameraPinReset = -1;
constexpr int kCameraPinXclk = 0;
constexpr int kCameraPinSiod = 26;
constexpr int kCameraPinSioc = 27;
constexpr int kCameraPinY9 = 35;
constexpr int kCameraPinY8 = 34;
constexpr int kCameraPinY7 = 39;
constexpr int kCameraPinY6 = 36;
constexpr int kCameraPinY5 = 21;
constexpr int kCameraPinY4 = 19;
constexpr int kCameraPinY3 = 18;
constexpr int kCameraPinY2 = 5;
constexpr int kCameraPinVsync = 25;
constexpr int kCameraPinHref = 23;
constexpr int kCameraPinPclk = 22;
constexpr int kCameraFlashPin = 4;
constexpr int kSnapButtonPin = -1;

#else
#error "Select a supported Segtori camera board in platformio.ini"
#endif

}  // namespace tori
