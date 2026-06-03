// ╭──────────────────────────────╮
// │  OCR Service                 │
// │  Runs host Tesseract against │
// │  uploaded images and trims   │
// │  output for matcher input.   │
// ╰──────────────────────────────╯

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

async function extractTextFromImage(file) {
  if (!file) {
    return "";
  }

  const extension = path.extname(file.originalname || "") || ".jpg";
  const tempPath =
    file.toriImagePath ||
    path.join(os.tmpdir(), `tori-scan-${process.pid}-${Date.now()}${extension}`);
  const shouldCleanup = !file.toriImagePath;

  if (!file.toriImagePath) {
    await fs.writeFile(tempPath, file.buffer);
  }

  try {
    const { stdout, stderr } = await execFileAsync("tesseract", [
      tempPath,
      "stdout",
      "--psm",
      "6",
    ]);

    if (stderr?.trim()) {
      console.warn(`[ocr] ${stderr.trim()}`);
    }

    return sanitizeText(stdout);
  } catch (error) {
    const message = error.stderr?.trim() || error.message;
    throw new Error(`Tesseract OCR failed: ${message}`);
  } finally {
    if (shouldCleanup) {
      await fs.unlink(tempPath).catch(() => {});
    }
  }
}

module.exports = {
  extractTextFromImage,
};
