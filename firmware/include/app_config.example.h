// ╭──────────────────────────────╮
// │  App Config Example          │
// │  Declares development-time   │
// │  Wi-Fi and fallback server   │
// │  settings for local builds.  │
// ╰──────────────────────────────╯

#pragma once

namespace tori {

struct AppConfig {
  const char* wifiSsid;
  const char* wifiPassword;
  const char* mdnsHostName;
  const char* mdnsServiceName;
  const char* fallbackHost;
  uint16_t fallbackPort;
  uint32_t wifiConnectTimeoutMs;
  uint32_t requestTimeoutMs;
};

constexpr AppConfig kAppConfig{
    "replace-me",
    "replace-me",
    "tori-device",
    "tori-ocr",
    "tori-ocr.local",
    8020,
    15000,
    15000,
};

}  // namespace tori
