const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE32_ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

function bytesToHex(bytes) {
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function concatBytes(...chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function decodeBase58btc(value) {
  const digits = [0];
  for (const char of value) {
    const index = BASE58_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error(`Unsupported base58btc character: ${char}`);
    }

    let carry = index;
    for (let i = 0; i < digits.length; i += 1) {
      const x = digits[i] * 58 + carry;
      digits[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      digits.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (const char of value) {
    if (char !== "1") break;
    digits.push(0);
  }

  return Uint8Array.from(digits.reverse());
}

function decodeBase32(value) {
  const normalized = value.toLowerCase().replace(/=+$/, "");
  let bits = 0;
  let valueBuffer = 0;
  const output = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index < 0) {
      throw new Error(`Unsupported base32 character: ${char}`);
    }
    valueBuffer = (valueBuffer << 5) | index;
    bits += 5;
    while (bits >= 8) {
      output.push((valueBuffer >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return Uint8Array.from(output);
}

export function normalizeIpfsCid(value) {
  const cid = String(value || "")
    .trim()
    .replace(/^ipfs:\/\//i, "")
    .replace(/^\/+/, "")
    .replace(/^ipfs\/+/i, "")
    .trim();
  if (!cid) {
    throw new Error("IPFS CID is required.");
  }
  return cid;
}

export function cidToBytes(value) {
  const cid = normalizeIpfsCid(value);
  if (cid.startsWith("Qm")) {
    return decodeBase58btc(cid);
  }
  if (cid.startsWith("z")) {
    return decodeBase58btc(cid.slice(1));
  }
  if (cid.startsWith("b")) {
    return decodeBase32(cid.slice(1));
  }
  throw new Error("Unsupported CID multibase. Expected CIDv0 Qm..., base58btc z..., or CIDv1 base32 b....");
}

export function createEnsContenthash(value) {
  const cid = normalizeIpfsCid(value);
  const ipfsNsCodec = Uint8Array.from([0xe3, 0x01]);
  const bytes = concatBytes(ipfsNsCodec, cidToBytes(cid));
  return {
    cid,
    uri: `ipfs://${cid}`,
    contenthash: bytesToHex(bytes),
  };
}
