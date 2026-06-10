// ╭──────────────────────────────╮
// │  Segtori Camera Client       │
// │  Captures fresh still images │
// │  and sends them to Segtori.  │
// ╰──────────────────────────────╯

#include <Arduino.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <esp_camera.h>
#include <esp_log.h>

#if __has_include("app_config.h")
#include "app_config.h"
#else
#include "app_config.example.h"
#endif
#include "app_state.h"
#include "camera_pins.h"

namespace tori {

constexpr uint32_t kWifiRetryIntervalMs = 12000;
constexpr uint32_t kDiscoveryRetryIntervalMs = 15000;
constexpr uint32_t kHealthCheckIntervalMs = 15000;
constexpr uint16_t kFastRequestTimeoutMs = 2500;
constexpr size_t kUploadChunkSize = 1460;
constexpr uint32_t kButtonDebounceMs = 50;
constexpr uint8_t kCameraFlashLedcChannel = 7;
constexpr uint16_t kCameraFlashPwmFrequencyHz = 5000;
constexpr uint8_t kCameraFlashPwmResolutionBits = 8;
constexpr uint8_t kCameraFlashFadeSteps = 32;
constexpr uint8_t kCameraFlashFadeStepDelayMs = 6;

DeviceState gState{};
bool gCameraReady = false;
bool gWifiReady = false;
bool gMdnsReady = false;
bool gServiceReachable = false;
bool gServiceFromDiscovery = false;
framesize_t gCameraFrameSize = FRAMESIZE_UXGA;
String gLastScanId;
String gLastError;
String gIpAddress = "offline";
unsigned long gLastWifiAttemptMs = 0;
unsigned long gLastDiscoveryMs = 0;
unsigned long gLastHealthCheckMs = 0;
String gSerialCommand;
bool gSnapButtonPressed = false;
unsigned long gSnapButtonChangedMs = 0;

const char kPageHtml[] PROGMEM = R"HTML(
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Segtori Console</title>
  <style>
    :root{--bg:#0c1113;--panel:#12191d;--line:#273238;--text:#edf4ef;--muted:#96a6a0;--accent:#d4ff67;--warn:#ffb36b;--bad:#ff8d8d}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at top,rgba(212,255,103,.12),transparent 24%),linear-gradient(180deg,#0b0f12,#10171a 60%,#0b1012);color:var(--text);font-family:"IBM Plex Mono","Menlo",monospace}
    main{width:min(92vw,680px);padding:22px;background:rgba(18,25,29,.96);border:1px solid var(--line);box-shadow:0 24px 64px rgba(0,0,0,.45)}
    .top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:20px}
    .eyebrow,.label,.foot{font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
    h1{margin:6px 0 0;font:600 clamp(1.9rem,4vw,2.7rem)/.95 "Arial Narrow","Eurostile",sans-serif;letter-spacing:.08em;text-transform:uppercase}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .card{padding:14px;border:1px solid var(--line);background:rgba(12,17,19,.65)}
    .value{margin-top:10px;font-size:1rem;line-height:1.35;word-break:break-word}
    .hero{font:600 1.8rem/.95 "Arial Narrow","Eurostile",sans-serif;letter-spacing:.04em;text-transform:uppercase}
    .pill{display:inline-flex;gap:8px;align-items:center;padding:8px 12px;border:1px solid rgba(212,255,103,.22);background:rgba(212,255,103,.08);color:var(--accent)}
    .pill.warn{color:var(--warn);border-color:rgba(255,179,107,.26);background:rgba(255,179,107,.1)}
    .pill.bad{color:var(--bad);border-color:rgba(255,141,141,.26);background:rgba(255,141,141,.1)}
    .dot{width:8px;height:8px;border-radius:999px;background:currentColor;box-shadow:0 0 14px currentColor}
    .actions{display:flex;gap:16px;align-items:center;justify-content:space-between;margin:18px 0}
    button{appearance:none;border:0;padding:14px 18px;min-width:220px;background:linear-gradient(135deg,#d4ff67,#9bd04f);color:#11161a;font:600 1rem "Arial Narrow","Eurostile",sans-serif;letter-spacing:.12em;text-transform:uppercase;cursor:pointer}
    button:disabled{opacity:.6;cursor:wait}
    .result{margin-top:12px}
    @media (max-width:720px){.top,.actions{flex-direction:column;align-items:stretch}.grid{grid-template-columns:1fr}button{min-width:0;width:100%}}
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <div class="eyebrow">Seglectic Tagged Object Recognition Interface</div>
        <h1>Scan Console</h1>
      </div>
      <div class="foot" id="ip">offline</div>
    </div>
    <section class="grid">
      <div class="card"><div class="label">State</div><div class="value hero" id="screen">Boot</div></div>
      <div class="card"><div class="label">Service</div><div class="value" id="target">unresolved</div></div>
      <div class="card"><div class="label">Link</div><div class="value"><span class="pill" id="pill"><span class="dot"></span><span id="pillText">checking</span></span></div></div>
      <div class="card"><div class="label">Scan ID</div><div class="value" id="scanId">none</div></div>
    </section>
    <div class="actions">
      <button id="scan">Capture + Send</button>
      <div class="foot" id="status">Waiting for first status refresh</div>
    </div>
    <section class="grid result">
      <div class="card"><div class="label">Match</div><div class="value hero" id="matchName">No scan</div><div class="value" id="matchMeta">Waiting for capture.</div></div>
      <div class="card"><div class="label">OCR</div><div class="value" id="ocr">---</div></div>
      <div class="card"><div class="label">Quantity</div><div class="value hero" id="qty">--</div></div>
      <div class="card"><div class="label">Confidence</div><div class="value" id="score">--</div></div>
    </section>
    <section class="grid result">
      <div class="card"><div class="label">Operator Roundtrip</div><div class="value hero" id="roundTrip">--</div></div>
      <div class="card"><div class="label">Capture</div><div class="value" id="captureTime">--</div></div>
      <div class="card"><div class="label">Upload + Server</div><div class="value" id="uploadTime">--</div></div>
      <div class="card"><div class="label">Network + Response</div><div class="value" id="networkTime">--</div></div>
      <div class="card"><div class="label">Server Processing</div><div class="value" id="serverTime">--</div></div>
      <div class="card"><div class="label">Server Stages</div><div class="value" id="serverStages">--</div></div>
      <div class="card"><div class="label">Browser Request</div><div class="value" id="browserTime">--</div></div>
    </section>
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const scanButton = $("scan");
    const formatMs = (value) => Number.isFinite(value) && value > 0
      ? (value >= 1000 ? `${(value / 1000).toFixed(2)} s` : `${value} ms`)
      : "--";

    function setPill(ok, wifi) {
      const pill = $("pill");
      pill.className = "pill";
      $("pillText").textContent = ok ? "service reachable" : (wifi ? "service offline" : "wifi offline");
      if (!ok && wifi) pill.classList.add("warn");
      if (!wifi) pill.classList.add("bad");
    }

    function render(data) {
      $("ip").textContent = data.ipAddress || "offline";
      $("screen").textContent = data.screen || "Unknown";
      $("target").textContent = data.serviceTarget || "unresolved";
      $("scanId").textContent = data.lastScanId || "none";
      $("status").textContent = data.lastError || data.lastStatus || "Idle";
      setPill(Boolean(data.serviceReachable), Boolean(data.wifiReady));

      if (data.match && data.match.name) {
        $("matchName").textContent = data.match.name;
        $("matchMeta").textContent = data.match.id ? `ID ${data.match.id}` : "Match returned";
        $("qty").textContent = Number.isFinite(data.match.quantity) ? String(data.match.quantity) : "--";
        $("score").textContent = Number.isFinite(data.match.score) ? `${Math.round(data.match.score * 100)}%` : "--";
      } else {
        $("matchName").textContent = "No match";
        $("matchMeta").textContent = "Waiting for capture.";
        $("qty").textContent = "--";
        $("score").textContent = "--";
      }

      $("ocr").textContent = data.ocrText || "---";
      const timings = data.timings || {};
      $("roundTrip").textContent = formatMs(timings.roundTripMs);
      $("captureTime").textContent = formatMs(timings.captureMs);
      $("uploadTime").textContent = formatMs(timings.uploadAndServerMs);
      $("networkTime").textContent = formatMs(
        Math.max(0, (timings.uploadAndServerMs || 0) - (timings.serverTotalMs || 0))
      );
      $("serverTime").textContent = formatMs(timings.serverTotalMs);
      $("serverStages").textContent =
        `ingest ${formatMs(timings.serverUploadIngestMs)} · persist ${formatMs(timings.serverJobPersistMs)} · OCR ${formatMs(timings.serverOcrMs)} · inventory ${formatMs(timings.serverInventoryMs)} · match ${formatMs(timings.serverMatchingMs)}`;
    }

    async function refresh() {
      const response = await fetch("/api/status", { cache: "no-store" });
      render(await response.json());
    }

    async function runScan() {
      scanButton.disabled = true;
      $("status").textContent = "Capturing image";
      const startedAt = performance.now();
      try {
        const response = await fetch("/api/scan", { method: "POST" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "scan failed");
        }
        await refresh();
        const browserMs = Math.round(performance.now() - startedAt);
        $("browserTime").textContent = formatMs(browserMs);
        $("status").textContent = `Scan complete in ${formatMs(browserMs)}`;
      } catch (error) {
        $("status").textContent = error.message;
      } finally {
        scanButton.disabled = false;
      }
    }

    scanButton.addEventListener("click", runScan);
    refresh().catch(() => {});
    setInterval(() => refresh().catch(() => {}), 6000);
  </script>
</body>
</html>
)HTML";

const char* screenStateName(ScreenState screen);

void setStatus(ScreenState screen, const String& status) {
  const bool changed = gState.screen != screen || gState.lastStatus != status;
  gState.screen = screen;
  gState.lastStatus = status;

  if (changed) {
    Serial.printf("[state] %s: %s\n", screenStateName(screen), status.c_str());
  }
}

const char* screenStateName(ScreenState screen) {
  switch (screen) {
    case ScreenState::kBoot:
      return "Boot";
    case ScreenState::kConnectingWifi:
      return "Wi-Fi";
    case ScreenState::kDiscoveringService:
      return "Discovery";
    case ScreenState::kReady:
      return "Ready";
    case ScreenState::kCapturing:
      return "Capture";
    case ScreenState::kUploading:
      return "Upload";
    case ScreenState::kShowingMatch:
      return "Match";
    case ScreenState::kEditingQuantity:
      return "Edit";
    case ScreenState::kSubmittingQuantity:
      return "Update";
    case ScreenState::kError:
      return "Error";
  }

  return "Unknown";
}

String jsonEscape(const String& value) {
  String escaped;
  escaped.reserve(value.length() + 8);

  for (size_t index = 0; index < value.length(); ++index) {
    const char current = value[index];
    if (current == '\\' || current == '"') {
      escaped += '\\';
      escaped += current;
    } else if (current == '\n') {
      escaped += "\\n";
    } else if (current == '\r') {
      escaped += "\\r";
    } else {
      escaped += current;
    }
  }

  return escaped;
}

String extractJsonString(const String& json, const String& key) {
  const int keyIndex = json.indexOf("\"" + key + "\"");
  if (keyIndex < 0) {
    return "";
  }

  const int colonIndex = json.indexOf(':', keyIndex);
  const int startQuote = json.indexOf('"', colonIndex + 1);
  if (colonIndex < 0 || startQuote < 0) {
    return "";
  }

  String value;
  bool escaped = false;
  for (int index = startQuote + 1; index < json.length(); ++index) {
    const char current = json[index];
    if (escaped) {
      value += current;
      escaped = false;
      continue;
    }
    if (current == '\\') {
      escaped = true;
      continue;
    }
    if (current == '"') {
      break;
    }
    value += current;
  }

  value.replace("\\n", " ");
  value.replace("\\r", " ");
  return value;
}

String extractJsonObject(const String& json, const String& key) {
  const int keyIndex = json.indexOf("\"" + key + "\"");
  if (keyIndex < 0) {
    return "";
  }

  const int objectStart = json.indexOf('{', keyIndex);
  if (objectStart < 0) {
    return "";
  }

  int depth = 0;
  bool inString = false;
  bool escaped = false;
  for (int index = objectStart; index < json.length(); ++index) {
    const char current = json[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (current == '\\') {
      escaped = inString;
      continue;
    }
    if (current == '"') {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (current == '{') {
      depth += 1;
    } else if (current == '}') {
      depth -= 1;
      if (depth == 0) {
        return json.substring(objectStart, index + 1);
      }
    }
  }

  return "";
}

int extractJsonInt(const String& json, const String& key, int fallbackValue) {
  const int keyIndex = json.indexOf("\"" + key + "\"");
  if (keyIndex < 0) {
    return fallbackValue;
  }

  const int colonIndex = json.indexOf(':', keyIndex);
  int start = colonIndex + 1;
  while (start < json.length() && (json[start] == ' ' || json[start] == '\n')) {
    start += 1;
  }

  int end = start;
  while (end < json.length() && (json[end] == '-' || isDigit(json[end]))) {
    end += 1;
  }

  return json.substring(start, end).toInt();
}

float extractJsonFloat(const String& json, const String& key, float fallbackValue) {
  const int keyIndex = json.indexOf("\"" + key + "\"");
  if (keyIndex < 0) {
    return fallbackValue;
  }

  const int colonIndex = json.indexOf(':', keyIndex);
  int start = colonIndex + 1;
  while (start < json.length() && (json[start] == ' ' || json[start] == '\n')) {
    start += 1;
  }

  int end = start;
  while (end < json.length() &&
         (json[end] == '-' || json[end] == '.' || isDigit(json[end]))) {
    end += 1;
  }

  return json.substring(start, end).toFloat();
}

void clearMatch() {
  gLastScanId = "";
  gState.latestOcrText = "";
  gState.latestMatch = MatchSummary{};
  gState.latestTimings = ScanTimings{};
}

void applyScanResponse(const String& body) {
  const String matchObject = extractJsonObject(body, "match");
  gLastScanId = extractJsonString(body, "scanId");
  gState.latestOcrText = extractJsonString(body, "ocrText");
  gState.latestMatch.id = extractJsonString(matchObject, "id");
  gState.latestMatch.name = extractJsonString(matchObject, "name");
  gState.latestMatch.quantity = extractJsonInt(matchObject, "quantity", 0);
  gState.latestMatch.score = extractJsonFloat(matchObject, "score", 0.0F);
  const String timingsObject = extractJsonObject(body, "timings");
  gState.latestTimings.serverTotalMs =
      extractJsonInt(timingsObject, "serverTotalMs", 0);
  gState.latestTimings.serverUploadIngestMs =
      extractJsonInt(timingsObject, "uploadIngestMs", 0);
  gState.latestTimings.serverJobPersistMs =
      extractJsonInt(timingsObject, "jobPersistMs", 0);
  gState.latestTimings.serverOcrMs =
      extractJsonInt(timingsObject, "ocrMs", 0);
  gState.latestTimings.serverInventoryMs =
      extractJsonInt(timingsObject, "inventoryMs", 0);
  gState.latestTimings.serverMatchingMs =
      extractJsonInt(timingsObject, "matchingMs", 0);
}

bool connectWifi() {
  setStatus(ScreenState::kConnectingWifi, "Joining Wi-Fi");
  Serial.println("[wifi] connecting");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(true);
  WiFi.begin(kAppConfig.wifiSsid, kAppConfig.wifiPassword);

  const unsigned long startedAt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startedAt < kAppConfig.wifiConnectTimeoutMs) {
    delay(200);
  }

  gWifiReady = WiFi.status() == WL_CONNECTED;
  gIpAddress = gWifiReady ? WiFi.localIP().toString() : "offline";

  if (!gWifiReady) {
    gLastError = "Wi-Fi unavailable";
    setStatus(ScreenState::kError, gLastError);
    Serial.println("[wifi] connection timed out");
  } else {
    Serial.printf("[wifi] connected ip=%s rssi=%d dBm\n", gIpAddress.c_str(), WiFi.RSSI());
  }

  return gWifiReady;
}

bool beginMdns() {
  if (!gWifiReady) {
    return false;
  }

  gMdnsReady = MDNS.begin(kAppConfig.mdnsHostName);
  Serial.printf("[mdns] responder %s as %s.local\n",
                gMdnsReady ? "started" : "failed",
                kAppConfig.mdnsHostName);
  return gMdnsReady;
}

bool isOnWifiSubnet(const IPAddress& address) {
  const IPAddress localAddress = WiFi.localIP();
  const IPAddress subnetMask = WiFi.subnetMask();

  for (uint8_t index = 0; index < 4; ++index) {
    if ((address[index] & subnetMask[index]) != (localAddress[index] & subnetMask[index])) {
      return false;
    }
  }

  return true;
}

void discoverService(bool verbose = false) {
  if (millis() - gLastDiscoveryMs < kDiscoveryRetryIntervalMs && !gState.serverHost.isEmpty()) {
    return;
  }

  gLastDiscoveryMs = millis();
  setStatus(ScreenState::kDiscoveringService, "Resolving Segtori service");
  gServiceFromDiscovery = false;
  gState.serverHost = kAppConfig.fallbackHost;
  gState.serverPort = kAppConfig.fallbackPort;

  if (gMdnsReady) {
    const int serviceCount = MDNS.queryService(kAppConfig.mdnsServiceName, "tcp");
    if (verbose) {
      Serial.printf("[discovery] found %d candidate(s)\n", serviceCount);
    }

    for (int index = 0; index < serviceCount; ++index) {
      const IPAddress candidate = MDNS.IP(index);
      const bool onWifiSubnet = isOnWifiSubnet(candidate);
      if (verbose) {
        Serial.printf("[discovery] candidate=%s:%u wifi-subnet=%s\n",
                      candidate.toString().c_str(),
                      MDNS.port(index),
                      onWifiSubnet ? "yes" : "no");
      }

      if (onWifiSubnet) {
        gState.serverHost = candidate.toString();
        gState.serverPort = MDNS.port(index);
        gServiceFromDiscovery = true;
        break;
      }
    }
  }

  if (verbose) {
    Serial.printf("[discovery] target=%s:%u source=%s\n",
                  gState.serverHost.c_str(),
                  gState.serverPort,
                  gServiceFromDiscovery ? "mdns" : "fallback");
  }
}

bool initializeCamera() {
  Serial.println("[camera] initializing");
  camera_config_t config{};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = kCameraPinY2;
  config.pin_d1 = kCameraPinY3;
  config.pin_d2 = kCameraPinY4;
  config.pin_d3 = kCameraPinY5;
  config.pin_d4 = kCameraPinY6;
  config.pin_d5 = kCameraPinY7;
  config.pin_d6 = kCameraPinY8;
  config.pin_d7 = kCameraPinY9;
  config.pin_xclk = kCameraPinXclk;
  config.pin_pclk = kCameraPinPclk;
  config.pin_vsync = kCameraPinVsync;
  config.pin_href = kCameraPinHref;
  config.pin_sccb_sda = kCameraPinSiod;
  config.pin_sccb_scl = kCameraPinSioc;
  config.pin_pwdn = kCameraPinPwdn;
  config.pin_reset = kCameraPinReset;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_UXGA;
  config.jpeg_quality = 10;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  const esp_err_t result = esp_camera_init(&config);
  gCameraReady = result == ESP_OK;

  if (!gCameraReady) {
    gLastError = "Camera initialization failed";
    setStatus(ScreenState::kError, gLastError);
    Serial.printf("[camera] initialization failed error=0x%x\n", result);
  } else {
    sensor_t* sensor = esp_camera_sensor_get();
    framesize_t maximumFrameSize = FRAMESIZE_UXGA;
    const char* sensorName = "unknown";

    if (sensor) {
      if (sensor->id.PID == OV2640_PID) {
        sensorName = "OV2640";
        maximumFrameSize = FRAMESIZE_UXGA;
      } else if (sensor->id.PID == OV3660_PID) {
        sensorName = "OV3660";
        maximumFrameSize = FRAMESIZE_QXGA;
      }

      sensor->set_framesize(sensor, maximumFrameSize);
      sensor->set_quality(sensor, 10);
      sensor->set_vflip(sensor, 1);
      sensor->set_hmirror(sensor, 0);
    }

    gCameraFrameSize = maximumFrameSize;
    Serial.printf("[camera] ready sensor=%s pid=0x%x frame-size=%d quality=10\n",
                  sensorName,
                  sensor ? sensor->id.PID : 0,
                  maximumFrameSize);
  }

  return gCameraReady;
}

void shutdownCamera() {
  if (!gCameraReady) {
    setCpuFrequencyMhz(80);
    return;
  }

  esp_camera_deinit();
  gCameraReady = false;
  setCpuFrequencyMhz(80);
  Serial.println("[camera] sleeping");
}

camera_fb_t* captureFreshFrame() {
  setCpuFrequencyMhz(240);
  if (!gCameraReady && !initializeCamera()) {
    setCpuFrequencyMhz(80);
    return nullptr;
  }

  sensor_t* sensor = esp_camera_sensor_get();
  if (sensor) {
    sensor->set_framesize(sensor, FRAMESIZE_QVGA);
  }

  // Warm auto-exposure quickly at low resolution before the final full-size frame.
  delay(250);
  for (uint8_t index = 0; index < 5; ++index) {
    camera_fb_t* staleFrame = esp_camera_fb_get();
    if (!staleFrame) {
      return nullptr;
    }
    esp_camera_fb_return(staleFrame);
    delay(40);
  }

  if (sensor) {
    sensor->set_framesize(sensor, gCameraFrameSize);
  }

  camera_fb_t* staleFrame = esp_camera_fb_get();
  if (!staleFrame) {
    return nullptr;
  }
  esp_camera_fb_return(staleFrame);

  return esp_camera_fb_get();
}

bool checkServiceHealth(bool verbose = false) {
  const bool wasReachable = gServiceReachable;

  if (!gWifiReady || gState.serverHost.isEmpty()) {
    gServiceReachable = false;
    return false;
  }

  HTTPClient http;
  WiFiClient client;
  const String url =
      "http://" + gState.serverHost + ":" + String(gState.serverPort) + "/api/health";

  if (!http.begin(client, url)) {
    gServiceReachable = false;
    return false;
  }

  http.setTimeout(kFastRequestTimeoutMs);
  const int statusCode = http.GET();
  gServiceReachable = statusCode == 200;
  http.end();
  if (verbose || wasReachable != gServiceReachable) {
    Serial.printf("[service] health status=%d reachable=%s\n",
                  statusCode,
                  gServiceReachable ? "yes" : "no");
  }
  return gServiceReachable;
}

void publishScanTimings() {
  if (!gServiceReachable || gLastScanId.isEmpty()) {
    return;
  }

  HTTPClient http;
  WiFiClient client;
  const String url = "http://" + gState.serverHost + ":" +
                     String(gState.serverPort) + "/api/jobs/" + gLastScanId +
                     "/timings";
  if (!http.begin(client, url)) {
    return;
  }

  const String payload =
      "{\"deviceTimings\":{\"roundTripMs\":" +
      String(gState.latestTimings.roundTripMs) + ",\"captureMs\":" +
      String(gState.latestTimings.captureMs) + ",\"uploadAndServerMs\":" +
      String(gState.latestTimings.uploadAndServerMs) + "}}";
  http.setTimeout(kFastRequestTimeoutMs);
  http.addHeader("Content-Type", "application/json");
  const int statusCode = http.POST(payload);
  http.end();
  Serial.printf("[timing] telemetry status=%d\n", statusCode);
}

String extractHttpBody(const String& response) {
  const int separator = response.indexOf("\r\n\r\n");
  if (separator < 0) {
    return response;
  }

  return response.substring(separator + 4);
}

bool uploadFrame(camera_fb_t* frame, String& body, int& statusCode) {
  WiFiClient client;
  if (!client.connect(gState.serverHost.c_str(), gState.serverPort)) {
    statusCode = 0;
    return false;
  }

  client.setTimeout(kAppConfig.requestTimeoutMs);

  const String boundary = "----tori-scan";
  const String header =
      "--" + boundary + "\r\n"
      "Content-Disposition: form-data; name=\"image\"; filename=\"scan.jpg\"\r\n"
      "Content-Type: image/jpeg\r\n\r\n";
  const String footer = "\r\n--" + boundary + "--\r\n";
  const size_t contentLength = header.length() + frame->len + footer.length();

  client.printf("POST /api/scan HTTP/1.1\r\n");
  client.printf("Host: %s:%u\r\n", gState.serverHost.c_str(), gState.serverPort);
  client.printf("Content-Type: multipart/form-data; boundary=%s\r\n", boundary.c_str());
  client.printf("Content-Length: %u\r\n", static_cast<unsigned int>(contentLength));
  client.print("Connection: close\r\n\r\n");
  client.print(header);

  size_t written = 0;
  while (written < frame->len) {
    const size_t chunkSize = min(kUploadChunkSize, frame->len - written);
    client.write(frame->buf + written, chunkSize);
    written += chunkSize;
    delay(0);
  }

  client.print(footer);

  String response;
  const unsigned long startedAt = millis();
  while (millis() - startedAt < kAppConfig.requestTimeoutMs) {
    while (client.available()) {
      response += static_cast<char>(client.read());
    }

    if (!client.connected()) {
      break;
    }

    delay(10);
  }

  const bool timedOut = client.connected();
  client.stop();
  if (timedOut) {
    Serial.println("[snap] response timed out");
  }
  statusCode = response.startsWith("HTTP/1.1 ") ? response.substring(9, 12).toInt() : 500;
  body = extractHttpBody(response);
  return statusCode == 200;
}

String buildStatusJson() {
  String json = "{";
  json += "\"screen\":\"" + String(screenStateName(gState.screen)) + "\",";
  json += "\"lastStatus\":\"" + jsonEscape(gState.lastStatus) + "\",";
  json += "\"wifiReady\":" + String(gWifiReady ? "true" : "false") + ",";
  json += "\"serviceReachable\":" + String(gServiceReachable ? "true" : "false") + ",";
  json += "\"serviceTarget\":\"" + jsonEscape(gState.serverHost + ":" + String(gState.serverPort)) + "\",";
  json += "\"ipAddress\":\"" + jsonEscape(gIpAddress) + "\",";
  json += "\"lastScanId\":\"" + jsonEscape(gLastScanId) + "\",";
  json += "\"ocrText\":\"" + jsonEscape(gState.latestOcrText) + "\",";
  json += "\"lastError\":\"" + jsonEscape(gLastError) + "\",";
  json += "\"timings\":{";
  json += "\"roundTripMs\":" + String(gState.latestTimings.roundTripMs) + ",";
  json += "\"captureMs\":" + String(gState.latestTimings.captureMs) + ",";
  json += "\"uploadAndServerMs\":" +
          String(gState.latestTimings.uploadAndServerMs) + ",";
  json += "\"serverTotalMs\":" + String(gState.latestTimings.serverTotalMs) + ",";
  json += "\"serverUploadIngestMs\":" +
          String(gState.latestTimings.serverUploadIngestMs) + ",";
  json += "\"serverJobPersistMs\":" +
          String(gState.latestTimings.serverJobPersistMs) + ",";
  json += "\"serverOcrMs\":" + String(gState.latestTimings.serverOcrMs) + ",";
  json += "\"serverInventoryMs\":" +
          String(gState.latestTimings.serverInventoryMs) + ",";
  json += "\"serverMatchingMs\":" +
          String(gState.latestTimings.serverMatchingMs) + "},";
  json += "\"match\":{";
  json += "\"id\":\"" + jsonEscape(gState.latestMatch.id) + "\",";
  json += "\"name\":\"" + jsonEscape(gState.latestMatch.name) + "\",";
  json += "\"quantity\":" + String(gState.latestMatch.quantity) + ",";
  json += "\"score\":" + String(gState.latestMatch.score, 3);
  json += "}}";
  return json;
}

struct ScanResult {
  bool ok = false;
  int statusCode = 500;
  String body;
};

void turnCameraFlashOn() {
  if (kCameraFlashPin >= 0) {
    ledcWrite(kCameraFlashLedcChannel, 255);
  }
}

void fadeCameraFlashOut() {
  if (kCameraFlashPin < 0) {
    return;
  }

  for (int duty = 255; duty >= 0; duty -= 255 / kCameraFlashFadeSteps) {
    ledcWrite(kCameraFlashLedcChannel, duty);
    delay(kCameraFlashFadeStepDelayMs);
  }
  ledcWrite(kCameraFlashLedcChannel, 0);
}

ScanResult runScan() {
  ScanResult result;
  const unsigned long roundTripStartedAt = millis();
  turnCameraFlashOn();

  if (!gWifiReady) {
    fadeCameraFlashOut();
    result.statusCode = 503;
    result.body = "{\"ok\":false,\"error\":\"wifi unavailable\"}";
    return result;
  }

  if (!gServiceReachable) {
    fadeCameraFlashOut();
    gLastError = "Segtori service unavailable";
    setStatus(ScreenState::kError, gLastError);
    result.statusCode = 503;
    result.body = "{\"ok\":false,\"error\":\"service unavailable\"}";
    return result;
  }

  clearMatch();
  gLastError = "";
  setStatus(ScreenState::kCapturing, "Capturing image");
  checkServiceHealth();
  if (!gServiceReachable) {
    fadeCameraFlashOut();
    gLastError = "Segtori service unavailable";
    setStatus(ScreenState::kError, gLastError);
    result.statusCode = 503;
    result.body = "{\"ok\":false,\"error\":\"service unavailable\"}";
    return result;
  }

  const unsigned long captureStartedAt = millis();
  camera_fb_t* frame = captureFreshFrame();
  gState.latestTimings.captureMs = millis() - captureStartedAt;
  if (!frame) {
    fadeCameraFlashOut();
    shutdownCamera();
    gLastError = "Camera capture failed";
    setStatus(ScreenState::kError, gLastError);
    result.body = "{\"ok\":false,\"error\":\"capture failed\"}";
    return result;
  }

  Serial.printf("[snap] captured %u bytes\n", frame->len);
  fadeCameraFlashOut();
  setStatus(ScreenState::kUploading, "Uploading snap");
  result.statusCode = 0;
  const unsigned long uploadStartedAt = millis();
  result.ok = uploadFrame(frame, result.body, result.statusCode);
  gState.latestTimings.uploadAndServerMs = millis() - uploadStartedAt;
  esp_camera_fb_return(frame);
  shutdownCamera();

  if (!result.ok) {
    gLastError = result.statusCode > 0 ? "Snap processing failed" : "Snap upload failed";
    setStatus(ScreenState::kError, gLastError);
    if (result.body.isEmpty()) {
      result.body = "{\"ok\":false,\"error\":\"upload failed\"}";
    }
    if (result.statusCode <= 0) {
      result.statusCode = 500;
    }
    return result;
  }

  Serial.printf("[snap] upload complete status=%d\n", result.statusCode);
  applyScanResponse(result.body);
  gState.latestTimings.roundTripMs = millis() - roundTripStartedAt;
  Serial.printf(
      "[timing] roundtrip=%lu capture=%lu upload_server=%lu server=%lu ocr=%lu\n",
      static_cast<unsigned long>(gState.latestTimings.roundTripMs),
      static_cast<unsigned long>(gState.latestTimings.captureMs),
      static_cast<unsigned long>(gState.latestTimings.uploadAndServerMs),
      static_cast<unsigned long>(gState.latestTimings.serverTotalMs),
      static_cast<unsigned long>(gState.latestTimings.serverOcrMs));
  Serial.printf("[snap] result id=%s match=%s score=%.3f\n",
                gLastScanId.c_str(),
                gState.latestMatch.name.c_str(),
                gState.latestMatch.score);
  setStatus(ScreenState::kShowingMatch,
            gState.latestMatch.name.isEmpty() ? "Scan complete, no match" : "Match received");
  publishScanTimings();
  return result;
}

void pollNetworkState() {
  const unsigned long now = millis();

  if (!gWifiReady && now - gLastWifiAttemptMs >= kWifiRetryIntervalMs) {
    gLastWifiAttemptMs = now;
    connectWifi();
    if (gWifiReady) {
      beginMdns();
      discoverService();
    }
  }

  if (gWifiReady && !gServiceReachable &&
      now - gLastDiscoveryMs >= kDiscoveryRetryIntervalMs) {
    discoverService();
  }

  if (gWifiReady && now - gLastHealthCheckMs >= kHealthCheckIntervalMs) {
    gLastHealthCheckMs = now;
    checkServiceHealth();
    if (gServiceReachable) {
      setStatus(ScreenState::kReady, "Ready to scan");
    } else if (gLastError.isEmpty()) {
      setStatus(ScreenState::kDiscoveringService, "Waiting for service");
    }
  }
}

void printSerialHelp() {
  Serial.println("Commands:");
  Serial.println("  help      Show this command list");
  Serial.println("  status    Show device status");
  Serial.println("  health    Check Segtori service health");
  Serial.println("  discover  Rediscover the Segtori service");
  Serial.println("  snap      Capture and upload an image");
}

void printSerialPrompt() {
  Serial.print("segtori> ");
}

void runSerialCommand(String command) {
  command.trim();
  command.toLowerCase();

  if (command.isEmpty()) {
    return;
  }

  if (command == "help" || command == "?") {
    printSerialHelp();
  } else if (command == "status") {
    Serial.println(buildStatusJson());
  } else if (command == "health") {
    checkServiceHealth(true);
  } else if (command == "discover") {
    gLastDiscoveryMs = 0;
    discoverService(true);
  } else if (command == "snap") {
    Serial.println("[command] starting snap");
    const ScanResult result = runScan();
    Serial.printf("[command] snap finished status=%d ok=%s\n",
                  result.statusCode,
                  result.ok ? "yes" : "no");
    if (!result.ok && !result.body.isEmpty()) {
      Serial.println(result.body);
    }
  } else {
    Serial.printf("Unknown command: %s\n", command.c_str());
    Serial.println("Type 'help' for available commands.");
  }
}

void pollSerialCommands() {
  while (Serial.available()) {
    const char current = static_cast<char>(Serial.read());

    if (current == '\r') {
      continue;
    }

    if (current == '\n') {
      Serial.println();
      runSerialCommand(gSerialCommand);
      gSerialCommand = "";
      printSerialPrompt();
    } else if ((current == '\b' || current == 127) && !gSerialCommand.isEmpty()) {
      gSerialCommand.remove(gSerialCommand.length() - 1);
      Serial.print("\b \b");
    } else if (current >= 32 && current <= 126 && gSerialCommand.length() < 64) {
      gSerialCommand += current;
      Serial.write(current);
    }
  }
}

void configureSnapButton() {
  if (kSnapButtonPin < 0) {
    return;
  }

  pinMode(kSnapButtonPin, INPUT_PULLUP);
  gSnapButtonPressed = digitalRead(kSnapButtonPin) == LOW;
}

void configureCameraFlash() {
  if (kCameraFlashPin < 0) {
    return;
  }

  ledcSetup(kCameraFlashLedcChannel,
            kCameraFlashPwmFrequencyHz,
            kCameraFlashPwmResolutionBits);
  ledcAttachPin(kCameraFlashPin, kCameraFlashLedcChannel);
  ledcWrite(kCameraFlashLedcChannel, 0);
}

void pollSnapButton() {
  if (kSnapButtonPin < 0) {
    return;
  }

  const bool pressed = digitalRead(kSnapButtonPin) == LOW;
  if (pressed == gSnapButtonPressed || millis() - gSnapButtonChangedMs < kButtonDebounceMs) {
    return;
  }

  gSnapButtonPressed = pressed;
  gSnapButtonChangedMs = millis();
  if (pressed) {
    Serial.println("[button] snap");
    const ScanResult result = runScan();
    Serial.printf("[button] snap finished status=%d ok=%s\n",
                  result.statusCode,
                  result.ok ? "yes" : "no");
    if (!result.ok && !result.body.isEmpty()) {
      Serial.println(result.body);
    }
    printSerialPrompt();
  }
}

}  // namespace tori

void setup() {
  tori::configureCameraFlash();
  Serial.begin(115200);
  delay(1200);
  Serial.println();
  Serial.println("[boot] Segtori firmware starting");
  esp_log_level_set("gdma", ESP_LOG_NONE);
  Serial.printf("[boot] chip=%s revision=%u flash=%u psram=%u\n",
                ESP.getChipModel(),
                ESP.getChipRevision(),
                ESP.getFlashChipSize(),
                ESP.getPsramSize());
  setCpuFrequencyMhz(240);
  tori::setStatus(tori::ScreenState::kBoot, "Booting camera client");
  tori::configureSnapButton();
  tori::initializeCamera();
  tori::shutdownCamera();
  tori::connectWifi();
  tori::beginMdns();
  tori::discoverService();
  tori::checkServiceHealth();
  if (tori::gWifiReady && tori::gServiceReachable) {
    tori::setStatus(tori::ScreenState::kReady, "Ready to scan");
  }
  tori::printSerialHelp();
  tori::printSerialPrompt();
}

void loop() {
  tori::pollSerialCommands();
  tori::pollSnapButton();
  tori::pollNetworkState();
  delay(20);
}
