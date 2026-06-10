// ╭──────────────────────────────╮
// │  App State                   │
// │  Defines compact UI and scan │
// │  state used by the handheld  │
// │  firmware scaffold.          │
// ╰──────────────────────────────╯

#pragma once

#include <Arduino.h>

namespace tori {

enum class ScreenState {
  kBoot,
  kConnectingWifi,
  kDiscoveringService,
  kReady,
  kCapturing,
  kUploading,
  kShowingMatch,
  kEditingQuantity,
  kSubmittingQuantity,
  kError,
};

struct MatchSummary {
  String id;
  String name;
  int quantity = 0;
  float score = 0.0F;
};

struct ScanTimings {
  uint32_t roundTripMs = 0;
  uint32_t captureMs = 0;
  uint32_t uploadAndServerMs = 0;
  uint32_t serverTotalMs = 0;
  uint32_t serverUploadIngestMs = 0;
  uint32_t serverJobPersistMs = 0;
  uint32_t serverOcrMs = 0;
  uint32_t serverInventoryMs = 0;
  uint32_t serverMatchingMs = 0;
};

struct DeviceState {
  ScreenState screen = ScreenState::kBoot;
  String serverHost;
  uint16_t serverPort = 8674;
  MatchSummary latestMatch;
  ScanTimings latestTimings;
  String latestOcrText;
  int editableQuantity = 0;
  String lastStatus;
};

}  // namespace tori
