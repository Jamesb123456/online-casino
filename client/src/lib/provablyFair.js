const encoder = new TextEncoder();

function getSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('WebCrypto SubtleCrypto is not available in this environment');
  }
  return subtle;
}

function bufferToHex(buffer) {
  const bytes = new Uint8Array(buffer);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function hashServerSeed(serverSeed) {
  const digest = await getSubtle().digest('SHA-256', encoder.encode(serverSeed));
  return bufferToHex(digest);
}

async function hmacSha256Hex(key, message) {
  const subtle = getSubtle();
  // Server uses the raw serverSeed string as the HMAC key (not its bytes-from-hex),
  // so we encode the key the same way to stay byte-identical.
  const cryptoKey = await subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await subtle.sign('HMAC', cryptoKey, encoder.encode(message));
  return bufferToHex(signature);
}

export async function generateResult(serverSeed, clientSeed, nonce) {
  const hex = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);
  const intValue = parseInt(hex.substring(0, 8), 16);
  return intValue / 0xffffffff;
}

export async function verifyResult({ serverSeed, serverSeedHash, clientSeed, nonce }) {
  const computedHash = await hashServerSeed(serverSeed);
  const serverSeedHashMatch = computedHash === serverSeedHash;
  const result = await generateResult(serverSeed, clientSeed, nonce);
  return {
    valid: serverSeedHashMatch,
    result,
    serverSeedHashMatch,
  };
}

export async function generateCrashPoint(serverSeed, clientSeed, nonce, houseEdge = 0.01) {
  const result = await generateResult(serverSeed, clientSeed, nonce);
  if (result < houseEdge) return 1.0;
  const crashPoint = Math.floor((1 / (1 - result)) * 100) / 100;
  return Math.max(1.0, crashPoint);
}

export async function generateRouletteNumber(serverSeed, clientSeed, nonce) {
  const result = await generateResult(serverSeed, clientSeed, nonce);
  return Math.floor(result * 37);
}
