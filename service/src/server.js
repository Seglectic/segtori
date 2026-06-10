// ╭──────────────────────────────╮
// │  Service Entrypoint          │
// │  Loads runtime config, binds │
// │  the HTTP server, and starts │
// │  mDNS only after listen.     │
// ╰──────────────────────────────╯

require("dotenv").config();

const { createApp } = require("./app");
const { loadConfig } = require("./config");

(async () => {
  const config = loadConfig();
  const service = createApp(config, console);

  await service.warm();

  const server = service.app.listen(config.port, () => {
    console.log(`[http] listening on ${config.port}`);
    service.startDiscovery();
  });
  service.attachServer(server);

  function shutdown() {
    service.stop();
    server.close(() => {
      process.exit(0);
    });
  }

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
