// ╭──────────────────────────────╮
// │  Config Tests                │
// │  Verifies recognition        │
// │  backend selection.          │
// ╰──────────────────────────────╯

const assert = require("node:assert/strict");
const test = require("node:test");

const { loadConfig } = require("../src/config");

test("defaults to the ONNX backend", () => {
  const previous = process.env.OCR_BACKEND;
  delete process.env.OCR_BACKEND;

  try {
    assert.equal(loadConfig().ocr.backend, "onnx");
    assert.equal(loadConfig().ocr.onnxProvider, "auto");
    assert.equal(loadConfig().airtable.itemPartNumberField, "Part Number");
  } finally {
    if (previous === undefined) {
      delete process.env.OCR_BACKEND;
    } else {
      process.env.OCR_BACKEND = previous;
    }
  }
});

test("advertises the dashboard at tori.local by default", () => {
  const previous = process.env.SEGTORI_MDNS_HOST;
  delete process.env.SEGTORI_MDNS_HOST;

  try {
    assert.equal(loadConfig().mdnsHost, "tori.local");
  } finally {
    if (previous === undefined) {
      delete process.env.SEGTORI_MDNS_HOST;
    } else {
      process.env.SEGTORI_MDNS_HOST = previous;
    }
  }
});

test("rejects unknown OCR backends", () => {
  const previous = process.env.OCR_BACKEND;
  process.env.OCR_BACKEND = "unknown";

  try {
    assert.throws(() => loadConfig(), /Unsupported OCR backend/);
  } finally {
    if (previous === undefined) {
      delete process.env.OCR_BACKEND;
    } else {
      process.env.OCR_BACKEND = previous;
    }
  }
});

test("accepts the ONNX OCR backend", () => {
  const previous = process.env.OCR_BACKEND;
  process.env.OCR_BACKEND = "onnx";

  try {
    assert.equal(loadConfig().ocr.backend, "onnx");
    assert.equal(loadConfig().ocr.onnxProvider, "auto");
  } finally {
    if (previous === undefined) {
      delete process.env.OCR_BACKEND;
    } else {
      process.env.OCR_BACKEND = previous;
    }
  }
});

test("rejects unknown ONNX providers", () => {
  const previous = process.env.ONNX_PROVIDER;
  process.env.ONNX_PROVIDER = "unknown";

  try {
    assert.throws(() => loadConfig(), /Unsupported ONNX provider/);
  } finally {
    if (previous === undefined) {
      delete process.env.ONNX_PROVIDER;
    } else {
      process.env.ONNX_PROVIDER = previous;
    }
  }
});
