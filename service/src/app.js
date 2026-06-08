// ╭──────────────────────────────╮
// │  Express App                 │
// │  Wires the Phase 1 service   │
// │  routes and keeps discovery  │
// │  lifecycle outside routes.   │
// ╰──────────────────────────────╯

const express = require("express");

const { createHealthRouter } = require("./routes/health");
const { createItemsRouter } = require("./routes/items");
const { createJobsRouter } = require("./routes/jobs");
const { createMatchTextRouter } = require("./routes/match-text");
const { createScanRouter } = require("./routes/scan");
const { startMdnsAdvertisement } = require("./services/discovery");
const { listInventoryItems, updateItemQuantity } = require("./services/inventory");
const { rankInventoryMatches } = require("./services/matcher");
const { extractTextFromImage } = require("./services/ocr");
const { createScanJobStore } = require("./services/scan-jobs");
const { uploadImage } = require("./services/uploads");

function createApp(config, logger = console) {
  const app = express();
  let discovery = null;
  const scanJobStore = createScanJobStore(config);

  app.use(express.json());

  app.use("/", createJobsRouter(config));
  app.use("/api/health", createHealthRouter(config));
  app.use(
    "/api/match-text",
    createMatchTextRouter({
      listInventoryItems,
      rankInventoryMatches,
      matchLimit: config.match.maxCandidates,
    })
  );
  app.use(
    "/api/scan",
    createScanRouter({
      uploadImage,
      extractTextFromImage,
      listInventoryItems,
      rankInventoryMatches,
      matchLimit: config.match.maxCandidates,
      scanJobStore,
    })
  );
  app.use(
    "/api/items",
    createItemsRouter({
      updateItemQuantity,
    })
  );

  app.use((error, _request, response, _next) => {
    logger.error(error);
    response.status(500).json({
      ok: false,
      error: error.message || "internal server error",
    });
  });

  return {
    app,
    startDiscovery() {
      if (!discovery) {
        discovery = startMdnsAdvertisement(config, logger);
      }
    },
    stop() {
      if (discovery) {
        discovery.stop();
        discovery = null;
      }
    },
  };
}

module.exports = {
  createApp,
};
