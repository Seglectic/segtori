// ╭──────────────────────────────╮
// │  Match Service               │
// │  Scores OCR text against     │
// │  inventory names with a      │
// │  transparent token metric.   │
// ╰──────────────────────────────╯

function normalizeText(value) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/([A-Z])([0-9])/g, "$1 $2")
    .replace(/([0-9])([A-Z])/g, "$1 $2")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function compactText(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function tokenize(value) {
  return normalizeText(value)
    .split(/\s+/)
    .filter(Boolean);
}

function scoreCandidate(ocrText, itemName) {
  const normalizedOcr = normalizeText(ocrText);
  const normalizedName = normalizeText(itemName);

  if (!normalizedOcr || !normalizedName) {
    return 0;
  }

  if (normalizedOcr === normalizedName) {
    return 1;
  }

  const compactOcr = compactText(ocrText);
  const compactName = compactText(itemName);

  if (compactOcr && compactOcr === compactName) {
    return 1;
  }

  const ocrTokens = tokenize(normalizedOcr);
  const nameTokens = tokenize(normalizedName);
  const nameTokenSet = new Set(nameTokens);
  const ocrTokenSet = new Set(ocrTokens);

  let overlap = 0;
  for (const token of nameTokenSet) {
    if (ocrTokenSet.has(token)) {
      overlap += 1;
    }
  }

  const overlapScore = overlap / Math.max(nameTokenSet.size, 1);
  const substringScore =
    normalizedOcr.includes(normalizedName) ||
    normalizedName.includes(normalizedOcr) ||
    compactOcr.includes(compactName) ||
    compactName.includes(compactOcr)
      ? 0.25
      : 0;

  return Math.min(1, overlapScore * 0.85 + substringScore);
}

function scoreItem(ocrText, item) {
  const scores = [scoreCandidate(ocrText, item.name)];

  if (item.secondaryName) {
    scores.push(scoreCandidate(ocrText, item.secondaryName));
  }

  for (const alias of item.aliases ?? []) {
    scores.push(scoreCandidate(ocrText, alias));
  }

  return Math.max(...scores);
}

function rankInventoryMatches(ocrText, items, limit = 5) {
  if (!ocrText || items.length === 0) {
    return [];
  }

  return items
    .map((item) => ({
      ...item,
      score: Number(scoreItem(ocrText, item).toFixed(3)),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.name.localeCompare(right.name))
    .slice(0, limit);
}

function evaluateMatchConfidence(candidates, minScore, minMargin) {
  const bestCandidate = candidates[0] || null;
  const runnerUp = candidates[1] || null;
  const runnerUpScore = runnerUp?.score || 0;
  const margin = Number(
    ((bestCandidate?.score || 0) - runnerUpScore).toFixed(3)
  );
  const accepted = Boolean(
    bestCandidate &&
      bestCandidate.score >= minScore &&
      ((bestCandidate.score === 1 && runnerUpScore < 1) || margin >= minMargin)
  );

  return {
    accepted,
    score: bestCandidate?.score || 0,
    minScore,
    margin,
    minMargin,
  };
}

module.exports = {
  evaluateMatchConfidence,
  normalizeText,
  rankInventoryMatches,
};
