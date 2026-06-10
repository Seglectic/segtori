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
const {
  evaluateMatchConfidence,
  rankInventoryMatches,
} = require("./services/matcher");
const {
  extractTextVariantsFromImage,
  stopOnnxWorkers,
  warmOnnxOcr,
} = require("./services/ocr");
const { createLiveJobFeed } = require("./services/live-jobs");
const { createScanJobStore } = require("./services/scan-jobs");
const { uploadImage } = require("./services/uploads");

function createApp(config, logger = console) {
  const app = express();
  let discovery = null;
  const runtime = {
    ocrProvider: config.ocr.backend === "onnx" ? "starting" : null,
  };
  const liveJobFeed = createLiveJobFeed(logger);
  const scanJobStore = createScanJobStore(config, (job) => liveJobFeed.publish(job));

  app.use(express.json());

  app.use("/", createJobsRouter(config, scanJobStore));
  app.use("/api/health", createHealthRouter(config, runtime));
  app.use(
    "/api/match-text",
    createMatchTextRouter({
      listInventoryItems,
      rankInventoryMatches,
      evaluateMatchConfidence,
      matchLimit: config.match.maxCandidates,
      matchMinScore: config.match.minScore,
      matchMinMargin: config.match.minMargin,
    })
  );
  app.use(
    "/api/scan",
    createScanRouter({
      uploadImage,
      extractTextVariantsFromImage,
      listInventoryItems,
      rankInventoryMatches,
      evaluateMatchConfidence,
      matchLimit: config.match.maxCandidates,
      matchMinScore: config.match.minScore,
      matchMinMargin: config.match.minMargin,
      ocrConfig: config.ocr,
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
    async warm() {
      if (config.ocr.backend === "onnx") {
        const metrics = await warmOnnxOcr(config.ocr, logger);
        runtime.ocrProvider = metrics?.provider || "unknown";
      }
    },
    attachServer(server) {
      liveJobFeed.attach(server);
    },
    startDiscovery() {
      if (!discovery) {
        discovery = startMdnsAdvertisement(config, logger);
      }
    },
    stop() {
      liveJobFeed.stop();
      stopOnnxWorkers();
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
