// ╭──────────────────────────────╮
// │  Service Entrypoint          │
// │  Loads runtime config, binds │
// │  the HTTP server, and starts │
// │  mDNS only after listen.     │
// ╰──────────────────────────────╯

require("dotenv").config();

const { createApp } = require("./app");
const { loadConfig } = require("./config");

const config = loadConfig();
const service = createApp(config, console);

const server = service.app.listen(config.port, () => {
  console.log(`[http] listening on ${config.port}`);
  service.startDiscovery();
});

function shutdown() {
  server.close(() => {
    service.stop();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
