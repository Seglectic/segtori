// ╭──────────────────────────────╮
// │  ONNX Worker Client          │
// │  Keeps a RapidOCR process    │
// │  warm and routes scan calls. │
// ╰──────────────────────────────╯

const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const readline = require("node:readline");
const path = require("node:path");

const workerCache = new Map();

function defaultWorkerPath() {
  return path.resolve(__dirname, "..", "..", "onnx", "worker.py");
}

function cacheKey(options) {
  return [
    options.onnxPythonPath || "python3",
    options.onnxWorkerPath || defaultWorkerPath(),
    options.onnxProvider || "auto",
    options.onnxTimeoutMs || 30000,
  ].join("\u0000");
}

class OnnxWorkerClient {
  constructor(options, logger = console) {
    this.options = options;
    this.logger = logger;
    this.child = null;
    this.started = false;
    this.starting = null;
    this.pending = new Map();
    this.startupTimer = null;
    this._resolveStarting = null;
    this._rejectStarting = null;
    this._settledStartup = false;
  }

  async warm() {
    await this.ensureStarted();
  }

  async infer(imagePath) {
    if (!imagePath) {
      throw new Error("ONNX OCR requires a persisted image path");
    }

    await this.ensureStarted();

    const id = randomUUID();
    return new Promise((resolve, reject) => {
      const timeoutMs = this.options.onnxTimeoutMs || 30000;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        this._restart(new Error(`ONNX OCR timed out after ${timeoutMs}ms`));
        reject(new Error(`ONNX OCR timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.child.stdin.write(
          `${JSON.stringify({ id, image: imagePath })}\n`
        );
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  stop() {
    if (!this.child) {
      return;
    }

    const child = this.child;
    this.child = null;
    this.started = false;
    this._clearStartupTimer();
    this._rejectStartingOnce(new Error("ONNX worker stopped"));
    this._rejectPending(new Error("ONNX worker stopped"));

    try {
      if (child.stdin.writable) {
        child.stdin.write(`${JSON.stringify({ type: "shutdown" })}\n`);
      }
    } catch (_error) {
      // The process may already be shutting down.
    }

    child.kill("SIGTERM");
  }

  async ensureStarted() {
    if (this.started && this.child) {
      return this;
    }

    if (this.starting) {
      return this.starting;
    }

    this.starting = new Promise((resolve, reject) => {
      const pythonPath = this.options.onnxPythonPath || "python3";
      const workerPath = this.options.onnxWorkerPath || defaultWorkerPath();
      const provider = this.options.onnxProvider || "auto";
      const timeoutMs = this.options.onnxTimeoutMs || 30000;

      this._resolveStarting = resolve;
      this._rejectStarting = reject;
      this._settledStartup = false;
      this.child = spawn(
        pythonPath,
        [workerPath, "--serve", "--provider", provider],
        {
          stdio: ["pipe", "pipe", "pipe"],
        }
      );

      const stdoutReader = readline.createInterface({
        input: this.child.stdout,
        crlfDelay: Infinity,
      });
      const stderrReader = readline.createInterface({
        input: this.child.stderr,
        crlfDelay: Infinity,
      });

      stdoutReader.on("line", (line) => this._handleStdoutLine(line));
      stderrReader.on("line", (line) => this._handleStderrLine(line));

      this.child.once("error", (error) => {
        stdoutReader.close();
        stderrReader.close();
        this._handleWorkerExit(error);
      });
      this.child.once("exit", (code, signal) => {
        const error = new Error(
          `ONNX worker exited with code ${code ?? "null"}${signal ? ` signal ${signal}` : ""}`
        );
        stdoutReader.close();
        stderrReader.close();
        this._handleWorkerExit(error);
      });

      this.startupTimer = setTimeout(() => {
        const error = new Error(`ONNX worker failed to start after ${timeoutMs}ms`);
        this._restart(error);
        this._rejectStartingOnce(error);
      }, timeoutMs);
    }).then(() => {
      this.started = true;
      this.starting = null;
      return this;
    }).catch((error) => {
      this.starting = null;
      throw error;
    });

    return this.starting;
  }

  _handleStdoutLine(line) {
    const trimmed = String(line || "").trim();
    if (!trimmed) {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch (error) {
      this.logger.error(`[onnx] invalid worker output: ${trimmed}`);
      return;
    }

    if (payload.type === "ready") {
      this._clearStartupTimer();
      this._resolveStartingOnce();
      return;
    }

    if (!payload.id) {
      return;
    }

    const pending = this.pending.get(payload.id);
    if (!pending) {
      return;
    }

    this.pending.delete(payload.id);
    clearTimeout(pending.timer);

    if (payload.ok === false) {
      pending.reject(new Error(payload.error || "ONNX OCR failed"));
      return;
    }

    pending.resolve(payload);
  }

  _handleStderrLine(line) {
    const trimmed = String(line || "").trim();
    if (trimmed) {
      this.logger.error(`[onnx] ${trimmed}`);
    }
  }

  _rejectStartup(error) {
    this._clearStartupTimer();
    this._rejectStartingOnce(error);
    this.started = false;
  }

  _rejectPending(error) {
    for (const [id, pending] of this.pending.entries()) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  _clearStartupTimer() {
    if (this.startupTimer) {
      clearTimeout(this.startupTimer);
      this.startupTimer = null;
    }
  }

  _restart(error) {
    const child = this.child;
    this._rejectPending(error);
    this._clearStartupTimer();
    this.started = false;
    this.starting = null;
    if (!this._settledStartup) {
      this._rejectStartingOnce(error);
    }
    if (child) {
      try {
        child.kill("SIGTERM");
      } catch (_killError) {
        // Ignore shutdown races.
      }
      this.child = null;
    }
  }

  _resolveStartingOnce() {
    if (this._settledStartup) {
      return;
    }

    this._settledStartup = true;
    if (this._resolveStarting) {
      this._resolveStarting();
      this._resolveStarting = null;
      this._rejectStarting = null;
    }
  }

  _rejectStartingOnce(error) {
    if (this._settledStartup) {
      return;
    }

    this._settledStartup = true;
    if (this._rejectStarting) {
      this._rejectStarting(error);
      this._resolveStarting = null;
      this._rejectStarting = null;
    }
  }

  _handleWorkerExit(error) {
    this._clearStartupTimer();

    if (!this.started) {
      this._rejectStartingOnce(error);
    }

    this._rejectPending(error);
    this.started = false;
    this.child = null;
    this.starting = null;
  }
}

function getOnnxWorkerClient(options, logger = console) {
  const key = cacheKey(options);
  if (!workerCache.has(key)) {
    workerCache.set(key, new OnnxWorkerClient(options, logger));
  }

  return workerCache.get(key);
}

async function warmOnnxWorker(options, logger = console) {
  await getOnnxWorkerClient(options, logger).warm();
}

function stopOnnxWorkers() {
  for (const worker of workerCache.values()) {
    worker.stop();
  }
  workerCache.clear();
}

module.exports = {
  getOnnxWorkerClient,
  stopOnnxWorkers,
  warmOnnxWorker,
};
