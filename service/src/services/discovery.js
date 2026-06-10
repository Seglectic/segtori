// ╭──────────────────────────────╮
// │  mDNS Advertisement          │
// │  Publishes the Segtori HTTP  │
// │  service when a Bonjour      │
// │  implementation is present.  │
// ╰──────────────────────────────╯

const os = require("os");

let BonjourService = null;

try {
  ({ Bonjour: BonjourService } = require("bonjour-service"));
} catch (_error) {
  BonjourService = null;
}

const VIRTUAL_INTERFACE_PATTERN = /^(br-|cni|docker|podman|tailscale|tun|veth|virbr)/;

function selectLanAddresses(interfaceName = "", interfaces = os.networkInterfaces()) {
  const addresses = Object.entries(interfaces)
    .filter(
      ([name, entries]) =>
        !interfaceName ||
        name === interfaceName ||
        entries?.some((entry) => entry.address === interfaceName),
    )
    .filter(([name]) => interfaceName || !VIRTUAL_INTERFACE_PATTERN.test(name))
    .flatMap(([_name, entries]) => entries || [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);

  if (addresses.length || interfaceName) {
    return addresses;
  }

  return Object.values(interfaces)
    .flatMap((entries) => entries || [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
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
    host: config.mdnsHost,
    type: "segtori-ocr",
    protocol: "tcp",
    port: config.port,
    disableIPv6: true,
  });
  const lanAddresses = selectLanAddresses(config.mdnsInterface);
  const createRecords = publication.records.bind(publication);

  // Bonjour otherwise assigns tori.local to Docker and VPN interfaces too.
  publication.records = () =>
    createRecords().filter((record) => record.type !== "A" || lanAddresses.includes(record.data));

  const interfaceLabel = config.mdnsInterface || "all interfaces";
  logger.info(
    `[mdns] advertising ${config.mdnsName} at ${config.mdnsHost}:${config.port} via ${interfaceLabel} (${lanAddresses.join(", ")})`,
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
  selectLanAddresses,
  startMdnsAdvertisement,
};
