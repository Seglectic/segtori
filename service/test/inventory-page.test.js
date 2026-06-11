// ╭──────────────────────────────╮
// │  Inventory Page Tests        │
// │  Verifies root inventory UI  │
// │  and scan-log route framing. │
// ╰──────────────────────────────╯

const assert = require("node:assert/strict");
const test = require("node:test");

const { renderInventoryDashboard } = require("../src/routes/inventory");
const { renderDashboard } = require("../src/routes/jobs");

function makeConfig() {
  return {
    serviceName: "segtori-ocr",
    port: 8674,
    ocr: { backend: "onnx" },
    airtable: {
      baseId: "app123",
      tableId: "Inventory",
    },
  };
}

test("inventory dashboard links to the scan log", () => {
  const html = renderInventoryDashboard(makeConfig());

  assert.match(html, /Inventory Console/);
  assert.match(html, /href="\/log"/);
  assert.match(html, /fetch\("\/api\/items"\)/);
});

test("scan dashboard links back to inventory", () => {
  const html = renderDashboard(makeConfig());

  assert.match(html, /Scan Jobs/);
  assert.match(html, /href="\/"/);
});
