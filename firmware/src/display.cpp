// ╭──────────────────────────────╮
// │  Handheld Display            │
// │  Schedules preview frames and│
// │  provides a disabled backend.│
// ╰──────────────────────────────╯

#include "display.h"

#include "display_backend.h"

namespace tori {

constexpr uint32_t kPreviewFrameIntervalMs = 100;

bool HandheldDisplay::begin() {
  ready_ = display_backend::begin();
  Serial.printf("[display] backend %s\n", ready_ ? "ready" : "disabled");
  return ready_;
}

void HandheldDisplay::renderState(ScreenState screen, const String& status) {
  if (ready_) {
    display_backend::renderState(screen, status);
  }
}

bool HandheldDisplay::renderPreview(const camera_fb_t* frame) {
  if (!ready_ || !frame || frame->format != PIXFORMAT_JPEG) {
    return false;
  }

  const uint32_t now = millis();
  if (now - lastPreviewAtMs_ < kPreviewFrameIntervalMs) {
    return false;
  }

  lastPreviewAtMs_ = now;
  return display_backend::renderJpeg(frame->buf, frame->len, frame->width, frame->height);
}

bool HandheldDisplay::ready() const {
  return ready_;
}

}  // namespace tori

namespace tori::display_backend {

// Replace these weak hooks with the selected panel controller's SPI/JPEG driver.
bool __attribute__((weak)) begin() {
  return false;
}

void __attribute__((weak)) renderState(ScreenState, const String&) {}

bool __attribute__((weak)) renderJpeg(const uint8_t*, size_t, uint16_t, uint16_t) {
  return false;
}

}  // namespace tori::display_backend
