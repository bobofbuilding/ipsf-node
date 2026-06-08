import { stat } from "node:fs/promises";
import path from "node:path";

import { buildGatewayUrl, normalizeIpfsCid } from "./gateway.js";
import { collectDirectoryFiles, readPathAsBlob } from "./files.js";

/**
 * @typedef {Object} IpfsStorageClientOptions
 * @property {string} [apiBaseUrl]
 * @property {string} [gatewayBaseUrl]
 * @property {typeof fetch} [fetchImpl]
 * @property {string} [defaultSourceProject]
 * @property {string | null} [apiBearerToken]
 * @property {string | null} [apiBasicAuthUsername]
 * @property {string | null} [apiBasicAuthPassword]
 * @property {string} [repoPath]
 * @property {boolean} [localOnly]
 */

/**
 * @typedef {Object} PublishResult
 * @property {string} cid
 * @property {string} name
 * @property {number | undefined} size
 * @property {string | null} sourceProject
 * @property {string} gatewayUrl
 * @property {Record<string, string> | undefined} metadata
 */

export class IpfsStorageClient {
  /**
   * @param {IpfsStorageClientOptions} [options]
   */
  constructor(options = {}) {
    this.apiBaseUrl = (options.apiBaseUrl ?? "http://127.0.0.1:5001").replace(/\/+$/, "");
    this.gatewayBaseUrl = (options.gatewayBaseUrl ?? "http://127.0.0.1:8080").replace(/\/+$/, "");
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.defaultSourceProject = options.defaultSourceProject ?? null;
    this.apiBearerToken = typeof options.apiBearerToken === "string" ? options.apiBearerToken.trim() : "";
    this.apiBasicAuthUsername = typeof options.apiBasicAuthUsername === "string" ? options.apiBasicAuthUsername.trim() : "";
    this.apiBasicAuthPassword = typeof options.apiBasicAuthPassword === "string" ? options.apiBasicAuthPassword.trim() : "";
    this.repoPath = typeof options.repoPath === "string" ? options.repoPath.trim() : "";
    this.localOnly = Boolean(options.localOnly);

    if (typeof this.fetchImpl !== "function") {
      throw new Error("IpfsStorageClient requires a fetch implementation.");
    }

    if ((this.apiBasicAuthUsername && !this.apiBasicAuthPassword) || (!this.apiBasicAuthUsername && this.apiBasicAuthPassword)) {
      throw new Error("IPFS API basic auth requires both IPFS_API_BASIC_AUTH_USERNAME and IPFS_API_BASIC_AUTH_PASSWORD.");
    }
  }

  /**
   * @param {{
   *   filePath: string,
   *   fileName?: string,
   *   pin?: boolean,
   *   wrapWithDirectory?: boolean,
   *   sourceProject?: string,
   *   metadata?: Record<string, string>
   * }} input
   * @returns {Promise<PublishResult>}
   */
  async publishFile(input) {
    const fileName = input.fileName ?? path.basename(input.filePath);
    return this.publishBlob({
      blob: await readPathAsBlob(input.filePath),
      fileName,
      pin: input.pin,
      wrapWithDirectory: input.wrapWithDirectory,
      sourceProject: input.sourceProject,
      metadata: input.metadata,
    });
  }

