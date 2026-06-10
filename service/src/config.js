// ╭──────────────────────────────╮
// │  Service Config              │
// │  Reads the Phase 1 runtime   │
// │  contract for HTTP, mDNS,    │
// │  OCR, and Airtable access.   │
// ╰──────────────────────────────╯

const packageJson = require("../package.json");
const path = require("path");

function readNumber(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOcrBackend(value) {
  const backend = value || "onnx";

  if (!["tesseract", "ollama", "onnx"].includes(backend)) {
    throw new Error(`Unsupported OCR backend: ${backend}`);
  }

  return backend;
}

function readOnnxProvider(value) {
  const provider = value || "auto";

  if (!["auto", "cpu", "cuda"].includes(provider)) {
    throw new Error(`Unsupported ONNX provider: ${provider}`);
  }

  return provider;
}

function loadConfig() {
  const serviceName =
    process.env.SEGTORI_SERVICE_NAME ||
    process.env.SEGTORI_MDNS_NAME ||
    process.env.TORI_SERVICE_NAME ||
    process.env.TORI_MDNS_NAME ||
    "segtori-ocr";
  const mdnsName =
    process.env.SEGTORI_MDNS_NAME ||
    process.env.TORI_MDNS_NAME ||
    "segtori-ocr";

  return {
    serviceName,
    serviceVersion:
      process.env.SEGTORI_SERVICE_VERSION ||
      process.env.TORI_SERVICE_VERSION ||
      packageJson.version,
    port: readNumber(process.env.PORT, 8674),
    mdnsName,
    mdnsHost: process.env.SEGTORI_MDNS_HOST || "tori.local",
    mdnsInterface: process.env.SEGTORI_MDNS_INTERFACE || "",
    match: {
      maxCandidates: readNumber(process.env.MATCH_MAX_CANDIDATES, 5),
      minScore: Number.parseFloat(process.env.MATCH_MIN_SCORE || "0.55"),
      minMargin: Number.parseFloat(process.env.MATCH_MIN_MARGIN || "0.1"),
    },
    ocr: {
      backend: readOcrBackend(process.env.OCR_BACKEND),
      preprocessMode: process.env.OCR_PREPROCESS_MODE || "auto",
      debugEnabled: process.env.SCAN_DEBUG_ENABLED === "true",
      debugDir:
        process.env.SCAN_DEBUG_DIR ||
        path.resolve(__dirname, "..", "process"),
      ollamaUrl: process.env.OLLAMA_URL || "http://127.0.0.1:11434",
      ollamaModel: process.env.OLLAMA_VISION_MODEL || "qwen2.5vl:3b",
      ollamaKeepAlive: process.env.OLLAMA_KEEP_ALIVE || "30m",
      ollamaTimeoutMs: readNumber(process.env.OLLAMA_TIMEOUT_MS, 120000),
      ollamaContextSize: readNumber(process.env.OLLAMA_CONTEXT_SIZE, 8192),
      ollamaImageMaxSize: readNumber(process.env.OLLAMA_IMAGE_MAX_SIZE, 1600),
      onnxPythonPath:
        process.env.ONNX_PYTHON_PATH ||
        path.resolve(__dirname, "..", "onnx", ".venv", "bin", "python"),
      onnxWorkerPath:
        process.env.ONNX_WORKER_PATH ||
        path.resolve(__dirname, "..", "onnx", "worker.py"),
      onnxProvider: readOnnxProvider(process.env.ONNX_PROVIDER),
      onnxTimeoutMs: readNumber(process.env.ONNX_TIMEOUT_MS, 30000),
    },
    scanJobs: {
      ingestDir:
        process.env.SCAN_JOB_INGEST_DIR ||
        path.resolve(__dirname, "..", "process"),
    },
    airtable: {
      apiToken: process.env.AIRTABLE_API_TOKEN || "",
      baseId: process.env.AIRTABLE_BASE_ID || "",
      tableId: process.env.AIRTABLE_TABLE_ID || process.env.AIRTABLE_TABLE_NAME || "Inventory",
      viewId: process.env.AIRTABLE_VIEW_ID || "",
      itemIdField: process.env.AIRTABLE_ITEM_ID_FIELD || "",
      itemNameField: process.env.AIRTABLE_ITEM_NAME_FIELD || "Name",
      itemPartNumberField: process.env.AIRTABLE_ITEM_PART_NUMBER_FIELD || "Part Number",
      itemSecondaryNameField: process.env.AIRTABLE_ITEM_SECONDARY_NAME_FIELD || "",
      itemAliasesField: process.env.AIRTABLE_ITEM_ALIASES_FIELD || "",
      quantityField: process.env.AIRTABLE_QUANTITY_FIELD || "Quantity",
    },
  };
}

module.exports = {
  loadConfig,
};
