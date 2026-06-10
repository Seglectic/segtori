// ╭──────────────────────────────╮
// │  Handheld Display            │
// │  Routes device states and    │
// │  camera previews to a panel. │
// ╰──────────────────────────────╯

#pragma once

#include <Arduino.h>
#include <esp_camera.h>

#include "app_state.h"

namespace tori {

class HandheldDisplay {
 public:
  bool begin();
  void renderState(ScreenState screen, const String& status);
  bool renderPreview(const camera_fb_t* frame);
  bool ready() const;

 private:
  bool ready_ = false;
  uint32_t lastPreviewAtMs_ = 0;
};

}  // namespace tori
