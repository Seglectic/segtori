// ╭──────────────────────────────╮
// │  ONNX Worker Tests           │
// │  Verifies provider selection │
// │  and warm-worker protocol.   │
// ╰──────────────────────────────╯

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { execFileSync } = require("node:child_process");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const workerPath = path.resolve(__dirname, "..", "onnx", "worker.py");
const { getOnnxWorkerClient, stopOnnxWorkers } = require("../src/services/onnx-worker");

function silentLogger() {
  return {
    error() {},
  };
}

test("ONNX worker exposes command help", (context) => {
  const config = require("../src/config").loadConfig();

  if (config.ocr.onnxPythonPath === process.execPath) {
    // The repo-local worker test uses Node's executable path.
  } else if (!require("node:fs").existsSync(config.ocr.onnxPythonPath)) {
    context.skip("ONNX environment is not provisioned");
    return;
  }

  const stdout = execFileSync(config.ocr.onnxPythonPath, [workerPath, "--help"], {
    encoding: "utf8",
  });

  assert.match(stdout, /--provider \{auto,cpu,cuda\}/);
});

test("keeps a warm ONNX worker alive across requests", async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "segtori-onnx-"));
  const stubPath = path.join(tempRoot, "worker.js");

  await fs.writeFile(
    stubPath,
    [
      "const fs = require('node:fs');",
      "const readline = require('node:readline');",
      "const serve = process.argv.includes('--serve');",
      "const providerIndex = process.argv.indexOf('--provider');",
      "const provider = providerIndex >= 0 ? process.argv[providerIndex + 1] : 'auto';",
      "if (!serve) process.exit(0);",
      "console.log(JSON.stringify({ type: 'ready', metrics: { provider, initializationMs: 1 } }));",
      "const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });",
      "rl.on('line', (line) => {",
      "  const request = JSON.parse(line);",
      "  if (request.type === 'shutdown') {",
      "    rl.close();",
      "    process.exit(0);",
      "    return;",
      "  }",
      "  fs.writeFileSync(request.image + '.touched', '1');",
      "  console.log(JSON.stringify({ id: request.id, ok: true, text: 'HELLO WORLD', lines: [{ text: 'HELLO', score: 0.9 }], metrics: { provider, totalDurationMs: 2 } }));",
      "});",
    ].join("\n"),
    "utf8"
  );

  const client = getOnnxWorkerClient(
    {
      onnxPythonPath: process.execPath,
      onnxWorkerPath: stubPath,
      onnxProvider: "cpu",
      onnxTimeoutMs: 2000,
    },
    silentLogger()
  );
  const imagePath = path.join(tempRoot, "scan.jpg");

  try {
    await fs.writeFile(imagePath, "image", "utf8");
    await client.warm();

    const first = await client.infer(imagePath);
    const second = await client.infer(imagePath);

    assert.equal(first.text, "HELLO WORLD");
    assert.equal(second.metrics.provider, "cpu");
    assert.equal(await fs.readFile(imagePath + ".touched", "utf8"), "1");
  } finally {
    stopOnnxWorkers();
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
