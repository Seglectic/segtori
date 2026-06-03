// ╭──────────────────────────────╮
// │  Text Match Route           │
// │  Accepts manual text and    │
// │  returns ranked inventory   │
// │  candidates for local test. │
// ╰──────────────────────────────╯

const express = require("express");

function createMatchTextRouter({ listInventoryItems, rankInventoryMatches, matchLimit }) {
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
      const match = candidates[0] || null;

      response.json({
        ok: true,
        ocrText: text,
        match,
        candidates,
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
