// ╭──────────────────────────────╮
// │  Quantity Route              │
// │  Handles device-originated   │
// │  quantity updates against    │
// │  the inventory abstraction.  │
// ╰──────────────────────────────╯

const express = require("express");

function createItemsRouter({ updateItemQuantity }) {
  const router = express.Router();

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

