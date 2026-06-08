// ╭──────────────────────────────╮
// │  Jobs Dashboard              │
// │  Lists captured scan jobs,   │
// │  images, OCR, and results.   │
// ╰──────────────────────────────╯

const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const JOB_ID_PATTERN = /^[a-f0-9]{12}$/;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function readJobs(ingestDir) {
  const entries = await fs.readdir(ingestDir, { withFileTypes: true }).catch(() => []);
  const jobs = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && JOB_ID_PATTERN.test(entry.name))
      .map(async (entry) => {
        try {
          const job = JSON.parse(
            await fs.readFile(path.join(ingestDir, entry.name, "job.json"), "utf8"),
          );
          return { ...job, id: entry.name };
        } catch (_error) {
          return null;
        }
      }),
  );

  return jobs
    .filter(Boolean)
    .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)));
}

function jobOcrText(job) {
  return job.result?.ocrText ?? job.diagnostics?.ocrText ?? "";
}

function jobMatch(job) {
  return job.result?.match ?? null;
}

function renderJob(job) {
  const ocrText = jobOcrText(job);
  const match = jobMatch(job);
  const statusClass = job.status === "completed" ? "ok" : job.status === "failed" ? "bad" : "warn";
  const createdAt = job.createdAt ? new Date(job.createdAt).toLocaleString() : "unknown";
  const confidence = Number.isFinite(match?.score) ? `${Math.round(match.score * 100)}%` : "—";
  const summary = match?.name || ocrText || job.error?.message || "No result";

  return `
    <article class="job">
      <button class="thumbnail" type="button" data-job-id="${job.id}" aria-label="View job ${job.id}">
        <img src="/jobs/${job.id}/image" alt="Captured scan ${job.id}" loading="lazy">
      </button>
      <div class="card-info">
        <div class="card-top"><span class="status ${statusClass}">${escapeHtml(job.status)}</span><b>${confidence}</b></div>
        <h2>${escapeHtml(summary)}</h2>
        <div class="meta"><span>${escapeHtml(job.id)}</span><time>${escapeHtml(createdAt)}</time></div>
      </div>
    </article>`;
}

