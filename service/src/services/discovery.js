// ╭──────────────────────────────╮
// │  mDNS Advertisement          │
// │  Publishes the TORI HTTP     │
// │  service when a Bonjour      │
// │  implementation is present.  │
// ╰──────────────────────────────╯

let BonjourService = null;

try {
  ({ Bonjour: BonjourService } = require("bonjour-service"));
} catch (_error) {
  BonjourService = null;
}

function startMdnsAdvertisement(config, logger = console) {
  if (!BonjourService) {
    logger.warn("[mdns] bonjour-service not installed, skipping advertisement");
    return {
      stop() {},
    };
  }

  const bonjour = new BonjourService();
  const publication = bonjour.publish({
    name: config.mdnsName,
    type: "tori-ocr",
    protocol: "tcp",
    port: config.port,
  });

  logger.info(`[mdns] advertising ${config.mdnsName} on port ${config.port}`);

  return {
    stop() {
      publication.stop(() => {
        bonjour.destroy();
      });
      logger.info("[mdns] advertisement stopped");
    },
  };
}

module.exports = {
  startMdnsAdvertisement,
};
