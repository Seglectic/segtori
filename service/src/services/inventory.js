// ╭──────────────────────────────╮
// │  Inventory Service           │
// │  Talks to Airtable for Phase │
// │  1 and normalizes records    │
// │  for the firmware contract.  │
// ╰──────────────────────────────╯

const { loadConfig } = require("../config");

function getConfig() {
  const config = loadConfig();

  if (!config.airtable.apiToken || !config.airtable.baseId) {
    throw new Error("Airtable API token and base ID must be configured");
  }

  return config;
}

function getHeaders(config) {
  return {
    Authorization: `Bearer ${config.airtable.apiToken}`,
    "Content-Type": "application/json",
  };
}

function getTablePath(config) {
  return `https://api.airtable.com/v0/${encodeURIComponent(config.airtable.baseId)}/${encodeURIComponent(config.airtable.tableId)}`;
}

function normalizeItemRecord(record, config) {
  const fields = record.fields ?? {};
  const explicitId = config.airtable.itemIdField ? fields[config.airtable.itemIdField] : "";
  const quantityValue = Number(fields[config.airtable.quantityField] ?? 0);
  const primaryName = String(fields[config.airtable.itemNameField] ?? "").trim();
  const partNumber = config.airtable.itemPartNumberField
    ? String(fields[config.airtable.itemPartNumberField] ?? "").trim()
    : "";
  const secondaryName = config.airtable.itemSecondaryNameField
    ? String(fields[config.airtable.itemSecondaryNameField] ?? "").trim()
    : "";
  const aliasesValue = config.airtable.itemAliasesField
    ? fields[config.airtable.itemAliasesField]
    : [];
  const aliases = (Array.isArray(aliasesValue) ? aliasesValue : [aliasesValue])
    .flatMap((value) => String(value ?? "").split(/[,;\n]/))
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    id: String(explicitId || record.id),
    recordId: record.id,
    name: primaryName,
    partNumber,
    secondaryName,
    aliases,
    quantity: Number.isFinite(quantityValue) ? quantityValue : 0,
  };
}

async function airtableRequest(url, init) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.error?.message || payload.error || response.statusText;
    throw new Error(`Airtable request failed: ${message}`);
  }

  return payload;
}

async function listInventoryItems() {
  const config = getConfig();
  const items = [];
  let offset = "";

  do {
    const url = new URL(getTablePath(config));
    url.searchParams.set("pageSize", "100");
    url.searchParams.append("fields[]", config.airtable.itemNameField);
    url.searchParams.append("fields[]", config.airtable.itemPartNumberField);
    url.searchParams.append("fields[]", config.airtable.quantityField);

    if (config.airtable.itemIdField) {
      url.searchParams.append("fields[]", config.airtable.itemIdField);
    }

    if (config.airtable.itemSecondaryNameField) {
      url.searchParams.append("fields[]", config.airtable.itemSecondaryNameField);
    }

    if (config.airtable.itemAliasesField) {
      url.searchParams.append("fields[]", config.airtable.itemAliasesField);
    }

    if (config.airtable.viewId) {
      url.searchParams.set("view", config.airtable.viewId);
    }

    if (offset) {
      url.searchParams.set("offset", offset);
    }

    const payload = await airtableRequest(url, {
      headers: getHeaders(config),
    });

    for (const record of payload.records ?? []) {
      const item = normalizeItemRecord(record, config);
      if (item.name || item.secondaryName) {
        items.push(item);
      }
    }

    offset = payload.offset || "";
  } while (offset);

  return items;
}

async function findRecordIdForItemId(itemId, config) {
  const url = new URL(getTablePath(config));
  const escapedId = String(itemId).replace(/'/g, "\\'");
  const fieldName = config.airtable.itemIdField || "RECORD_ID()";
  const formula = config.airtable.itemIdField
    ? `{${fieldName}}='${escapedId}'`
    : `RECORD_ID()='${escapedId}'`;

  url.searchParams.set("maxRecords", "1");
  url.searchParams.set("filterByFormula", formula);

  const payload = await airtableRequest(url, {
    headers: getHeaders(config),
  });

  const record = payload.records?.[0];
  if (!record) {
    throw new Error(`Inventory item not found: ${itemId}`);
  }

  return record.id;
}

async function updateItemQuantity(id, quantity) {
  const config = getConfig();
  const recordId = config.airtable.itemIdField ? await findRecordIdForItemId(id, config) : id;
  const payload = await airtableRequest(`${getTablePath(config)}/${recordId}`, {
    method: "PATCH",
    headers: getHeaders(config),
    body: JSON.stringify({
      fields: {
        [config.airtable.quantityField]: quantity,
      },
    }),
  });

  const updated = normalizeItemRecord(payload, config);

  if (String(id) !== updated.id) {
    updated.id = String(id);
  }

  return updated;
}

module.exports = {
  listInventoryItems,
  updateItemQuantity,
};