  /**
   * @param {{
   *   directoryPath: string,
   *   pin?: boolean,
   *   wrapWithDirectory?: boolean,
   *   sourceProject?: string,
   *   metadata?: Record<string, string>
   * }} input
   * @returns {Promise<PublishResult>}
   */
  async publishDirectory(input) {
    const files = await collectDirectoryFiles(input.directoryPath);
    const form = new FormData();

    for (const file of files) {
      form.append("file", await readPathAsBlob(file.absolutePath), file.relativePath);
    }

    const results = await this.#postAdd(form, {
      pin: input.pin,
      wrapWithDirectory: input.wrapWithDirectory ?? true,
    });

    const rootName = path.basename(input.directoryPath);
    const rootRecord =
      results.find((entry) => entry.Name === rootName) ??
      results.at(-1);

    if (!rootRecord) {
      throw new Error(`IPFS add returned no records for directory: ${input.directoryPath}`);
    }

    return this.#toPublishResult(rootRecord, input.sourceProject, input.metadata);
  }

  /**
   * @param {{
   *   blob: Blob,
   *   fileName: string,
   *   pin?: boolean,
   *   wrapWithDirectory?: boolean,
   *   sourceProject?: string,
   *   metadata?: Record<string, string>
   * }} input
   * @returns {Promise<PublishResult>}
   */
  async publishBlob(input) {
    const form = new FormData();
    form.append("file", input.blob, input.fileName);

    const results = await this.#postAdd(form, {
      pin: input.pin,
      wrapWithDirectory: input.wrapWithDirectory,
    });

    const record = results.at(-1);
    if (!record) {
      throw new Error(`IPFS add returned no records for blob: ${input.fileName}`);
    }

    return this.#toPublishResult(record, input.sourceProject, input.metadata);
  }

  /**
   * @param {{
   *   data: unknown,
   *   fileName: string,
   *   pin?: boolean,
   *   wrapWithDirectory?: boolean,
   *   sourceProject?: string,
   *   metadata?: Record<string, string>
   * }} input
   * @returns {Promise<PublishResult>}
   */
  async publishJson(input) {
    const blob = new Blob([JSON.stringify(input.data, null, 2)], {
      type: "application/json",
    });

    return this.publishBlob({
      blob,
      fileName: input.fileName,
      pin: input.pin,
      wrapWithDirectory: input.wrapWithDirectory,
      sourceProject: input.sourceProject,
      metadata: input.metadata,
    });
  }

  /**
   * @param {{ cid: string, recursive?: boolean }} input
   */
  async pinCid(input) {
    const url = this.#rpcUrl("/api/v0/pin/add", {
      arg: input.cid,
      recursive: String(input.recursive ?? true),
    });

    const json = await this.#postJson(url);
    return {
      cid: input.cid,
      pinned: true,
      result: json,
    };
  }

  /**
   * @param {{ cid: string, recursive?: boolean }} input
   */
  async unpinCid(input) {
    const url = this.#rpcUrl("/api/v0/pin/rm", {
      arg: input.cid,
      recursive: String(input.recursive ?? true),
    });

    const json = await this.#postJson(url);
    return {
      cid: input.cid,
      pinned: false,
      result: json,
    };
  }

  /**
   * @param {{ cid: string, path?: string }} input
   */
  async resolveCid(input) {
    const normalizedCid = normalizeIpfsCid(input.cid);
    const gatewayUrl = buildGatewayUrl({ gatewayBaseUrl: this.gatewayBaseUrl, cid: normalizedCid, path: input.path });
    const health = await this.checkCidHealth({ cid: normalizedCid, path: input.path });

    return {
      cid: normalizedCid,
      path: input.path ?? null,
      gatewayUrl,
      available: health.available,
      status: health.status,
    };
  }

  /**
   * @param {{ cid: string, path?: string }} input
   */
  async checkCidHealth(input) {
    const normalizedCid = normalizeIpfsCid(input.cid);
    const gatewayUrl = buildGatewayUrl({ gatewayBaseUrl: this.gatewayBaseUrl, cid: normalizedCid, path: input.path });

    let response;
    try {
      response = await this.fetchImpl(gatewayUrl, { method: "HEAD" });
    } catch (error) {
      return {
        cid: normalizedCid,
        path: input.path ?? null,
        available: false,
        status: null,
        gatewayUrl,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (response.status === 405 || response.status === 501) {
      response = await this.fetchImpl(gatewayUrl, { method: "GET" });
    }

    return {
      cid: normalizedCid,
      path: input.path ?? null,
      available: response.ok,
      status: response.status,
      gatewayUrl,
    };
  }

  async checkNodeHealth() {
    const versionUrl = this.#rpcUrl("/api/v0/version");
    const idUrl = this.#rpcUrl("/api/v0/id");
    const apiAddressUrl = this.#rpcUrl("/api/v0/config", { arg: "Addresses.API" });
    const gatewayAddressUrl = this.#rpcUrl("/api/v0/config", { arg: "Addresses.Gateway" });

    try {
      const [version, identity, apiAddress, gatewayAddress] = await Promise.all([
        this.#postJson(versionUrl),
        this.#postJson(idUrl),
        this.#postJsonOptional(apiAddressUrl),
        this.#postJsonOptional(gatewayAddressUrl),
      ]);
      const configuredApiAddress = extractConfigValue(apiAddress);
      const configuredGatewayAddress = extractConfigValue(gatewayAddress);

      return {
        available: true,
        version: version.Version ?? null,
        id: identity.ID ?? null,
        nodeMode: inferNodeMode({
          apiBaseUrl: this.apiBaseUrl,
          gatewayBaseUrl: this.gatewayBaseUrl,
          configuredApiAddress,
          configuredGatewayAddress,
          repoPath: this.repoPath,
        }),
        apiBaseUrl: this.apiBaseUrl,
        gatewayBaseUrl: this.gatewayBaseUrl,
        configuredApiAddress,
        configuredGatewayAddress,
        configuredApiPort: parseMultiaddrTcpPort(configuredApiAddress),
        configuredGatewayPort: parseMultiaddrTcpPort(configuredGatewayAddress),
        localOnly: this.localOnly,
        repoPath: this.repoPath || null,
      };
    } catch (error) {
      return {
        available: false,
        version: null,
        id: null,
        nodeMode: "unknown",
        apiBaseUrl: this.apiBaseUrl,
        gatewayBaseUrl: this.gatewayBaseUrl,
        configuredApiAddress: null,
        configuredGatewayAddress: null,
        configuredApiPort: null,
        configuredGatewayPort: null,
        localOnly: this.localOnly,
        repoPath: this.repoPath || null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * @param {FormData} form
   * @param {{ pin?: boolean, wrapWithDirectory?: boolean }} options
   * @returns {Promise<Array<{ Name: string, Hash: string, Size?: string }>>}
   */
  async #postAdd(form, options) {
    const url = this.#rpcUrl("/api/v0/add", {
      pin: String(options.pin ?? true),
      "wrap-with-directory": String(options.wrapWithDirectory ?? false),
    });

    const response = await this.fetchImpl(url, {
      method: "POST",
      body: form,
      headers: this.#apiAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error(`IPFS add failed with status ${response.status}`);
    }

    const raw = await response.text();
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  /**
   * @param {string} cid
   * @param {{ timeoutMs?: number }} [input]
   */
  async ensurePinned(cid, input = {}) {
    const startedAt = Date.now();
    const timeoutMs = input.timeoutMs ?? 15_000;

    while (Date.now() - startedAt < timeoutMs) {
      const url = this.#rpcUrl("/api/v0/pin/ls", { arg: cid });
      try {
        const json = await this.#postJson(url);
        if (json.Keys?.[cid]) {
          return { cid, pinned: true };
        }
      } catch (_error) {
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    return { cid, pinned: false };
  }

  /**
   * @param {string} rpcPath
   * @param {Record<string, string>} [search]
   */
  #rpcUrl(rpcPath, search = {}) {
    const url = new URL(`${this.apiBaseUrl}${rpcPath}`);

    for (const [key, value] of Object.entries(search)) {
      url.searchParams.set(key, value);
    }

    return url.toString();
  }

  /**
   * @param {string} url
   */
  async #postJson(url) {
    const response = await this.fetchImpl(url, {
      method: "POST",
      headers: this.#apiAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error(`IPFS RPC failed with status ${response.status}: ${url}`);
    }
    return response.json();
  }

  /**
   * @param {string} url
   */
  async #postJsonOptional(url) {
    try {
      return await this.#postJson(url);
    } catch (_error) {
      return null;
    }
  }

  #apiAuthHeaders() {
    if (this.apiBearerToken) {
      return {
        Authorization: `Bearer ${this.apiBearerToken}`,
      };
    }

    if (this.apiBasicAuthUsername && this.apiBasicAuthPassword) {
      return {
        Authorization: "Basic " + Buffer.from(`${this.apiBasicAuthUsername}:${this.apiBasicAuthPassword}`, "utf8").toString("base64"),
      };
    }

    return undefined;
  }

  /**
   * @param {{ Name: string, Hash: string, Size?: string }} record
   * @param {string | undefined} sourceProject
   * @param {Record<string, string> | undefined} metadata
   * @returns {PublishResult}
   */
  #toPublishResult(record, sourceProject, metadata) {
    return {
      cid: record.Hash,
      name: record.Name,
      size: record.Size ? Number(record.Size) : undefined,
      sourceProject: sourceProject ?? this.defaultSourceProject,
      gatewayUrl: buildGatewayUrl({ gatewayBaseUrl: this.gatewayBaseUrl, cid: record.Hash }),
      metadata,
    };
  }
}

/**
 * @param {string} fileOrDirectoryPath
 */
export async function detectPublishTarget(fileOrDirectoryPath) {
  const fileStats = await stat(fileOrDirectoryPath);
  return {
    path: fileOrDirectoryPath,
    isDirectory: fileStats.isDirectory(),
    isFile: fileStats.isFile(),
  };
}

/**
 * @param {unknown} response
 */
function extractConfigValue(response) {
  if (!response || typeof response !== "object" || !("Value" in response)) {
    return null;
  }

  const value = response.Value;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * @param {string | null} multiaddr
 */
function parseMultiaddrTcpPort(multiaddr) {
  if (!multiaddr) {
    return null;
  }

  const match = multiaddr.match(/\/tcp\/(\d+)(?:\/|$)/);
  if (!match) {
    return null;
  }

  const port = Number(match[1]);
  return Number.isInteger(port) ? port : null;
}

/**
 * @param {{
 *   apiBaseUrl: string,
 *   gatewayBaseUrl: string,
 *   configuredApiAddress: string | null,
 *   configuredGatewayAddress: string | null,
 *   repoPath: string,
 * }} input
 */
function inferNodeMode(input) {
  const apiLoopback = isLoopbackUrl(input.apiBaseUrl) && isLoopbackMultiaddr(input.configuredApiAddress);
  const gatewayLoopback = isLoopbackUrl(input.gatewayBaseUrl) && isLoopbackMultiaddr(input.configuredGatewayAddress);

  if (!apiLoopback || !gatewayLoopback) {
    return "external";
  }

  if (input.repoPath) {
    return "managed";
  }

  return "local";
}

/**
 * @param {string} value
 */
function isLoopbackUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch (_error) {
    return false;
  }
}

/**
 * @param {string | null} value
 */
function isLoopbackMultiaddr(value) {
  if (!value) {
    return true;
  }

  return value.includes("/ip4/127.0.0.1/") || value.includes("/ip6/::1/");
}

