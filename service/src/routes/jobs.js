// ╭──────────────────────────────╮
// │  Jobs Dashboard              │
// │  Pages captured scan jobs    │
// │  and serves the live gallery.│
// ╰──────────────────────────────╯

const express = require("express");
const fs = require("fs/promises");
const path = require("path");

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const JOB_ID_PATTERN = /^[a-f0-9]{12}$/;

function compareJobs(left, right) {
  return (
    String(right.createdAt).localeCompare(String(left.createdAt)) ||
    String(right.id).localeCompare(String(left.id))
  );
}

function decodeCursor(value) {
  if (!value) {
    return null;
  }

  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return cursor.createdAt && JOB_ID_PATTERN.test(cursor.id) ? cursor : null;
  } catch (_error) {
    return null;
  }
}

function encodeCursor(job) {
  return Buffer.from(
    JSON.stringify({ createdAt: job.createdAt, id: job.id }),
    "utf8",
  ).toString("base64url");
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

  return jobs.filter(Boolean).sort(compareJobs);
}

function pageJobs(jobs, requestedLimit, cursorValue) {
  const limit = Math.min(
    Math.max(Number.parseInt(requestedLimit, 10) || DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );
  const cursor = decodeCursor(cursorValue);
  const start = cursor
    ? jobs.findIndex((job) => compareJobs(job, cursor) > 0)
    : 0;
  const page = start < 0 ? [] : jobs.slice(start, start + limit);
  const hasMore = start >= 0 && start + page.length < jobs.length;

  return {
    jobs: page,
    nextCursor: hasMore ? encodeCursor(page.at(-1)) : null,
  };
}

function renderDashboard(config) {
  const airtableBaseId = config.airtable.baseId || "";
  const airtableTableId = config.airtable.tableId || "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Segtori Jobs</title>
  <style>
    :root{color-scheme:dark;--bg:#0b1012;--panel:#12191d;--line:#2b373c;--text:#edf4ef;--muted:#98a9a2;--accent:#d4ff67;--bad:#ff8d8d;--warn:#ffca72}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
    button{font:inherit}header,main,.feed-state{width:min(1400px,94vw);margin:auto}header{padding:22px 0 16px;display:flex;justify-content:space-between;gap:20px;align-items:end;border-bottom:1px solid var(--line)}
    h1{margin:4px 0 0;font:700 clamp(1.6rem,3vw,2.4rem)/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.08em}.sub,time,dt{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}
    .header-tools{display:flex;align-items:center;gap:14px}.live{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--muted);margin-right:7px}.live.connected{background:var(--accent);animation:pulse 1.8s ease-in-out infinite}.close{border:1px solid var(--line);background:var(--panel);color:var(--text);padding:9px 12px;cursor:pointer;text-transform:uppercase;font-size:11px;letter-spacing:.08em}.close:hover{border-color:var(--accent);color:var(--accent)}
    main{padding:18px 0 20px;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;align-items:start}.job{height:420px;background:var(--panel);border:1px solid var(--line);min-width:0;display:flex;flex-direction:column}.job.updated{animation:flash 1.2s ease-out}
    .thumbnail{position:relative;flex:none;display:block;width:100%;height:240px;border:0;border-bottom:1px solid var(--line);padding:0;background:#070a0b;cursor:pointer;overflow:hidden}.thumbnail img{width:100%;height:100%;display:block;object-fit:cover}.thumbnail:hover img{filter:brightness(1.08)}
    .card-info{flex:1;min-height:0;padding:12px;position:relative;display:flex;flex-direction:column}.card-top,.meta{display:flex;justify-content:space-between;gap:12px;align-items:center;min-width:0}.card-top b{color:var(--accent);font-size:11px;white-space:nowrap}.card-title{display:flex;align-items:flex-start;gap:8px;margin:10px 0 12px;min-height:2.7em;flex:none}.card-title h2{margin:0;font-size:.9rem;line-height:1.35;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.card-title a{flex:none;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap;padding-top:2px}.card-title a:hover{color:var(--accent)}.card-right{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:0;flex:none}.card-qty{color:var(--accent);font-size:11px;letter-spacing:.08em;text-transform:uppercase;white-space:nowrap}.card-link{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}.card-link:hover{color:var(--accent)}.card-confidence{position:absolute;left:8px;top:8px;z-index:2;pointer-events:none;padding:5px 7px;border:1px solid rgba(0,0,0,.9);background:rgba(0,0,0,.92);color:var(--accent);font-size:11px;white-space:nowrap}.card-confidence[data-empty="true"]{background:rgba(0,0,0,.78);color:var(--muted)}.card-foot{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;padding-top:10px;margin-top:auto;flex:none}.card-id{display:flex;flex-direction:column;gap:2px;min-width:0}.card-id span{font-size:10px;letter-spacing:.05em}.card-date{color:var(--muted);font-size:10px;letter-spacing:.05em;text-transform:uppercase}.card-delete{border:1px solid var(--line);background:var(--panel);color:var(--muted);display:inline-grid;place-items:center;width:28px;height:28px;border-radius:999px;cursor:pointer;flex:none}.card-delete:hover{border-color:var(--bad);color:var(--bad)}.status{display:inline-block;padding:2px 7px;border:1px solid currentColor;text-transform:uppercase;font-size:10px;letter-spacing:.08em}.ok{color:var(--accent)}.bad{color:var(--bad)}.warn{color:var(--warn)}.empty{padding:24px;border:1px solid var(--line)}
    .feed-state{padding:10px 0 50px;color:var(--muted);text-align:center;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.dropzone{position:fixed;inset:0;z-index:100;display:grid;place-items:center;pointer-events:none;background:rgba(11,16,18,.88);border:3px dashed var(--accent);color:var(--accent);font:700 clamp(1.2rem,4vw,2.4rem)/1 Arial,sans-serif;text-transform:uppercase;letter-spacing:.12em;opacity:0;transition:opacity .15s}.dropzone.active{opacity:1}
    dialog{width:min(1100px,94vw);max-height:92vh;padding:0;border:1px solid var(--line);background:var(--panel);color:var(--text)}dialog::backdrop{background:rgba(4,7,8,.82)}.modal-head{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--line)}.modal-head h2{margin:0;font-size:1rem;letter-spacing:.08em}.modal-body{display:grid;grid-template-columns:minmax(300px,55%) 1fr;max-height:calc(92vh - 55px)}.modal-image{min-height:320px;background:#070a0b;display:grid;place-items:center}.modal-image img{width:100%;height:100%;max-height:calc(92vh - 55px);object-fit:contain}.modal-details{padding:16px;overflow:auto}dl{display:grid;grid-template-columns:90px 1fr;gap:8px 14px;margin:0 0 18px}dt,dd{margin:0}.ocr{white-space:pre-wrap;word-break:break-word}.json-link{color:var(--accent);font-size:11px;text-transform:uppercase;letter-spacing:.08em}
    @keyframes flash{0%{border-color:var(--accent)}100%{border-color:var(--line)}}@keyframes pulse{0%,100%{opacity:1;box-shadow:0 0 0 0 rgba(212,255,103,.55)}50%{opacity:.55;box-shadow:0 0 0 5px rgba(212,255,103,0)}}@media(max-width:760px){header{align-items:start;flex-direction:column}.header-tools{width:100%;justify-content:space-between}.modal-body{grid-template-columns:1fr;overflow:auto}.modal-image{min-height:240px}.modal-image img{max-height:50vh}}
  </style>
</head>
<body>
  <div class="dropzone" id="dropzone" aria-hidden="true">Drop images to scan</div>
  <header>
    <div><div class="sub">Seglectic Tagged Object Recognition Interface</div><h1>Scan Jobs</h1></div>
    <div class="header-tools"><div class="sub"><span class="live"></span><span id="connection">Connecting</span> · <span id="loaded">0</span> loaded · ${config.serviceName}:${config.port}</div></div>
  </header>
  <main id="jobs"></main>
  <div class="feed-state" id="feed-state">Loading scans</div>
  <dialog id="job-modal">
    <div class="modal-head"><h2 id="modal-title">Job</h2><button class="close" type="button">Close</button></div>
    <div class="modal-body">
      <div class="modal-image"><img id="modal-image" alt=""></div>
      <div class="modal-details"><dl id="modal-fields"></dl><a class="json-link" id="modal-json" href="#">View JSON</a></div>
    </div>
  </dialog>
  <script>
    const PAGE_SIZE = ${DEFAULT_PAGE_SIZE};
    const AIRTABLE_BASE_ID = ${JSON.stringify(airtableBaseId)};
    const AIRTABLE_TABLE_ID = ${JSON.stringify(airtableTableId)};
    const jobs = document.querySelector("#jobs");
    const feedState = document.querySelector("#feed-state");
    const loaded = document.querySelector("#loaded");
    const modal = document.querySelector("#job-modal");
    const fields = document.querySelector("#modal-fields");
    let nextCursor = null;
    let loading = false;
    let hasMore = true;
    let dragDepth = 0;

    const formatMs = (value) => Number.isFinite(value) && value > 0
      ? (value >= 1000 ? (value / 1000).toFixed(2) + "s" : value + "ms")
      : "—";
    const addField = (label, value, className = "") => {
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = label;
      detail.textContent = value ?? "—";
      detail.className = className;
      fields.append(term, detail);
    };
    const text = (tag, value, className = "") => {
      const node = document.createElement(tag);
      node.textContent = value;
      node.className = className;
      return node;
    };
    const confidenceColor = (score) => {
      const clamped = Math.max(0, Math.min(1, Number(score) || 0));
      const red = Math.round(255 * (1 - clamped));
      const green = Math.round(255 * clamped);
      return "rgb(" + red + "," + green + ",64)";
    };
    const airtableLinkFor = (match) => {
      if (!match?.recordId || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) {
        return "";
      }

      return "https://airtable.com/" + AIRTABLE_BASE_ID + "/" + AIRTABLE_TABLE_ID + "/" + match.recordId;
    };
    const createCard = (job) => {
      const match = job.result?.match;
      const ocrText = job.result?.ocrText ?? job.diagnostics?.ocrText ?? "";
      const statusClass = job.status === "completed" ? "ok" : job.status === "failed" ? "bad" : "warn";
      const confidence = Number.isFinite(match?.score)
        ? Math.round(match.score * 100) + "%"
        : job.status === "completed" ? "No match" : "—";
      const confidenceScore = Number.isFinite(match?.score) ? match.score : 0;
      const quantity = Number.isFinite(match?.quantity) ? String(match.quantity) : "—";
      const title = match
        ? (match.partNumber || match.name || "No part number")
        : (job.status === "completed" ? (ocrText || "No text recognized") : "Processing image");
      const titleLink = airtableLinkFor(match);
      const article = document.createElement("article");
      const button = document.createElement("button");
      const image = document.createElement("img");
      const info = document.createElement("div");
      const top = document.createElement("div");
      const meta = document.createElement("div");
      const titleLine = document.createElement("div");
      const rightColumn = document.createElement("div");
      const confidenceLabel = text("div", confidence, "card-confidence");
      const foot = document.createElement("div");
      const idBlock = document.createElement("div");
      const deleteButton = document.createElement("button");
      const svgNS = "http://www.w3.org/2000/svg";
      const deleteIcon = document.createElementNS(svgNS, "svg");
      const deletePath = document.createElementNS(svgNS, "path");
      article.className = "job";
      article.dataset.jobId = job.id;
      article.dataset.updatedAt = job.updatedAt ?? job.createdAt ?? "";
      confidenceLabel.style.color = confidenceColor(confidenceScore);
      confidenceLabel.dataset.empty = Number.isFinite(match?.score) ? "false" : "true";
      if (!Number.isFinite(match?.score)) {
        confidenceLabel.style.borderColor = "rgba(255,255,255,.18)";
      }
      button.className = "thumbnail";
      button.type = "button";
      button.setAttribute("aria-label", "View job " + job.id);
      button.addEventListener("click", () => openJob(job.id));
      image.src = "/jobs/" + job.id + "/image";
      image.alt = "Captured scan " + job.id;
      image.loading = "lazy";
      button.append(image, confidenceLabel);
      info.className = "card-info";
      top.className = "card-top";
      top.append(text("span", job.status, "status " + statusClass));
      titleLine.className = "card-title";
      titleLine.append(text("h2", title));
      rightColumn.className = "card-right";
      rightColumn.append(text("span", quantity, "card-qty"));
      if (titleLink) {
        const link = document.createElement("a");
        link.href = titleLink;
        link.target = "_blank";
        link.rel = "noreferrer";
        link.textContent = "[AT LINK]";
        link.className = "card-link";
        rightColumn.append(link);
      }
      foot.className = "card-foot";
      idBlock.className = "card-id";
      idBlock.append(text("span", job.id), text("span", job.createdAt ? new Date(job.createdAt).toLocaleString() : "unknown", "card-date"));
      meta.className = "meta";
      meta.append(text("span", formatMs(job.deviceTimings?.roundTripMs ?? job.result?.timings?.serverTotalMs)));
      deleteButton.className = "card-delete";
      deleteButton.type = "button";
      deleteButton.title = "Delete job";
      deleteButton.setAttribute("aria-label", "Delete job " + job.id);
      deleteButton.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!confirm("Delete job " + job.id + "?")) return;
        const response = await fetch("/api/jobs/" + job.id, { method: "DELETE" });
        if (response.ok) {
          article.remove();
          loaded.textContent = jobs.childElementCount;
        }
      });
      deleteIcon.setAttribute("viewBox", "0 0 24 24");
      deleteIcon.setAttribute("aria-hidden", "true");
      deletePath.setAttribute("d", "M9 3.5h6M5 6.5h14M8 6.5l.6 11.2c.1 1.1.9 1.8 2 1.8h2.8c1.1 0 1.9-.7 2-1.8L16 6.5M10 10.2v5.3M14 10.2v5.3");
      deletePath.setAttribute("fill", "none");
      deletePath.setAttribute("stroke", "currentColor");
      deletePath.setAttribute("stroke-width", "1.6");
      deletePath.setAttribute("stroke-linecap", "round");
      deletePath.setAttribute("stroke-linejoin", "round");
      deleteIcon.append(deletePath);
      deleteButton.append(deleteIcon);
      foot.append(idBlock, deleteButton);
      info.append(top, titleLine, rightColumn, foot);
      article.append(button, info);
      return article;
    };
    const upsertJob = (job, prepend = false) => {
      const existing = jobs.querySelector('[data-job-id="' + job.id + '"]');
      if (existing && existing.dataset.updatedAt > (job.updatedAt ?? job.createdAt ?? "")) return;
      const card = createCard(job);
      if (existing) {
        existing.replaceWith(card);
      } else if (prepend) {
        jobs.prepend(card);
      } else {
        jobs.append(card);
      }
      card.classList.add("updated");
      loaded.textContent = jobs.childElementCount;
    };
    const loadMore = async () => {
      if (loading || !hasMore) return;
      loading = true;
      feedState.textContent = "Loading scans";
      try {
        const query = new URLSearchParams({ limit: PAGE_SIZE });
        if (nextCursor) query.set("before", nextCursor);
        const response = await fetch("/api/jobs?" + query);
        const payload = await response.json();
        payload.jobs.forEach((job) => upsertJob(job));
        nextCursor = payload.nextCursor;
        hasMore = Boolean(nextCursor);
        feedState.textContent = hasMore ? "Scroll for older scans" : (jobs.childElementCount ? "All scans loaded" : "No captured jobs yet");
      } catch (_error) {
        feedState.textContent = "Could not load scans";
      } finally {
        loading = false;
      }
    };
    const openJob = async (id) => {
      const response = await fetch("/api/jobs/" + id);
      const { job } = await response.json();
      const match = job.result?.match;
      const candidates = job.result?.candidates ?? [];
      const timings = job.result?.timings ?? {};
      const deviceTimings = job.deviceTimings ?? {};
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
      addField("Operator Roundtrip", formatMs(deviceTimings.roundTripMs));
      addField("Capture", formatMs(deviceTimings.captureMs));
      addField("Upload + Server", formatMs(deviceTimings.uploadAndServerMs));
      addField("Outside Server Timer", formatMs(Math.max(0, (deviceTimings.uploadAndServerMs || 0) - (timings.serverTotalMs || 0))));
      addField("Socket Connect", formatMs(deviceTimings.uploadConnectMs));
      addField("Image Write", formatMs(deviceTimings.uploadWriteMs));
      addField("Response Wait", formatMs(deviceTimings.responseWaitMs));
      addField("Server Total", formatMs(timings.serverTotalMs));
      addField("Upload Ingest", formatMs(timings.uploadIngestMs));
      addField("Job Persist", formatMs(timings.jobPersistMs));
      addField("OCR", formatMs(timings.ocrMs));
      addField("Inventory", formatMs(timings.inventoryMs));
      addField("Matching", formatMs(timings.matchingMs));
      addField("Candidates", candidates.map((candidate) => candidate.name + " · " + Math.round((candidate.score ?? 0) * 100) + "%").join("\\n") || "None", "ocr");
      addField("Error", job.error?.message ?? "None");
      modal.showModal();
    };
    const connect = () => {
      const socket = new WebSocket((location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/ws/jobs");
      socket.addEventListener("open", () => {
        document.querySelector(".live").classList.add("connected");
        document.querySelector("#connection").textContent = "Live";
      });
      socket.addEventListener("message", (event) => {
        const message = JSON.parse(event.data);
        if (message.type === "job.updated") upsertJob(message.job, true);
      });
      socket.addEventListener("close", () => {
        document.querySelector(".live").classList.remove("connected");
        document.querySelector("#connection").textContent = "Reconnecting";
        setTimeout(connect, 1500);
      });
    };
    const uploadImages = async (files) => {
      const images = [...files].filter((file) => file.type.startsWith("image/"));
      if (!images.length) {
        feedState.textContent = "Drop image files to scan";
        return;
      }

      feedState.textContent = "Uploading " + images.length + (images.length === 1 ? " image" : " images");
      const results = await Promise.allSettled(images.map(async (image) => {
        const body = new FormData();
        body.append("image", image, image.name);
        const response = await fetch("/api/scan", { method: "POST", body });
        if (!response.ok) throw new Error("upload failed");
      }));
      const failed = results.filter((result) => result.status === "rejected").length;
      feedState.textContent = failed ? failed + " upload" + (failed === 1 ? "" : "s") + " failed" : "Uploads complete";
    };
    const dropzone = document.querySelector("#dropzone");
    window.addEventListener("dragenter", (event) => {
      event.preventDefault();
      dragDepth += 1;
      dropzone.classList.add("active");
    });
    window.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    });
    window.addEventListener("dragleave", (event) => {
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropzone.classList.remove("active");
    });
    window.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      dropzone.classList.remove("active");
      uploadImages(event.dataTransfer?.files ?? []);
    });

    document.querySelector(".close").addEventListener("click", () => modal.close());
    modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
    new IntersectionObserver((entries) => { if (entries[0].isIntersecting) loadMore(); }, { rootMargin: "500px" }).observe(feedState);
    connect();
    loadMore();
  </script>
