import path from "node:path";

import { detectPublishTarget } from "./client.js";

/**
 * @param {string} value
 */
function normalizeMetadataValue(value) {
  return value.trim();
}

/**
 * @param {string} value
 */
function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artifact";
}

/**
 * @param {{
 *   sourceProject: string,
 *   artifactKind: string,
 *   contentType?: string,
 *   absolutePath?: string,
 *   extraMetadata?: Record<string, string | number | boolean | null | undefined>
 * }} input
 */
export function createArtifactMetadata(input) {
  const metadata = {
    sourceProject: input.sourceProject,
    artifact: input.artifactKind,
    createdAt: new Date().toISOString(),
  };

  if (input.contentType) {
    metadata.contentType = input.contentType;
  }

  if (input.absolutePath) {
    metadata.path = path.resolve(input.absolutePath);
  }

  for (const [key, rawValue] of Object.entries(input.extraMetadata ?? {})) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    const value = normalizeMetadataValue(String(rawValue));
    if (!value) {
      continue;
    }

    metadata[key] = value;
  }

  return metadata;
}

/**
 * @param {import("./client.js").IpfsStorageClient} client
 * @param {{
 *   project: string,
 *   inputPath: string,
 *   artifactKind: string,
 *   fileName?: string,
 *   pin?: boolean,
 *   wrapWithDirectory?: boolean,
 *   extraMetadata?: Record<string, string | number | boolean | null | undefined>
 * }} input
 */
export async function publishProjectPath(client, input) {
  const absolutePath = path.resolve(input.inputPath);
  const target = await detectPublishTarget(absolutePath);
  const metadata = createArtifactMetadata({
    sourceProject: input.project,
    artifactKind: input.artifactKind,
    absolutePath,
    extraMetadata: input.extraMetadata,
  });

  const result = target.isDirectory
    ? await client.publishDirectory({
        directoryPath: absolutePath,
        pin: input.pin,
        wrapWithDirectory: input.wrapWithDirectory ?? true,
        sourceProject: input.project,
        metadata,
      })
    : await client.publishFile({
        filePath: absolutePath,
        fileName: input.fileName,
        pin: input.pin,
        wrapWithDirectory: input.wrapWithDirectory,
        sourceProject: input.project,
        metadata,
      });

  const [pinStatus, health] = await Promise.all([
    client.ensurePinned(result.cid),
    client.checkCidHealth({ cid: result.cid }),
  ]);

  return {
    ...result,
    artifactKind: input.artifactKind,
    metadata,
    verified: Boolean(pinStatus.pinned && health.available),
    pinStatus,
    health,
  };
}

/**
 * @param {import("./client.js").IpfsStorageClient} client
 * @param {{
 *   project: string,
 *   artifactKind: string,
 *   data: unknown,
 *   fileName?: string,
 *   contentType?: string,
 *   pin?: boolean,
 *   wrapWithDirectory?: boolean,
 *   extraMetadata?: Record<string, string | number | boolean | null | undefined>
 * }} input
 */
export async function publishJsonArtifact(client, input) {
  const fileName = input.fileName ?? `${slugify(input.project)}-${slugify(input.artifactKind)}.json`;
  const metadata = createArtifactMetadata({
    sourceProject: input.project,
    artifactKind: input.artifactKind,
    contentType: input.contentType ?? "application/json",
    extraMetadata: input.extraMetadata,
  });

  const result = await client.publishJson({
    data: input.data,
    fileName,
    pin: input.pin,
    wrapWithDirectory: input.wrapWithDirectory,
    sourceProject: input.project,
    metadata,
  });

  const [pinStatus, health] = await Promise.all([
    client.ensurePinned(result.cid),
    client.checkCidHealth({ cid: result.cid }),
  ]);

  return {
    ...result,
    artifactKind: input.artifactKind,
    metadata,
    verified: Boolean(pinStatus.pinned && health.available),
    pinStatus,
    health,
  };
}
