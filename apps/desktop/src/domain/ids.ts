const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encode(value: number, length: number): string {
  let result = '';
  for (let i = length - 1; i >= 0; i -= 1) {
    result = ALPHABET[value % 32] + result;
    value = Math.floor(value / 32);
  }
  return result;
}

export function createId(now = Date.now()): string {
  const bytes = new Uint8Array(RANDOM_LENGTH);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  let random = '';
  for (const byte of bytes) {
    random += ALPHABET[byte % 32];
  }
  return encode(now, TIME_LENGTH) + random;
}

export function isId(value: string): boolean {
  return value.length === TIME_LENGTH + RANDOM_LENGTH && /^[0-9A-HJKMNP-TV-Z]+$/.test(value);
}