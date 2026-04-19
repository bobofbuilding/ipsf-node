export type MetadataRecord = Record<string, string>;

export interface IpfsStorageClientOptions {
  apiBaseUrl?: string;
  gatewayBaseUrl?: string;
  fetchImpl?: typeof fetch;
  defaultSourceProject?: string | null;
  apiBearerToken?: string | null;
  apiBasicAuthUsername?: string | null;
  apiBasicAuthPassword?: string | null;
}

export interface PublishResult {
  cid: string;
  name: string;
  size?: number;
  sourceProject: string | null;
  gatewayUrl: string;
  metadata?: MetadataRecord;
}

export interface NodeHealthResult {
  available: boolean;
  version: string | null;
  id: string | null;
  error?: string;
}

export interface CidHealthResult {
  cid: string;
  path: string | null;
  available: boolean;
  status: number | null;
  gatewayUrl: string;
  error?: string;
}

export class IpfsStorageClient {
  constructor(options?: IpfsStorageClientOptions);

  publishFile(input: {
    filePath: string;
    fileName?: string;
    pin?: boolean;
    wrapWithDirectory?: boolean;
    sourceProject?: string;
    metadata?: MetadataRecord;
  }): Promise<PublishResult>;

  publishDirectory(input: {
    directoryPath: string;
    pin?: boolean;
    wrapWithDirectory?: boolean;
    sourceProject?: string;
    metadata?: MetadataRecord;
  }): Promise<PublishResult>;

  publishBlob(input: {
    blob: Blob;
    fileName: string;
    pin?: boolean;
    wrapWithDirectory?: boolean;
    sourceProject?: string;
    metadata?: MetadataRecord;
  }): Promise<PublishResult>;

  publishJson(input: {
    data: unknown;
    fileName: string;
    pin?: boolean;
    wrapWithDirectory?: boolean;
    sourceProject?: string;
    metadata?: MetadataRecord;
  }): Promise<PublishResult>;

  pinCid(input: { cid: string; recursive?: boolean }): Promise<{
    cid: string;
    pinned: true;
    result: unknown;
  }>;

  unpinCid(input: { cid: string; recursive?: boolean }): Promise<{
    cid: string;
    pinned: false;
    result: unknown;
  }>;

  resolveCid(input: { cid: string; path?: string }): Promise<{
    cid: string;
    path: string | null;
    gatewayUrl: string;
    available: boolean;
    status: number | null;
  }>;

  checkCidHealth(input: { cid: string; path?: string }): Promise<CidHealthResult>;
  checkNodeHealth(): Promise<NodeHealthResult>;
  ensurePinned(cid: string, input?: { timeoutMs?: number }): Promise<{ cid: string; pinned: boolean }>;
}

export function detectPublishTarget(fileOrDirectoryPath: string): Promise<{
  path: string;
  isDirectory: boolean;
  isFile: boolean;
}>;

export function getIpfsStorageConfig(env?: NodeJS.ProcessEnv): {
  apiBaseUrl: string;
  gatewayBaseUrl: string;
  apiBearerToken: string | null;
  apiBasicAuthUsername: string | null;
  apiBasicAuthPassword: string | null;
  apiProxyPort: string;
  apiProxyUpstreamUrl: string;
  defaultSourceProject: string | null;
  cliPath: string;
  repoPath: string;
};

export function getIpfsApiProxyAuthMode(env?: NodeJS.ProcessEnv): "bearer" | "basic" | "public-override" | "none";
export function authorizeIpfsApiProxyRequest(
  headers: Record<string, string | string[] | undefined>,
  env?: NodeJS.ProcessEnv
): {
  ok: boolean;
  authMode: "bearer" | "basic" | "public-override" | "none";
  statusCode?: number;
  message?: string;
};
export function createIpfsApiProxyServer(input?: {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  upstreamBaseUrl?: string;
  host?: string;
  port?: number;
  stdout?: (line: string) => void;
  stderr?: (line: string) => void;
}): {
  host: string;
  port: number;
  upstreamBaseUrl: string;
  server: import("node:http").Server;
  listen(): Promise<{ host: string; port: number; upstreamBaseUrl: string }>;
};

export function normalizeIpfsCid(value: string): string;
export function buildGatewayUrl(input: { gatewayBaseUrl: string; cid: string; path?: string }): string;
export function resolveJsonFromGateway(input: {
  gatewayBaseUrl: string;
  cid: string;
  path?: string;
  fetchImpl?: typeof fetch;
}): Promise<{
  cid: string;
  sourceUrl: string;
  ok: boolean;
  status: number | null;
  data?: unknown;
  error?: string;
}>;

export function createArtifactMetadata(input: {
  sourceProject: string;
  artifactKind: string;
  contentType?: string;
  absolutePath?: string;
  extraMetadata?: Record<string, string | number | boolean | null | undefined>;
}): MetadataRecord;

export function publishProjectPath(
  client: IpfsStorageClient,
  input: {
    project: string;
    inputPath: string;
    artifactKind: string;
    fileName?: string;
    pin?: boolean;
    wrapWithDirectory?: boolean;
    extraMetadata?: Record<string, string | number | boolean | null | undefined>;
  },
): Promise<PublishResult & {
  artifactKind: string;
  metadata: MetadataRecord;
  verified: boolean;
  pinStatus: { cid: string; pinned: boolean };
  health: CidHealthResult;
}>;

export function publishJsonArtifact(
  client: IpfsStorageClient,
  input: {
    project: string;
    artifactKind: string;
    data: unknown;
    fileName?: string;
    contentType?: string;
    pin?: boolean;
    wrapWithDirectory?: boolean;
    extraMetadata?: Record<string, string | number | boolean | null | undefined>;
  },
): Promise<PublishResult & {
  artifactKind: string;
  metadata: MetadataRecord;
  verified: boolean;
  pinStatus: { cid: string; pinned: boolean };
  health: CidHealthResult;
}>;

export function createSkillMeshDefinitionMetadata(definition: Record<string, unknown> | null): {
  skillName: string;
  skillVersion: string;
  runtimeType: string;
  entrypoint?: string;
  chainable?: string;
  computeCost?: string;
};

export function publishSkillMeshDefinition(
  client: IpfsStorageClient,
  input: {
    inputPath: string;
    sourceProject?: string;
    readFileImpl?: (filePath: string, encoding: string) => Promise<string>;
    pin?: boolean;
    wrapWithDirectory?: boolean;
  },
): Promise<PublishResult & {
  artifactKind: string;
  metadata: MetadataRecord;
  verified: boolean;
  pinStatus: { cid: string; pinned: boolean };
  health: CidHealthResult;
}>;
