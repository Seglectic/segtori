// ╭──────────────────────────────╮
// │  Display Backend Contract    │
// │  Defines the panel-specific  │
// │  SPI and JPEG render hooks.  │
// ╰──────────────────────────────╯

#pragma once

#include <Arduino.h>

#include "app_state.h"

namespace tori::display_backend {

bool begin();
void renderState(ScreenState screen, const String& status);
bool renderJpeg(const uint8_t* data, size_t length, uint16_t width, uint16_t height);

}  // namespace tori::display_backend
