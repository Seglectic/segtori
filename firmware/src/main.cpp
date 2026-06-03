// ╭──────────────────────────────╮
// │  Web Scan Console            │
// │  Serves a compact control    │
// │  page and relays captured    │
// │  scans to the TORI service.  │
// ╰──────────────────────────────╯

#include <Arduino.h>
#include <ESPmDNS.h>
#include <HTTPClient.h>
#include <WebServer.h>
#include <WiFi.h>
#include <WiFiClient.h>
#include <esp_camera.h>

#if __has_include("app_config.h")
#include "app_config.h"
#else
#include "app_config.example.h"
#endif
#include "app_state.h"

namespace tori {

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
constexpr uint32_t kWifiRetryIntervalMs = 12000;
constexpr uint32_t kDiscoveryRetryIntervalMs = 15000;
constexpr uint32_t kHealthCheckIntervalMs = 15000;
constexpr uint16_t kFastRequestTimeoutMs = 2500;
constexpr size_t kUploadChunkSize = 1460;

DeviceState gState{};
WebServer gServer(80);
bool gCameraReady = false;
bool gWifiReady = false;
bool gMdnsReady = false;
bool gServiceReachable = false;
bool gServiceFromDiscovery = false;
String gLastScanId;
String gLastError;
String gIpAddress = "offline";
unsigned long gLastWifiAttemptMs = 0;
unsigned long gLastDiscoveryMs = 0;
unsigned long gLastHealthCheckMs = 0;

const char kPageHtml[] PROGMEM = R"HTML(
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TORI Console</title>
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
        <div class="eyebrow">Tagged Object Recognition Interface</div>
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
  </main>
  <script>
    const $ = (id) => document.getElementById(id);
    const scanButton = $("scan");

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
    }

    async function refresh() {
      const response = await fetch("/api/status", { cache: "no-store" });
      render(await response.json());
    }

    async function runScan() {
      scanButton.disabled = true;
      $("status").textContent = "Capturing image";
      try {
        const response = await fetch("/api/scan", { method: "POST" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "scan failed");
        }
        await refresh();
        $("status").textContent = "Scan complete";
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

void setStatus(ScreenState screen, const String& status) {
  gState.screen = screen;
  gState.lastStatus = status;
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
}

void applyScanResponse(const String& body) {
  const String matchObject = extractJsonObject(body, "match");
  gLastScanId = extractJsonString(body, "scanId");
  gState.latestOcrText = extractJsonString(body, "ocrText");
  gState.latestMatch.id = extractJsonString(matchObject, "id");
  gState.latestMatch.name = extractJsonString(matchObject, "name");
  gState.latestMatch.quantity = extractJsonInt(matchObject, "quantity", 0);
  gState.latestMatch.score = extractJsonFloat(matchObject, "score", 0.0F);
}

bool connectWifi() {
  setStatus(ScreenState::kConnectingWifi, "Joining Wi-Fi");
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
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
  }

  return gWifiReady;
}

bool beginMdns() {
  if (!gWifiReady) {
    return false;
  }

  gMdnsReady = MDNS.begin(kAppConfig.mdnsHostName);
  return gMdnsReady;
}

void discoverService() {
  if (millis() - gLastDiscoveryMs < kDiscoveryRetryIntervalMs && !gState.serverHost.isEmpty()) {
    return;
  }

  gLastDiscoveryMs = millis();
  setStatus(ScreenState::kDiscoveringService, "Resolving TORI service");
  gServiceFromDiscovery = false;
  gState.serverHost = kAppConfig.fallbackHost;
  gState.serverPort = kAppConfig.fallbackPort;

  if (gMdnsReady) {
    const int serviceCount = MDNS.queryService(kAppConfig.mdnsServiceName, "tcp");
    if (serviceCount > 0) {
      gState.serverHost = MDNS.IP(0).toString();
      gState.serverPort = MDNS.port(0);
      gServiceFromDiscovery = true;
    }
  }
}

bool initializeCamera() {
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
  config.frame_size = FRAMESIZE_HQVGA;
  config.jpeg_quality = 18;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_LATEST;
  config.fb_location = CAMERA_FB_IN_PSRAM;

  const esp_err_t result = esp_camera_init(&config);
  gCameraReady = result == ESP_OK;

  if (!gCameraReady) {
    gLastError = "Camera initialization failed";
    setStatus(ScreenState::kError, gLastError);
  }

  return gCameraReady;
}

bool checkServiceHealth() {
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
  return gServiceReachable;
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

  const unsigned long startedAt = millis();
  while (client.connected() && !client.available() &&
         millis() - startedAt < kAppConfig.requestTimeoutMs) {
    delay(10);
  }

  String response;
  while (client.available()) {
    response += client.readString();
  }

  client.stop();
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
  json += "\"match\":{";
  json += "\"id\":\"" + jsonEscape(gState.latestMatch.id) + "\",";
  json += "\"name\":\"" + jsonEscape(gState.latestMatch.name) + "\",";
  json += "\"quantity\":" + String(gState.latestMatch.quantity) + ",";
  json += "\"score\":" + String(gState.latestMatch.score, 3);
  json += "}}";
  return json;
}

void handleRoot() {
  gServer.send_P(200, "text/html", kPageHtml);
}

void handleStatus() {
  gServer.send(200, "application/json", buildStatusJson());
}

void handleScan() {
  if (!gCameraReady) {
    gServer.send(503, "application/json", "{\"ok\":false,\"error\":\"camera unavailable\"}");
    return;
  }

  if (!gWifiReady) {
    gServer.send(503, "application/json", "{\"ok\":false,\"error\":\"wifi unavailable\"}");
    return;
  }

  if (!gServiceReachable) {
    gLastError = "TORI service unavailable";
    setStatus(ScreenState::kError, gLastError);
    gServer.send(503, "application/json", "{\"ok\":false,\"error\":\"service unavailable\"}");
    return;
  }

  clearMatch();
  gLastError = "";
  setStatus(ScreenState::kCapturing, "Capturing image");
  checkServiceHealth();
  if (!gServiceReachable) {
    gLastError = "TORI service unavailable";
    setStatus(ScreenState::kError, gLastError);
    gServer.send(503, "application/json", "{\"ok\":false,\"error\":\"service unavailable\"}");
    return;
  }

  camera_fb_t* frame = esp_camera_fb_get();
  if (!frame) {
    gLastError = "Camera capture failed";
    setStatus(ScreenState::kError, gLastError);
    gServer.send(500, "application/json", "{\"ok\":false,\"error\":\"capture failed\"}");
    return;
  }

  setStatus(ScreenState::kUploading, "Uploading scan");
  String body;
  int statusCode = 0;
  const bool ok = uploadFrame(frame, body, statusCode);
  esp_camera_fb_return(frame);

  if (!ok) {
    gLastError = "Scan upload failed";
    setStatus(ScreenState::kError, gLastError);
    const String fallback =
        body.length() > 0 ? body : "{\"ok\":false,\"error\":\"upload failed\"}";
    gServer.send(statusCode > 0 ? statusCode : 500, "application/json", fallback);
    return;
  }

  applyScanResponse(body);
  setStatus(ScreenState::kShowingMatch,
            gState.latestMatch.name.isEmpty() ? "Scan complete, no match" : "Match received");
  gServer.send(200, "application/json", "{\"ok\":true}");
}

void configureRoutes() {
  gServer.on("/", HTTP_GET, handleRoot);
  gServer.on("/api/status", HTTP_GET, handleStatus);
  gServer.on("/api/scan", HTTP_POST, handleScan);
  gServer.begin();
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

  if (gWifiReady && now - gLastDiscoveryMs >= kDiscoveryRetryIntervalMs) {
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

}  // namespace tori

void setup() {
  tori::setStatus(tori::ScreenState::kBoot, "Booting web console");
  tori::initializeCamera();
  tori::connectWifi();
  tori::beginMdns();
  tori::discoverService();
  tori::checkServiceHealth();
  if (tori::gCameraReady && tori::gWifiReady && tori::gServiceReachable) {
    tori::setStatus(tori::ScreenState::kReady, "Ready to scan");
  }
  tori::configureRoutes();
}

void loop() {
  tori::pollNetworkState();
  tori::gServer.handleClient();
  delay(5);
}
