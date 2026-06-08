/**
 * @param {string} value
 */
export function normalizeIpfsCid(value) {
  return value
    .trim()
    .replace(/^ipfs:\/\//, "")
    .replace(/^\/+/, "")
    .replace(/^ipfs\/+/, "")
    .trim();
}

/**
 * @param {string} value
 */
export function normalizeIpfsPath(value) {
  const normalizedCid = normalizeIpfsCid(value);
  if (!normalizedCid) {
    throw new Error("IPFS path normalization requires a CID.");
  }
  return "/ipfs/" + normalizedCid;
}

/**
 * @param {{ gatewayBaseUrl: string, cid: string, path?: string }} input
 */
export function buildGatewayUrl(input) {
  const normalizedBaseUrl = input.gatewayBaseUrl.replace(/\/+$/, "");
  const suffix = input.path ? `/${input.path.replace(/^\/+/, "")}` : "";
  return `${normalizedBaseUrl}${normalizeIpfsPath(input.cid)}${suffix}`;
}

/**
 * @param {{
 *   gatewayBaseUrl: string,
 *   cid: string,
 *   path?: string,
 *   fetchImpl?: typeof fetch
 * }} input
 */
export async function resolveJsonFromGateway(input) {
  const normalizedCid = normalizeIpfsCid(input.cid);
  const sourceUrl = buildGatewayUrl({
    gatewayBaseUrl: input.gatewayBaseUrl,
    cid: normalizedCid,
    path: input.path,
  });
  const fetchImpl = input.fetchImpl ?? globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    throw new Error("IPFS gateway resolution requires fetch support.");
  }

  try {
    const response = await fetchImpl(sourceUrl);
    if (!response.ok) {
      return {
        cid: normalizedCid,
        sourceUrl,
        ok: false,
        status: response.status,
      };
    }

    return {
      cid: normalizedCid,
      sourceUrl,
      ok: true,
      status: response.status,
      data: await response.json(),
    };
  } catch (error) {
    return {
      cid: normalizedCid,
      sourceUrl,
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