function renderDashboard(jobs, config) {
  const cards = jobs.length
    ? jobs.map(renderJob).join("")
    : '<div class="empty">No captured jobs yet.</div>';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Segtori Jobs</title>
  <style>
    :root{color-scheme:dark;--bg:#0b1012;--panel:#12191d;--line:#2b373c;--text:#edf4ef;--muted:#98a9a2;--accent:#d4ff67;--bad:#ff8d8d;--warn:#ffca72}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
    button{font:inherit}header,main{width:min(1400px,94vw);margin:auto}header{padding:22px 0 16px;display:flex;justify-content:space-between;gap:20px;align-items:end;border-bottom:1px solid var(--line)}
    h1{margin:4px 0 0;font:700 clamp(1.6rem,3vw,2.4rem)/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}.sub,time,dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
    .header-tools{display:flex;align-items:center;gap:14px}.refresh,.close{border:1px solid var(--line);background:var(--panel);color:var(--text);padding:9px 12px;cursor:pointer;text-transform:uppercase;font-size:11px;letter-spacing:.08em}.refresh:hover,.close:hover{border-color:var(--accent);color:var(--accent)}
    main{padding:18px 0 50px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;align-items:start}.job{background:var(--panel);border:1px solid var(--line);min-width:0}
    .thumbnail{display:block;width:100%;aspect-ratio:1;border:0;border-bottom:1px solid var(--line);padding:0;background:#070a0b;cursor:pointer;overflow:hidden}.thumbnail img{width:100%;height:100%;display:block;object-fit:cover}.thumbnail:hover img{filter:brightness(1.08)}
    .card-info{padding:12px}.card-top,.meta{display:flex;justify-content:space-between;gap:12px;align-items:center}.card-top b{color:var(--accent);font-size:11px}.job h2{margin:10px 0 12px;font-size:.9rem;line-height:1.35;height:2.7em;overflow:hidden}.meta{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.05em}.meta time{font-size:10px;letter-spacing:.05em;white-space:nowrap}.status{display:inline-block;padding:2px 7px;border:1px solid currentColor;text-transform:uppercase;font-size:10px;letter-spacing:.08em}.ok{color:var(--accent)}.bad{color:var(--bad)}.warn{color:var(--warn)}.empty{padding:24px;border:1px solid var(--line)}
    dialog{width:min(1100px,94vw);max-height:92vh;padding:0;border:1px solid var(--line);background:var(--panel);color:var(--text)}dialog::backdrop{background:rgba(4,7,8,.82)}.modal-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.modal-head h2{margin:0;font-size:1rem;letter-spacing:.08em}.modal-body{display:grid;grid-template-columns:minmax(300px,55%) 1fr;max-height:calc(92vh - 55px)}.modal-image{min-height:320px;background:#070a0b;display:grid;place-items:center}.modal-image img{width:100%;height:100%;max-height:calc(92vh - 55px);object-fit:contain}.modal-details{padding:16px;overflow:auto}dl{display:grid;grid-template-columns:90px 1fr;gap:8px 14px;margin:0 0 18px}dt,dd{margin:0}.ocr{white-space:pre-wrap;word-break:break-word}.json-link{color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.08em}ol{list-style:none;margin:0;padding:0;display:grid;gap:4px}li{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid var(--line)}li b{color:var(--accent)}
    @media(max-width:760px){header{align-items:start;flex-direction:column}.header-tools{width:100%;justify-content:space-between}.modal-body{grid-template-columns:1fr;overflow:auto}.modal-image{min-height:240px}.modal-image img{max-height:50vh}}
  </style>
</head>
<body>
  <header>
    <div><div class="sub">Seglectic Tagged Object Recognition Interface</div><h1>Scan Jobs</h1></div>
    <div class="header-tools"><div class="sub">${jobs.length} jobs · ${escapeHtml(config.serviceName)}:${config.port}</div><button class="refresh" type="button">Refresh</button></div>
  </header>
  <main>${cards}</main>
  <dialog id="job-modal">
    <div class="modal-head"><h2 id="modal-title">Job</h2><button class="close" type="button">Close</button></div>
    <div class="modal-body">
      <div class="modal-image"><img id="modal-image" alt=""></div>
      <div class="modal-details"><dl id="modal-fields"></dl><a class="json-link" id="modal-json" href="#">View JSON</a></div>
    </div>
  </dialog>
  <script>
    const modal = document.querySelector("#job-modal");
    const fields = document.querySelector("#modal-fields");
    const addField = (label, value, className = "") => {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value ?? "—";
      detail.className = className;
      fields.append(term, detail);
    };
    const openJob = async (id) => {
      const response = await fetch("/api/jobs/" + id);
      const payload = await response.json();
      const job = payload.job;
      const match = job.result?.match;
      const candidates = job.result?.candidates ?? [];
      fields.replaceChildren();
      document.querySelector("#modal-title").textContent = id + " · " + job.status;
      document.querySelector("#modal-image").src = "/jobs/" + id + "/image";
      document.querySelector("#modal-image").alt = "Captured scan " + id;
      document.querySelector("#modal-json").href = "/api/jobs/" + id;
      addField("Created", job.createdAt);
      addField("Image", (job.image?.fileName ?? "none") + " · " + (job.image?.sizeBytes ?? 0).toLocaleString() + " B");
      addField("OCR", job.result?.ocrText ?? job.diagnostics?.ocrText ?? "No text recognized", "ocr");
      addField("Match", match?.name);
      addField("Item ID", match?.id);
      addField("Quantity", Number.isFinite(match?.quantity) ? String(match.quantity) : "—");
      addField("Confidence", Number.isFinite(match?.score) ? Math.round(match.score * 100) + "%" : "—");
      addField("Candidates", candidates.map((candidate) => candidate.name + " · " + Math.round((candidate.score ?? 0) * 100) + "%").join("\\n") || "None", "ocr");
      addField("Error", job.error?.message ?? "None");
      modal.showModal();
    };
    document.querySelector(".refresh").addEventListener("click", () => location.reload());
    document.querySelector(".close").addEventListener("click", () => modal.close());
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
    document.querySelectorAll(".thumbnail").forEach((button) => button.addEventListener("click", () => openJob(button.dataset.jobId)));
  </script>
</body>
</html>`;
}

function createJobsRouter(config) {
  const router = express.Router();
  const ingestDir = config.scanJobs.ingestDir;

  router.get("/", async (_request, response, next) => {
    try {
      response.type("html").send(renderDashboard(await readJobs(ingestDir), config));
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/jobs", async (_request, response, next) => {
    try {
      response.json({ ok: true, jobs: await readJobs(ingestDir) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/jobs/:id", async (request, response, next) => {
    if (!JOB_ID_PATTERN.test(request.params.id)) {
      response.status(404).json({ ok: false, error: "job not found" });
      return;
    }

    try {
      const job = JSON.parse(
        await fs.readFile(path.join(ingestDir, request.params.id, "job.json"), "utf8"),
      );
      response.json({ ok: true, job });
    } catch (error) {
      if (error.code === "ENOENT") {
        response.status(404).json({ ok: false, error: "job not found" });
        return;
      }
      next(error);
    }
  });

  router.get("/jobs/:id/image", async (request, response, next) => {
    if (!JOB_ID_PATTERN.test(request.params.id)) {
      response.sendStatus(404);
      return;
    }

    try {
      const jobDir = path.join(ingestDir, request.params.id);
      const job = JSON.parse(await fs.readFile(path.join(jobDir, "job.json"), "utf8"));
      const imageName = path.basename(job.image?.fileName || "");
      if (!imageName) {
        response.sendStatus(404);
        return;
      }
      response.sendFile(path.join(jobDir, imageName));
    } catch (error) {
      if (error.code === "ENOENT") {
        response.sendStatus(404);
        return;
      }
      next(error);
    }
  });

  return router;
}

module.exports = {
  createJobsRouter,
};
