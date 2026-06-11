// ╭──────────────────────────────╮
// │  Quantity Route              │
// │  Handles device-originated   │
// │  quantity updates against    │
// │  the inventory abstraction.  │
// ╰──────────────────────────────╯

const express = require("express");

function createItemsRouter({ getInventoryCapabilities, listInventoryItems, updateItemQuantity }) {
  const router = express.Router();

  router.get("/", async (_request, response, next) => {
    try {
      response.json({
        ok: true,
        capabilities: getInventoryCapabilities(),
        items: await listInventoryItems(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:id/quantity", async (request, response, next) => {
    try {
      const { quantity } = request.body ?? {};

      if (!Number.isFinite(quantity)) {
        response.status(400).json({
          ok: false,
          error: "quantity must be a number",
        });
        return;
      }

      const updated = await updateItemQuantity(request.params.id, quantity);
      response.json({
        ok: true,
        id: updated.id,
        quantity: updated.quantity,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createItemsRouter,
};
