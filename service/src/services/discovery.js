// ╭──────────────────────────────╮
// │  mDNS Advertisement          │
// │  Publishes the Segtori HTTP  │
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

  const bonjour = new BonjourService(
    config.mdnsInterface ? { interface: config.mdnsInterface } : {},
  );
  const publication = bonjour.publish({
    name: config.mdnsName,
    type: "segtori-ocr",
    protocol: "tcp",
    port: config.port,
    disableIPv6: true,
  });

  const interfaceLabel = config.mdnsInterface || "all interfaces";
  logger.info(
    `[mdns] advertising ${config.mdnsName} on port ${config.port} via ${interfaceLabel}`,
  );

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
