// ╭──────────────────────────────╮
// │  OCR Service                 │
// │  Runs swappable recognition  │
// │  backends and preprocessing. │
// ╰──────────────────────────────╯

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { randomUUID } = require("crypto");
const { promisify } = require("util");
const sharp = require("sharp");
const {
  getOnnxWorkerClient,
  stopOnnxWorkers,
  warmOnnxWorker,
} = require("./onnx-worker");

const execFileAsync = promisify(execFile);

function sanitizeText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function ollamaPrompt() {
  return [
    "Read the product or inventory label in this image.",
    "Transcribe only visible identifying text useful for inventory matching:",
    "product name, part number, SKU, dimensions, quantity, and manufacturer.",
    "Preserve letters, numbers, punctuation, and measurement symbols.",
    "Do not describe the scene, packaging, colors, or objects.",
    "Do not infer text that is not visible.",
    "If the label is unreadable, return UNREADABLE.",
  ].join(" ");
}

async function extractTextWithOllama(file, options) {
  const sourceBuffer = file.buffer?.length
    ? file.buffer
    : await fs.readFile(file.toriImagePath);
  const imageBuffer = await sharp(sourceBuffer)
    .rotate()
    .resize({
      width: options.ollamaImageMaxSize || 1600,
      height: options.ollamaImageMaxSize || 1600,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 90 })
    .toBuffer();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.ollamaTimeoutMs || 120000
  );

  try {
    const response = await fetch(
      `${String(options.ollamaUrl).replace(/\/+$/, "")}/api/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: options.ollamaModel,
          prompt: ollamaPrompt(),
          images: [imageBuffer.toString("base64")],
          stream: false,
          keep_alive: options.ollamaKeepAlive,
          options: {
            temperature: 0,
            num_predict: 192,
            num_ctx: options.ollamaContextSize || 8192,
          },
        }),
        signal: controller.signal,
      }
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || `HTTP ${response.status}`);
    }

    return {
      mode: `ollama:${options.ollamaModel}`,
      text: sanitizeText(payload.response).replace(/^UNREADABLE$/i, ""),
      metrics: {
        totalDurationMs: Math.round((payload.total_duration || 0) / 1e6),
        loadDurationMs: Math.round((payload.load_duration || 0) / 1e6),
        promptEvalDurationMs: Math.round(
          (payload.prompt_eval_duration || 0) / 1e6
        ),
        evalDurationMs: Math.round((payload.eval_duration || 0) / 1e6),
        promptEvalCount: payload.prompt_eval_count || 0,
        evalCount: payload.eval_count || 0,
        inputBytes: imageBuffer.length,
      },
    };
  } catch (error) {
    const message =
      error.name === "AbortError"
        ? `timed out after ${options.ollamaTimeoutMs}ms`
        : error.message;
    throw new Error(`Ollama vision OCR failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}

async function extractTextWithOnnx(file, options) {
  const imagePath = file.toriImagePath;
  const provider = options.onnxProvider || "auto";

  if (!imagePath) {
    throw new Error("ONNX OCR requires a persisted image path");
  }

  try {
    const payload = await getOnnxWorkerClient(options).infer(imagePath);

    return {
      mode: `onnx:${payload.metrics?.provider || provider}`,
      text: sanitizeText(payload.text),
      metrics: {
        ...payload.metrics,
        lines: payload.lines || [],
      },
    };
  } catch (error) {
    const message = error.stderr?.trim() || error.message;
    throw new Error(`ONNX OCR failed: ${message}`);
  }
}

function profileNames(mode) {
  if (mode === "raw") {
    return ["raw"];
  }

  if (mode === "normalized" || mode === "threshold") {
    return [mode];
  }

  return ["raw", "normalized", "threshold"];
}

async function buildProcessedImage(sourcePath, targetPath, profile) {
  let pipeline = sharp(sourcePath)
    .rotate()
    .resize({
      width: 2200,
      height: 2200,
      fit: "inside",
      withoutEnlargement: false,
    })
    .grayscale()
    .normalize()
    .sharpen();

  if (profile === "threshold") {
    pipeline = pipeline.threshold(170);
  }

  await pipeline.png().toFile(targetPath);
}

async function runTesseract(imagePath, profile) {
  const pageSegmentationMode = profile === "threshold" ? "11" : "6";
  const { stdout, stderr } = await execFileAsync("tesseract", [
    imagePath,
    "stdout",
    "--psm",
    pageSegmentationMode,
  ]);

  if (stderr?.trim()) {
    console.warn(`[ocr:${profile}] ${stderr.trim()}`);
  }

  return sanitizeText(stdout);
}

async function extractTextVariantsFromImage(file, options = {}) {
  if (!file) {
    return [];
  }

  if (options.backend === "ollama") {
    return [await extractTextWithOllama(file, options)];
  }

  if (options.backend === "onnx") {
    return [await extractTextWithOnnx(file, options)];
  }

  const extension = path.extname(file.originalname || "") || ".jpg";
  const tempRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), `tori-ocr-${process.pid}-`)
  );
  const sourcePath =
    file.toriImagePath ||
    path.join(tempRoot, `source-${randomUUID().slice(0, 8)}${extension}`);
  const profiles = profileNames(options.preprocessMode || "auto");
  const variants = [];

  if (!file.toriImagePath) {
    await fs.writeFile(sourcePath, file.buffer);
  }

  if (options.debugDir) {
    await fs.mkdir(options.debugDir, { recursive: true });
  }

  try {
    for (const profile of profiles) {
      let imagePath = sourcePath;

      if (profile !== "raw") {
        imagePath = path.join(tempRoot, `${profile}.png`);
        await buildProcessedImage(sourcePath, imagePath, profile);
      }

      const text = await runTesseract(imagePath, profile);
      variants.push({ mode: profile, text });

      if (options.debugDir && profile !== "raw") {
        await fs.copyFile(imagePath, path.join(options.debugDir, `${profile}.png`));
      }
    }

    return variants;
  } catch (error) {
    const message = error.stderr?.trim() || error.message;
    throw new Error(`Tesseract OCR failed: ${message}`);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function extractTextFromImage(file) {
  const variants = await extractTextVariantsFromImage(file, {
    preprocessMode: "raw",
  });
  return variants[0]?.text || "";
}

async function warmOnnxOcr(options) {
  await warmOnnxWorker(options);
}

module.exports = {
  extractTextFromImage,
  extractTextVariantsFromImage,
  stopOnnxWorkers,
  warmOnnxOcr,
};
