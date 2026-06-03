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

struct DeviceState {
  ScreenState screen = ScreenState::kBoot;
  String serverHost;
  uint16_t serverPort = 8674;
  MatchSummary latestMatch;
  String latestOcrText;
  int editableQuantity = 0;
  String lastStatus;
};

}  // namespace tori
