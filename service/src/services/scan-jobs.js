// ╭──────────────────────────────╮
// │  Scan Job Store              │
// │  Persists each uploaded scan │
// │  under process/ingest with   │
// │  image and job metadata.     │
// ╰──────────────────────────────╯

const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

function shortJobId() {
  return randomUUID().replace(/-/g, "").slice(0, 12);
}

function imageExtensionFor(file) {
  const originalExtension = path.extname(file.originalname || "").toLowerCase();
  if (originalExtension) {
    return originalExtension;
  }

  if (file.mimetype === "image/png") {
    return ".png";
  }

  if (file.mimetype === "image/webp") {
    return ".webp";
  }

  return ".jpg";
}

function createScanJobStore(config) {
  const ingestDir = config.scanJobs.ingestDir;

  async function writeJobFile(jobDir, payload) {
    await fs.writeFile(
      path.join(jobDir, "job.json"),
      JSON.stringify(payload, null, 2) + "\n",
      "utf8"
    );
  }

  async function readJobFile(jobDir) {
    try {
      return JSON.parse(await fs.readFile(path.join(jobDir, "job.json"), "utf8"));
    } catch (_error) {
      return {};
    }
  }

  return {
    async createJob(file) {
      const id = shortJobId();
      const jobDir = path.join(ingestDir, id);
      const imageName = `image${imageExtensionFor(file)}`;
      const imagePath = path.join(jobDir, imageName);
      const createdAt = new Date().toISOString();

      await fs.mkdir(jobDir, { recursive: true });
      await fs.writeFile(imagePath, file.buffer);

      file.toriImagePath = imagePath;

      const job = {
        id,
        jobDir,
        imageName,
        createdAt,
      };

      await writeJobFile(jobDir, {
        id,
        status: "ingested",
        createdAt,
        updatedAt: createdAt,
        image: {
          fileName: imageName,
          mimeType: file.mimetype,
          sizeBytes: file.size,
          originalName: file.originalname || "",
        },
      });

      return job;
    },

    async completeJob(job, result) {
      const updatedAt = new Date().toISOString();
      const existing = await readJobFile(job.jobDir);
      await writeJobFile(job.jobDir, {
        ...existing,
        id: job.id,
        status: "completed",
        createdAt: job.createdAt,
        updatedAt,
        result,
      });
    },

    async failJob(job, error, diagnostics = {}) {
      const updatedAt = new Date().toISOString();
      const existing = await readJobFile(job.jobDir);

      await writeJobFile(job.jobDir, {
        ...existing,
        id: job.id,
        status: "failed",
        updatedAt,
        diagnostics,
        error: {
          message: error.message || "scan job failed",
        },
      });
    },
  };
}

module.exports = {
  createScanJobStore,
};
