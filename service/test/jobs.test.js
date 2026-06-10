// ╭──────────────────────────────╮
// │  Scan Job Tests              │
// │  Verifies dashboard paging   │
// │  and persisted live updates. │
// ╰──────────────────────────────╯

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { WebSocket } = require("ws");

const { pageJobs } = require("../src/routes/jobs");
const { selectLanAddresses } = require("../src/services/discovery");
const { createLiveJobFeed } = require("../src/services/live-jobs");
const { createScanJobStore } = require("../src/services/scan-jobs");

function makeJob(index) {
  return {
    id: index.toString(16).padStart(12, "0"),
    createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
  };
}

test("pages jobs without repeating the cursor item", () => {
  const jobs = Array.from({ length: 30 }, (_value, index) => makeJob(29 - index));
  const first = pageJobs(jobs, 25);
  const second = pageJobs(jobs, 25, first.nextCursor);

  assert.equal(first.jobs.length, 25);
  assert.equal(second.jobs.length, 5);
  assert.equal(second.nextCursor, null);
  assert.notEqual(first.jobs.at(-1).id, second.jobs[0].id);
});

test("caps requested page sizes", () => {
  const jobs = Array.from({ length: 110 }, (_value, index) => makeJob(109 - index));

  assert.equal(pageJobs(jobs, 500).jobs.length, 100);
});

test("mDNS hostname excludes virtual network addresses", () => {
  const interfaces = {
    enp3s0: [{ family: "IPv4", internal: false, address: "192.168.1.20" }],
    tailscale0: [{ family: "IPv4", internal: false, address: "100.64.0.1" }],
    "br-example": [{ family: "IPv4", internal: false, address: "172.18.0.1" }],
  };

  assert.deepEqual(selectLanAddresses("", interfaces), ["192.168.1.20"]);
  assert.deepEqual(selectLanAddresses("tailscale0", interfaces), ["100.64.0.1"]);
});

test("broadcasts job updates over the dashboard WebSocket", async () => {
  const server = http.createServer();
  const feed = createLiveJobFeed();
  feed.attach(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const socket = new WebSocket(`ws://127.0.0.1:${address.port}/ws/jobs`);

  try {
    await new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    const received = new Promise((resolve) => socket.once("message", resolve));
    feed.publish({ id: "000000000001", status: "ingested" });
    const message = JSON.parse(String(await received));

    assert.equal(message.type, "job.updated");
    assert.equal(message.job.status, "ingested");
  } finally {
    socket.terminate();
    feed.stop();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("publishes ingested and completed job states", async () => {
  const ingestDir = await fs.mkdtemp(path.join(os.tmpdir(), "segtori-jobs-"));
  const updates = [];
  const store = createScanJobStore(
    { scanJobs: { ingestDir } },
    (job) => updates.push(job),
  );
  const file = {
    buffer: Buffer.from("image"),
    mimetype: "image/jpeg",
    originalname: "scan.jpg",
    size: 5,
  };

  try {
    const job = await store.createJob(file);
    await store.completeJob(job, { ocrText: "12 x 12" });

    assert.deepEqual(updates.map((update) => update.status), ["ingested", "completed"]);
    assert.equal(updates[0].id, updates[1].id);
  } finally {
    await fs.rm(ingestDir, { recursive: true, force: true });
  }
});

test("deletes the persisted scan job directory", async () => {
  const ingestDir = await fs.mkdtemp(path.join(os.tmpdir(), "segtori-jobs-"));
  const store = createScanJobStore({ scanJobs: { ingestDir } });
  const file = {
    buffer: Buffer.from("image"),
    mimetype: "image/jpeg",
    originalname: "scan.jpg",
    size: 5,
  };

  try {
    const job = await store.createJob(file);
    await store.deleteJob(job);

    await assert.rejects(
      fs.readFile(path.join(job.jobDir, "job.json"), "utf8"),
      /ENOENT/,
    );
  } finally {
    await fs.rm(ingestDir, { recursive: true, force: true });
  }
});