</body>
</html>`;
}

function createJobsRouter(config, scanJobStore = null) {
  const router = express.Router();
  const ingestDir = config.scanJobs.ingestDir;

  router.get("/", (_request, response) => {
    response.type("html").send(renderDashboard(config));
  });

  router.get("/api/jobs", async (request, response, next) => {
    try {
      response.json({ ok: true, ...pageJobs(await readJobs(ingestDir), request.query.limit, request.query.before) });
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
      const job = JSON.parse(await fs.readFile(path.join(ingestDir, request.params.id, "job.json"), "utf8"));
      response.json({ ok: true, job });
    } catch (error) {
      if (error.code === "ENOENT") {
        response.status(404).json({ ok: false, error: "job not found" });
        return;
      }
      next(error);
    }
  });

  router.delete("/api/jobs/:id", async (request, response, next) => {
    if (!JOB_ID_PATTERN.test(request.params.id)) {
      response.status(404).json({ ok: false, error: "job not found" });
      return;
    }

    try {
      const jobDir = path.join(ingestDir, request.params.id);
      const job = JSON.parse(await fs.readFile(path.join(jobDir, "job.json"), "utf8"));
      if (scanJobStore?.deleteJob) {
        await scanJobStore.deleteJob({ jobDir });
      } else {
        await fs.rm(jobDir, { recursive: true, force: true });
      }
      response.json({ ok: true, job });
    } catch (error) {
      if (error.code === "ENOENT") {
        response.status(404).json({ ok: false, error: "job not found" });
        return;
      }
      next(error);
    }
  });

  router.delete("/api/jobs/:id", async (request, response, next) => {
    if (!JOB_ID_PATTERN.test(request.params.id)) {
      response.status(404).json({ ok: false, error: "job not found" });
      return;
    }

    try {
      const jobPath = path.join(ingestDir, request.params.id, "job.json");
      const job = JSON.parse(await fs.readFile(jobPath, "utf8"));
      await fs.rm(path.join(ingestDir, request.params.id), { recursive: true, force: true });
      response.json({ ok: true, job });
    } catch (error) {
      if (error.code === "ENOENT") {
        response.status(404).json({ ok: false, error: "job not found" });
        return;
      }
      next(error);
    }
  });

  router.post("/api/jobs/:id/timings", async (request, response, next) => {
    if (!JOB_ID_PATTERN.test(request.params.id)) {
      response.status(404).json({ ok: false, error: "job not found" });
      return;
    }

    try {
      const jobPath = path.join(ingestDir, request.params.id, "job.json");
      const job = JSON.parse(await fs.readFile(jobPath, "utf8"));
      const deviceTimings = request.body?.deviceTimings ?? {};
      await fs.writeFile(jobPath, `${JSON.stringify({ ...job, deviceTimings }, null, 2)}\n`, "utf8");
      response.json({ ok: true });
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
  pageJobs,
};
