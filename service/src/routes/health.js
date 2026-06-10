// ╭──────────────────────────────╮
// │  Health Route                │
// │  Serves readiness metadata   │
// │  derived from runtime config │
// │  and package metadata.       │
// ╰──────────────────────────────╯

const express = require("express");

function createHealthRouter(config, runtime = {}) {
  const router = express.Router();

  router.get("/", (_request, response) => {
    response.json({
      ok: true,
      service: config.serviceName,
      version: config.serviceVersion,
      mdnsName: config.mdnsName,
      port: config.port,
      ocrBackend: config.ocr.backend,
      ocrProvider:
        config.ocr.backend === "onnx"
          ? runtime.ocrProvider || "starting"
          : null,
      ocrModel:
        config.ocr.backend === "ollama"
          ? config.ocr.ollamaModel
          : config.ocr.backend === "onnx"
            ? "rapidocr"
            : "tesseract",
    });
  });

  return router;
}

module.exports = {
  createHealthRouter,
};
