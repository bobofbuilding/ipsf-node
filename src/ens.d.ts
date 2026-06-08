export function normalizeIpfsCid(value: string): string;
export function cidToBytes(value: string): Uint8Array;
export function createEnsContenthash(value: string): {
  cid: string;
  uri: string;
  contenthash: string;
};
