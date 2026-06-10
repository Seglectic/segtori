// ╭──────────────────────────────╮
// │  Scan Route                  │
// │  Accepts uploaded images and │
// │  returns the Phase 1 OCR and │
// │  match response shape.       │
// ╰──────────────────────────────╯

const express = require("express");
const path = require("path");
const { performance } = require("perf_hooks");

function elapsedMs(startedAt) {
  return Math.round(performance.now() - startedAt);
}

function rankVariants(variants, items, rankInventoryMatches, matchLimit) {
  return variants
    .map((variant) => ({
      ...variant,
      candidates: rankInventoryMatches(variant.text, items, matchLimit),
    }))
    .sort((left, right) => {
      const scoreDifference =
        (right.candidates[0]?.score || 0) - (left.candidates[0]?.score || 0);

      return scoreDifference || right.text.length - left.text.length;
    });
}

function createScanRouter({
  uploadImage,
  extractTextVariantsFromImage,
  listInventoryItems,
  rankInventoryMatches,
  evaluateMatchConfidence,
  matchLimit,
  matchMinScore,
  matchMinMargin,
  ocrConfig,
  scanJobStore,
}) {
  const router = express.Router();

  router.post(
    "/",
    (request, _response, next) => {
      request.scanStartedAt = performance.now();
      next();
    },
    uploadImage,
    async (request, response, next) => {
    let scanJob = null;
    let ocrText = "";
    const timings = {
      uploadIngestMs: elapsedMs(request.scanStartedAt),
    };

    try {
      if (!request.file) {
        response.status(400).json({
          ok: false,
          error: "image upload is required",
        });
        return;
      }

      let stageStartedAt = performance.now();
      scanJob = await scanJobStore.createJob(request.file);
      timings.jobPersistMs = elapsedMs(stageStartedAt);
      const debugDir = ocrConfig.debugEnabled
        ? path.join(ocrConfig.debugDir, scanJob.id)
        : "";
      const initialMode =
        ocrConfig.preprocessMode === "auto" ? "raw" : ocrConfig.preprocessMode;
      stageStartedAt = performance.now();
      let variants = await extractTextVariantsFromImage(request.file, {
        ...ocrConfig,
        preprocessMode: initialMode,
        debugDir,
      });
      timings.ocrMs = elapsedMs(stageStartedAt);
      stageStartedAt = performance.now();
      const items = await listInventoryItems();
      timings.inventoryMs = elapsedMs(stageStartedAt);
      stageStartedAt = performance.now();
      let rankedVariants = rankVariants(
        variants,
        items,
        rankInventoryMatches,
        matchLimit
      );
      let selected = rankedVariants[0];
      let confidence = evaluateMatchConfidence(
        selected?.candidates || [],
        matchMinScore,
        matchMinMargin
      );
      timings.matchingMs = elapsedMs(stageStartedAt);

      // Exact or clearly separated raw matches avoid two extra OCR passes.
      if (
        ocrConfig.backend === "tesseract" &&
        ocrConfig.preprocessMode === "auto" &&
        !confidence.accepted
      ) {
        stageStartedAt = performance.now();
        const processedVariants = await extractTextVariantsFromImage(request.file, {
          ...ocrConfig,
          preprocessMode: "normalized",
          debugDir,
        });
        processedVariants.push(
          ...(await extractTextVariantsFromImage(request.file, {
            ...ocrConfig,
            preprocessMode: "threshold",
            debugDir,
          }))
        );
        timings.ocrMs += elapsedMs(stageStartedAt);
        stageStartedAt = performance.now();
        variants = variants.concat(processedVariants);
        rankedVariants = rankVariants(
          variants,
          items,
          rankInventoryMatches,
          matchLimit
        );
        selected = rankedVariants[0];
        confidence = evaluateMatchConfidence(
          selected?.candidates || [],
          matchMinScore,
          matchMinMargin
        );
        timings.matchingMs += elapsedMs(stageStartedAt);
      }

      ocrText = selected?.text || "";
      const candidates = selected?.candidates || [];
      const bestCandidate = candidates[0] || null;
      const match = confidence.accepted ? bestCandidate : null;
      timings.serverTotalMs = elapsedMs(request.scanStartedAt);
      await scanJobStore.completeJob(scanJob, {
        ocrText,
        match,
        candidates,
        bestCandidate,
        confidence,
        preprocessingMode: selected?.mode || ocrConfig.preprocessMode,
        ocrVariants: rankedVariants,
        timings,
      });

      response.json({
        ok: true,
        scanId: scanJob.id,
        ocrText,
        match,
        candidates,
        confidence,
        preprocessingMode: selected?.mode || ocrConfig.preprocessMode,
        ocrMetrics: selected?.metrics || null,
        timings,
      });
    } catch (error) {
      if (scanJob) {
        await scanJobStore.failJob(scanJob, error, { ocrText }).catch(() => {});
      }
      next(error);
    }
  });

  return router;
}

module.exports = {
  createScanRouter,
};
