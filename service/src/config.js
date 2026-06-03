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
    match: {
      maxCandidates: readNumber(process.env.MATCH_MAX_CANDIDATES, 5),
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
      itemSecondaryNameField: process.env.AIRTABLE_ITEM_SECONDARY_NAME_FIELD || "",
      quantityField: process.env.AIRTABLE_QUANTITY_FIELD || "Quantity",
    },
  };
}

module.exports = {
  loadConfig,
};
