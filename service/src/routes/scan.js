// ╭──────────────────────────────╮
// │  Scan Route                  │
// │  Accepts uploaded images and │
// │  returns the Phase 1 OCR and │
// │  match response shape.       │
// ╰──────────────────────────────╯

const express = require("express");

function createScanRouter({
  uploadImage,
  extractTextFromImage,
  listInventoryItems,
  rankInventoryMatches,
  matchLimit,
  scanJobStore,
}) {
  const router = express.Router();

  router.post("/", uploadImage, async (request, response, next) => {
    let scanJob = null;

    try {
      if (!request.file) {
        response.status(400).json({
          ok: false,
          error: "image upload is required",
        });
        return;
      }

      scanJob = await scanJobStore.createJob(request.file);
      const ocrText = await extractTextFromImage(request.file);
      const items = await listInventoryItems();
      const candidates = rankInventoryMatches(ocrText, items, matchLimit);
      const match = candidates[0] || null;
      await scanJobStore.completeJob(scanJob, {
        ocrText,
        match,
        candidates,
      });

      response.json({
        ok: true,
        scanId: scanJob.id,
        ocrText,
        match,
        candidates,
      });
    } catch (error) {
      if (scanJob) {
        await scanJobStore.failJob(scanJob, error).catch(() => {});
      }
      next(error);
    }
  });

  return router;
}

module.exports = {
  createScanRouter,
};
