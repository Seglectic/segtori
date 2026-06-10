// ╭──────────────────────────────╮
// │  Text Match Route           │
// │  Accepts manual text and    │
// │  returns ranked inventory   │
// │  candidates for local test. │
// ╰──────────────────────────────╯

const express = require("express");

function createMatchTextRouter({
  listInventoryItems,
  rankInventoryMatches,
  evaluateMatchConfidence,
  matchLimit,
  matchMinScore,
  matchMinMargin,
}) {
  const router = express.Router();

  router.post("/", async (request, response, next) => {
    try {
      const text = String(request.body?.text ?? "").trim();

      if (!text) {
        response.status(400).json({
          ok: false,
          error: "text is required",
        });
        return;
      }

      const items = await listInventoryItems();
      const candidates = rankInventoryMatches(text, items, matchLimit);
      const bestCandidate = candidates[0] || null;
      const confidence = evaluateMatchConfidence(
        candidates,
        matchMinScore,
        matchMinMargin
      );
      const match = confidence.accepted ? bestCandidate : null;

      response.json({
        ok: true,
        ocrText: text,
        match,
        candidates,
        confidence,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createMatchTextRouter,
};
