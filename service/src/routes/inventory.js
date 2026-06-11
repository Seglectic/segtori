// ╭──────────────────────────────╮
// │  Inventory Dashboard         │
// │  Serves the primary local    │
// │  inventory view at the root. │
// ╰──────────────────────────────╯

const express = require("express");

function renderInventoryDashboard(config) {
  const airtableBaseId = config.airtable.baseId || "";
  const airtableTableId = config.airtable.tableId || "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Segtori Inventory</title>
  <style>
    :root{--bg:#0a0f11;--bg2:#11181b;--panel:#11181b;--panel2:#182126;--line:#273237;--line2:#36515b;--text:#eef5f2;--muted:#91a39c;--accent:#d5ff5f;--accentSoft:rgba(213,255,95,.12);--warn:#ffc86a;--danger:#ff7f6e;--shadow:0 28px 80px rgba(0,0,0,.35)}
    *{box-sizing:border-box}html{background:radial-gradient(circle at top left, rgba(213,255,95,.06), transparent 32%),linear-gradient(180deg, #0d1417 0%, var(--bg) 32%, #081012 100%)}body{margin:0;color:var(--text);background:linear-gradient(90deg, rgba(255,255,255,.015) 1px, transparent 1px) 0 0/36px 36px,linear-gradient(rgba(255,255,255,.015) 1px, transparent 1px) 0 0/36px 36px;font:14px/1.45 "Bahnschrift","DIN Alternate","Segoe UI Variable","Segoe UI",sans-serif;min-height:100vh}
    button,input{font:inherit}a{color:inherit}.shell{width:min(1440px,94vw);margin:0 auto;padding:28px 0 40px}.mast{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:end;padding-bottom:18px;border-bottom:1px solid var(--line)}.eyebrow,.meta,.metric-label,.grid-head,.empty-note{color:var(--muted);text-transform:uppercase;letter-spacing:.16em;font-size:11px}h1{margin:6px 0 0;font:700 clamp(1.9rem,4vw,3.7rem)/.92 "Bahnschrift","DIN Alternate","Segoe UI Variable","Segoe UI",sans-serif;letter-spacing:.08em;text-transform:uppercase}.subtitle{margin-top:10px;max-width:68ch;color:#bfd0c9;font-size:14px}
    .nav{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;align-items:center}.nav a,.nav button{border:1px solid var(--line);background:linear-gradient(180deg, rgba(255,255,255,.03), rgba(255,255,255,.01));color:var(--text);padding:11px 14px;text-decoration:none;text-transform:uppercase;letter-spacing:.14em;font-size:11px;cursor:pointer}.nav a.active{border-color:var(--accent);color:var(--accent);box-shadow:inset 0 0 0 1px rgba(213,255,95,.3)}
    .hero{margin-top:22px;display:grid;grid-template-columns:1.6fr .9fr;gap:14px}.panel{position:relative;background:linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));border:1px solid var(--line);box-shadow:var(--shadow);overflow:hidden}.panel::before{content:"";position:absolute;inset:0 auto auto 0;width:140px;height:1px;background:linear-gradient(90deg, var(--accent), transparent)}.hero-copy{padding:18px 18px 20px}.hero-title{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}.hero-title b{font-size:1.15rem;letter-spacing:.08em;text-transform:uppercase}.chip{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid var(--line2);background:var(--accentSoft);color:var(--accent);text-transform:uppercase;letter-spacing:.14em;font-size:11px}.chip.warn{color:var(--warn);background:rgba(255,200,106,.08);border-color:rgba(255,200,106,.35)}.hero-copy p{margin:0;color:#b7c8c1;max-width:58ch}
    .metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}.metric{padding:14px;border:1px solid var(--line);background:rgba(255,255,255,.02);min-height:90px}.metric strong{display:block;margin-top:6px;font:700 clamp(1.2rem,3vw,2.2rem)/1 "Bahnschrift","DIN Alternate","Segoe UI Variable","Segoe UI",sans-serif;letter-spacing:.05em}
    .hero-side{padding:18px;display:flex;flex-direction:column;gap:14px;justify-content:space-between}.hero-side dl{margin:0;display:grid;grid-template-columns:110px 1fr;gap:8px 10px}.hero-side dt{color:var(--muted);text-transform:uppercase;letter-spacing:.14em;font-size:11px}.hero-side dd{margin:0}.hero-side .status{color:var(--accent);text-transform:uppercase;letter-spacing:.16em;font-size:11px}.hero-side .status.warn{color:var(--warn)}
    .toolbar{margin-top:14px;display:grid;grid-template-columns:minmax(220px,1fr) auto;gap:12px;align-items:center}.search{width:100%;border:1px solid var(--line);background:#0d1417;color:var(--text);padding:14px 15px;outline:none}.search:focus{border-color:var(--accent)}.toolbar-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end}.toolbar-actions button{border:1px solid var(--line);background:var(--panel);color:var(--text);padding:13px 14px;cursor:pointer;text-transform:uppercase;letter-spacing:.14em;font-size:11px}.toolbar-actions button:hover{border-color:var(--accent);color:var(--accent)}.toolbar-actions button:disabled{opacity:.45;cursor:default;border-color:var(--line);color:var(--muted)}
    .inventory{margin-top:14px;border:1px solid var(--line);background:rgba(255,255,255,.02);overflow:hidden}.grid-head,.grid-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) minmax(100px,.7fr) auto;gap:14px;align-items:center;padding:14px 16px}.grid-head{border-bottom:1px solid var(--line);background:rgba(255,255,255,.03)}.grid-row{border-top:1px solid rgba(255,255,255,.04);transition:background .16s ease}.grid-row:first-child{border-top:0}.grid-row:hover{background:rgba(255,255,255,.02)}
    .primary{min-width:0;display:flex;flex-direction:column;gap:5px}.code{color:var(--accent);font:700 13px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.name{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.detail{color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.qty{display:flex;align-items:center;gap:10px;justify-content:flex-start}.qty strong{font:700 1.6rem/1 "Bahnschrift","DIN Alternate","Segoe UI Variable","Segoe UI",sans-serif;letter-spacing:.04em}.row-actions{display:flex;align-items:center;gap:8px;justify-content:flex-end;flex-wrap:wrap}
    .adjust{width:38px;height:38px;border:1px solid var(--line);background:var(--panel2);color:var(--text);cursor:pointer;font-size:18px;line-height:1}.adjust:hover{border-color:var(--accent);color:var(--accent)}.adjust[disabled]{display:none}.row-link{border:1px solid var(--line);padding:9px 11px;text-decoration:none;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;font-size:10px;white-space:nowrap}.row-link:hover{border-color:var(--accent);color:var(--accent)}.empty{padding:26px 18px;color:var(--muted);border-top:1px solid rgba(255,255,255,.04)}.pending{opacity:.6;pointer-events:none}
    @media(max-width:980px){.hero{grid-template-columns:1fr}.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:760px){.shell{width:min(100vw,94vw)}.mast{grid-template-columns:1fr}.nav{justify-content:flex-start}.toolbar{grid-template-columns:1fr}.toolbar-actions{justify-content:flex-start}.metrics{grid-template-columns:1fr}.grid-head{display:none}.grid-row{grid-template-columns:1fr;gap:10px;align-items:start}.qty,.row-actions{justify-content:flex-start}.row-actions{padding-top:4px}}
  </style>
</head>
<body>
  <div class="shell">
    <header class="mast">
      <div>
        <div class="eyebrow">Seglectic Tagged Object Recognition Interface</div>
        <h1>Inventory Console</h1>
        <div class="subtitle">Browse the active inventory backend, inspect stock at a glance, and use the same control surface for Airtable today or the local SQLite backend in Phase 4.</div>
      </div>
      <nav class="nav" aria-label="Dashboard navigation">
        <a class="active" href="/">Inventory</a>
        <a href="/log">Scan Log</a>
      </nav>
    </header>
    <section class="hero">
      <section class="panel hero-copy">
        <div class="hero-title">
          <b>Active Inventory Surface</b>
          <span class="chip" id="backend-chip">Loading backend</span>
          <span class="chip warn" id="mode-chip">Checking mode</span>
        </div>
        <p id="hero-copy">Loading inventory status and items.</p>
        <div class="metrics">
          <div class="metric"><div class="metric-label">Items</div><strong id="metric-items">0</strong></div>
          <div class="metric"><div class="metric-label">Visible Qty</div><strong id="metric-qty">0</strong></div>
          <div class="metric"><div class="metric-label">Filtered</div><strong id="metric-filtered">0</strong></div>
        </div>
      </section>
      <aside class="panel hero-side">
        <dl>
          <dt>Service</dt><dd>${config.serviceName}:${config.port}</dd>
          <dt>OCR</dt><dd>${config.ocr.backend}</dd>
          <dt>Inventory</dt><dd id="backend-name">Loading</dd>
          <dt>Writes</dt><dd id="write-state" class="status warn">Checking</dd>
        </dl>
        <div class="empty-note">Airtable stays view-only here. Quantity controls appear automatically when the local backend exposes writes.</div>
      </aside>
    </section>
    <section class="toolbar">
      <input id="search" class="search" type="search" placeholder="Search part number, name, alias, or item id" autocomplete="off">
      <div class="toolbar-actions">
        <button type="button" id="refresh">Refresh</button>
        <button type="button" id="create-item" disabled>New Item</button>
      </div>
    </section>
    <section class="inventory panel">
      <div class="grid-head"><div>Item</div><div>Description</div><div>Quantity</div><div>Actions</div></div>
      <div id="rows"></div>
    </section>
  </div>
  <script>
    const AIRTABLE_BASE_ID = ${JSON.stringify(airtableBaseId)};
    const AIRTABLE_TABLE_ID = ${JSON.stringify(airtableTableId)};
    const rows = document.querySelector("#rows");
    const search = document.querySelector("#search");
    const refreshButton = document.querySelector("#refresh");
    const createItemButton = document.querySelector("#create-item");
    let state = { items: [], filtered: [], capabilities: null, query: "" };
    const formatNumber = (value) => Number.isFinite(value) ? value.toLocaleString() : "0";
    function airtableLinkFor(item) {
      if (!item?.recordId || !AIRTABLE_BASE_ID || !AIRTABLE_TABLE_ID) return "";
      return "https://airtable.com/" + AIRTABLE_BASE_ID + "/" + AIRTABLE_TABLE_ID + "/" + item.recordId;
    }
    function updateSummary() {
      const totalQuantity = state.filtered.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      document.querySelector("#metric-items").textContent = formatNumber(state.items.length);
      document.querySelector("#metric-filtered").textContent = formatNumber(state.filtered.length);
      document.querySelector("#metric-qty").textContent = formatNumber(totalQuantity);
    }
    function setCapabilityView(capabilities) {
      const backendLabel = capabilities?.label || "Unknown";
      const canAdjust = Boolean(capabilities?.canAdjustQuantity);
      const canCreate = Boolean(capabilities?.canCreateItems);
      document.querySelector("#backend-chip").textContent = backendLabel;
      document.querySelector("#backend-name").textContent = backendLabel;
      document.querySelector("#mode-chip").textContent = canAdjust ? "Writable" : "Read only";
      document.querySelector("#write-state").textContent = canAdjust ? "Enabled" : "Disabled";
      document.querySelector("#write-state").className = "status" + (canAdjust ? "" : " warn");
      document.querySelector("#hero-copy").textContent = canAdjust
        ? "This backend accepts local quantity changes directly from the inventory console."
        : "This backend is currently shown in safe read-only mode. Quantity edits stay hidden until the active backend supports them.";
      createItemButton.disabled = !canCreate;
    }
    function sortItems(items) {
      return [...items].sort((left, right) => {
        const leftCode = String(left.partNumber || left.id || "").toLowerCase();
        const rightCode = String(right.partNumber || right.id || "").toLowerCase();
        return leftCode.localeCompare(rightCode) || String(left.name || "").localeCompare(String(right.name || ""), undefined, { sensitivity: "base" });
      });
    }
    function buildDescription(item) {
      const detail = [item.secondaryName, (item.aliases || []).slice(0, 3).join(" · ")].filter(Boolean).join(" · ");
      return detail || "No secondary label";
    }
    async function adjustQuantity(item, delta, trigger) {
      if (!state.capabilities?.canAdjustQuantity) return;
      const nextQuantity = Math.max(0, Number(item.quantity || 0) + delta);
      const row = trigger.closest(".grid-row");
      row.classList.add("pending");
      try {
        const response = await fetch("/api/items/" + encodeURIComponent(item.id) + "/quantity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity: nextQuantity }),
        });
        if (!response.ok) throw new Error("Quantity update failed");
        item.quantity = nextQuantity;
        filterItems();
      } catch (_error) {
        row.classList.remove("pending");
      }
    }
    function renderRows() {
      rows.replaceChildren();
      if (!state.filtered.length) {
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = state.items.length ? "No items match the current filter." : "No inventory items are available from the active backend.";
        rows.append(empty);
        return;
      }
      state.filtered.forEach((item) => {
        const row = document.createElement("article");
        const primary = document.createElement("div");
        const description = document.createElement("div");
        const quantity = document.createElement("div");
        const actions = document.createElement("div");
        const code = document.createElement("div");
        const name = document.createElement("div");
        const detail = document.createElement("div");
        const qtyValue = document.createElement("strong");
        const minus = document.createElement("button");
        const plus = document.createElement("button");
        const externalUrl = airtableLinkFor(item);
        row.className = "grid-row";
        primary.className = "primary";
        code.className = "code";
        name.className = "name";
        detail.className = "detail";
        quantity.className = "qty";
        actions.className = "row-actions";
        code.textContent = item.partNumber || item.id || "Uncoded item";
        name.textContent = item.name || "Unnamed item";
        detail.textContent = buildDescription(item);
        description.textContent = item.secondaryName || (item.aliases || []).join(", ") || "No secondary data";
        qtyValue.textContent = formatNumber(Number(item.quantity) || 0);
        minus.className = "adjust";
        minus.type = "button";
        minus.textContent = "−";
        minus.disabled = !state.capabilities?.canAdjustQuantity;
        minus.setAttribute("aria-label", "Decrease quantity for " + (item.name || item.id));
        minus.addEventListener("click", () => adjustQuantity(item, -1, minus));
        plus.className = "adjust";
        plus.type = "button";
        plus.textContent = "+";
        plus.disabled = !state.capabilities?.canAdjustQuantity;
        plus.setAttribute("aria-label", "Increase quantity for " + (item.name || item.id));
        plus.addEventListener("click", () => adjustQuantity(item, 1, plus));
        primary.append(code, name, detail);
        quantity.append(qtyValue);
        actions.append(minus, plus);
        if (externalUrl) {
          const link = document.createElement("a");
          link.className = "row-link";
          link.href = externalUrl;
          link.target = "_blank";
          link.rel = "noreferrer";
          link.textContent = "Open Airtable";
          actions.append(link);
        }
        row.append(primary, description, quantity, actions);
        rows.append(row);
      });
    }
    function filterItems() {
      const query = state.query.trim().toLowerCase();
      state.filtered = !query ? [...state.items] : state.items.filter((item) => {
        const haystack = [item.id, item.partNumber, item.name, item.secondaryName, ...(item.aliases || [])].join(" ").toLowerCase();
        return haystack.includes(query);
      });
      updateSummary();
      renderRows();
    }
    async function loadInventory() {
      refreshButton.disabled = true;
      refreshButton.textContent = "Refreshing";
      try {
        const response = await fetch("/api/items");
        if (!response.ok) throw new Error("Inventory load failed");
        const payload = await response.json();
        state.items = sortItems(payload.items || []);
        state.capabilities = payload.capabilities || {};
        setCapabilityView(state.capabilities);
        filterItems();
      } catch (_error) {
        rows.replaceChildren();
        const empty = document.createElement("div");
        empty.className = "empty";
        empty.textContent = "Inventory could not be loaded from the active backend.";
        rows.append(empty);
      } finally {
        refreshButton.disabled = false;
        refreshButton.textContent = "Refresh";
      }
    }
    search.addEventListener("input", () => {
      state.query = search.value;
      filterItems();
    });
    refreshButton.addEventListener("click", () => loadInventory());
    loadInventory();
  </script>
</body>
</html>`;
}

function createInventoryRouter(config) {
  const router = express.Router();

  router.get("/", (_request, response) => {
    response.type("html").send(renderInventoryDashboard(config));
  });

  return router;
}

module.exports = {
  createInventoryRouter,
  renderInventoryDashboard,
};
