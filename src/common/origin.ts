const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);

function tryParse(origin: string): URL | undefined {
  try {
    return new URL(origin);
  } catch {
    return undefined;
  }
}

/**
 * Host of a dApp origin, such as `dapp.io` for `https://dapp.io`. Auth messages sign
 * it instead of the full origin, as client integrations verify the host.
 */
export function hostOf(origin: string): string {
  return tryParse(origin)?.host ?? origin;
}

/**
 * dApp origin as shown to users: the bare host for https, and the full origin
 * otherwise, so that plain http connections stand out.
 */
export function displayOrigin(origin: string): string {
  const url = tryParse(origin);
  return url?.protocol === "https:" ? url.host : origin;
}

/**
 * Maps a dApp connection stored by host, before connections were stored by origin, to
 * its origin. Loopback hosts were almost certainly local http dev servers.
 */
export function legacyHostToOrigin(host: string): string {
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return `${LOOPBACK_HOSTNAMES.has(hostname) ? "http" : "https"}://${host}`;
}
