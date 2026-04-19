import { readFile } from "node:fs/promises";
import path from "node:path";

import { publishJsonArtifact } from "./artifacts.js";

/**
 * @param {unknown} value
 */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

/**
 * @param {Record<string, unknown> | null} definition
 */
function detectRuntimeType(definition) {
  if (!definition) {
    return "unknown";
  }

  const canonical = typeof definition.runtimeType === "string" ? definition.runtimeType.trim() : "";
  if (canonical) {
    return canonical;
  }

  const legacy = typeof definition.type === "string" ? definition.type.trim() : "";
  if (legacy) {
    return legacy;
  }

  return "unknown";
}

/**
 * @param {Record<string, unknown> | null} definition
 */
function detectEntrypoint(definition) {
  if (!definition) {
    return "";
  }

  if (typeof definition.entrypoint === "string" && definition.entrypoint.trim()) {
    return definition.entrypoint.trim();
  }

  const runtime = asRecord(definition.runtime);
  if (runtime && typeof runtime.entrypoint === "string" && runtime.entrypoint.trim()) {
    return runtime.entrypoint.trim();
  }

  return "";
}

/**
 * @param {Record<string, unknown> | null} definition
 */
export function createSkillMeshDefinitionMetadata(definition) {
  const record = asRecord(definition);
  const runtime = detectRuntimeType(record);
  const entrypoint = detectEntrypoint(record);
  const chainable = record && typeof record.chainable === "boolean" ? String(record.chainable) : undefined;
  const computeCost = record && (typeof record.computeCost === "number" || typeof record.computeCost === "string")
    ? String(record.computeCost)
    : undefined;

  return {
    skillName: record && typeof record.name === "string" && record.name.trim() ? record.name.trim() : "unknown-skill",
    skillVersion: record && typeof record.version === "string" && record.version.trim() ? record.version.trim() : "unknown-version",
    runtimeType: runtime,
    entrypoint: entrypoint || undefined,
    chainable,
    computeCost,
  };
}

/**
 * @param {import("./client.js").IpfsStorageClient} client
 * @param {{
 *   inputPath: string,
 *   sourceProject?: string,
 *   readFileImpl?: typeof readFile,
 *   pin?: boolean,
 *   wrapWithDirectory?: boolean,
 * }} input
 */
export async function publishSkillMeshDefinition(client, input) {
  const absolutePath = path.resolve(input.inputPath);
  const raw = await (input.readFileImpl ?? readFile)(absolutePath, "utf8");
  const definition = JSON.parse(raw);
  const metadata = createSkillMeshDefinitionMetadata(definition);

  return publishJsonArtifact(client, {
    project: input.sourceProject ?? "skillmesh",
    artifactKind: "skill-definition",
    data: definition,
    fileName: path.basename(absolutePath),
    pin: input.pin,
    wrapWithDirectory: input.wrapWithDirectory,
    extraMetadata: {
      path: absolutePath,
      ...metadata,
    },
  });
}
