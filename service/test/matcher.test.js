// ╭──────────────────────────────╮
// │  Matcher Tests               │
// │  Verifies ranked candidates  │
// │  and uncertainty gating.     │
// ╰──────────────────────────────╯

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  evaluateMatchConfidence,
  rankInventoryMatches,
} = require("../src/services/matcher");

const inventory = [
  {
    id: "box-a",
    name: "12 x 6 x 6",
    secondaryName: "S-1206",
    aliases: ["small shipping box"],
  },
  {
    id: "box-b",
    name: "12 x 6 x 8",
    secondaryName: "S-1208",
    aliases: [],
  },
];

test("ranks secondary names and aliases", () => {
  assert.equal(rankInventoryMatches("S-1206", inventory)[0].id, "box-a");
  assert.equal(rankInventoryMatches("small shipping box", inventory)[0].id, "box-a");
});

test("accepts exact matches", () => {
  const candidates = rankInventoryMatches("S-1206", inventory);
  const confidence = evaluateMatchConfidence(candidates, 0.55, 0.1);

  assert.equal(confidence.accepted, true);
  assert.equal(confidence.score, 1);
});

test("withholds ambiguous candidates", () => {
  const candidates = [
    { id: "box-a", score: 0.85 },
    { id: "box-b", score: 0.85 },
  ];
  const confidence = evaluateMatchConfidence(candidates, 0.55, 0.1);

  assert.equal(confidence.accepted, false);
  assert.equal(confidence.margin, 0);
});

test("withholds duplicate exact matches", () => {
  const candidates = [
    { id: "box-a", score: 1 },
    { id: "box-b", score: 1 },
  ];
  const confidence = evaluateMatchConfidence(candidates, 0.55, 0.1);

  assert.equal(confidence.accepted, false);
  assert.equal(confidence.margin, 0);
});

test("withholds weak candidates", () => {
  const candidates = [{ id: "box-a", score: 0.4 }];
  const confidence = evaluateMatchConfidence(candidates, 0.55, 0.1);

  assert.equal(confidence.accepted, false);
});
