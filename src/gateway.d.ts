export function normalizeIpfsCid(value: string): string;

export function buildGatewayUrl(input: {
  gatewayBaseUrl: string;
  cid: string;
  path?: string;
}): string;

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
