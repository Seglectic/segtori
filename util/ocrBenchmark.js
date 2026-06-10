// ╭──────────────────────────────╮
// │  OCR Dataset Benchmark       │
// │  Submits paired label images │
// │  and summarizes scan quality.│
// ╰──────────────────────────────╯

const fs = require("fs/promises");
const path = require("path");

const datasetDir = path.resolve(__dirname, "dataset");
const defaultBaseUrl = "http://127.0.0.1:8674";

function parseArgs(argv) {
  const options = {
    baseUrl: defaultBaseUrl,
    limit: Number.POSITIVE_INFINITY,
    variants: ["hires", "lores"],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const value = argv[index + 1];

    if (argument === "--base-url" && value) {
      options.baseUrl = value.replace(/\/+$/, "");
      index += 1;
    } else if (argument === "--limit" && value) {
      options.limit = Number.parseInt(value, 10);
      index += 1;
    } else if (argument === "--variant" && value) {
      options.variants = value === "both" ? ["hires", "lores"] : [value];
      index += 1;
    }
  }

  return options;
}

function imageKey(fileName) {
  return path
    .parse(fileName)
    .name.replace(/ - 01(?: - 01)?$/, "")
    .toUpperCase();
}

function mimeTypeFor(fileName) {
  return path.extname(fileName).toLowerCase() === ".png"
    ? "image/png"
    : "image/jpeg";
}

async function listImages(variant, limit) {
  const variantDir = path.join(datasetDir, variant);
  const fileNames = (await fs.readdir(variantDir))
    .filter((fileName) => /\.(?:jpe?g|png|webp)$/i.test(fileName))
    .sort()
    .slice(0, limit);

  return fileNames.map((fileName) => ({
    key: imageKey(fileName),
    variant,
    fileName,
    filePath: path.join(variantDir, fileName),
  }));
}

async function scanImage(baseUrl, image) {
  const imageBuffer = await fs.readFile(image.filePath);
  const form = new FormData();
  form.append(
    "image",
    new Blob([imageBuffer], { type: mimeTypeFor(image.fileName) }),
    image.fileName
  );

  const startedAt = Date.now();
  const response = await fetch(`${baseUrl}/api/scan`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));

  return {
    ...image,
    durationMs: Date.now() - startedAt,
    statusCode: response.status,
    ok: response.ok && payload.ok === true,
    scanId: payload.scanId || "",
    ocrText: payload.ocrText || "",
    match: payload.match || null,
    candidates: payload.candidates || [],
    confidence: payload.confidence || null,
    preprocessingMode: payload.preprocessingMode || "raw",
    ocrMetrics: payload.ocrMetrics || null,
    error: payload.error || "",
  };
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function summarize(results) {
  const successful = results.filter((result) => result.ok);
  const paired = new Map();

  for (const result of successful) {
    const variants = paired.get(result.key) || {};
    variants[result.variant] = result;
    paired.set(result.key, variants);
  }

  const completePairs = [...paired.values()].filter(
    (pair) => pair.hires && pair.lores
  );
  const matchingPairs = completePairs.filter(
    (pair) =>
      pair.hires.candidates[0]?.id &&
      pair.lores.candidates[0]?.id &&
      pair.hires.candidates[0].id === pair.lores.candidates[0].id
  );

  return {
    submitted: results.length,
    successful: successful.length,
    failed: results.length - successful.length,
    nonEmptyOcr: successful.filter((result) => result.ocrText.trim()).length,
    withCandidate: successful.filter((result) => result.candidates[0]).length,
    withAcceptedMatch: successful.filter((result) => result.match).length,
    averageOcrCharacters: Number(
      average(successful.map((result) => result.ocrText.length)).toFixed(1)
    ),
    averageBestScore: Number(
      average(successful.map((result) => result.candidates[0]?.score || 0)).toFixed(3)
    ),
    averageDurationMs: Math.round(
      average(successful.map((result) => result.durationMs))
    ),
    completePairs: completePairs.length,
    matchingPairResults: matchingPairs.length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const healthResponse = await fetch(`${options.baseUrl}/api/health`);

  if (!healthResponse.ok) {
    throw new Error(`Service health check failed: HTTP ${healthResponse.status}`);
  }

  const images = (
    await Promise.all(
      options.variants.map((variant) => listImages(variant, options.limit))
    )
  ).flat();
  const results = [];

  for (const [index, image] of images.entries()) {
    process.stdout.write(
      `[${index + 1}/${images.length}] ${image.variant}/${image.fileName} ... `
    );
    const result = await scanImage(options.baseUrl, image);
    results.push(result);
    console.log(
      result.ok
        ? `${result.match?.name || "no match"} (${result.match?.score || 0})`
        : `FAILED: ${result.error || result.statusCode}`
    );
  }

  const report = {
    createdAt: new Date().toISOString(),
    options,
    summary: summarize(results),
    results,
  };
  const reportPath = path.join(
    datasetDir,
    `benchmark-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report.summary, null, 2));
  console.log(`Report: ${reportPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
