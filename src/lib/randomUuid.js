// UUID v4 from the Crypto primitive available in both HTTP content worlds and
// extension pages. Identity has one entropy source, not a weaker fallback path.
export function createRandomUuid(cryptoRef = globalThis.crypto) {
  if (typeof cryptoRef?.getRandomValues !== 'function') {
    throw new Error('UUID_RANDOM_SOURCE_UNAVAILABLE');
  }
  const bytes = new Uint8Array(16);
  cryptoRef.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
