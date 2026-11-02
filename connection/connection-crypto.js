// Server-only credential and cookie helpers; never a public reader asset.
const encoder = new TextEncoder();
export const base64url = bytes => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
const decode = text => {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]+$/.test(text) || text.length > 24000) throw Error('Invalid protected value');
  return Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - text.length % 4) % 4)), c => c.charCodeAt(0));
};
export const randomToken = () => base64url(crypto.getRandomValues(new Uint8Array(32)));
export const digest = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(v => v.toString(16).padStart(2, '0')).join('');
export const challenge = async verifier => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier))));
async function keyFor(secret, usage) {
  const bytes = decode(secret);
  if (bytes.length !== 32) throw Error('Connection setup needs its private key');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, [usage]);
}
export async function seal(value, secret, purpose) {
  if (typeof purpose !== 'string' || !purpose) throw Error('Protected value needs a purpose');
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(`Bradbury Cabin v1:${purpose}`) }, await keyFor(secret, 'encrypt'), encoder.encode(JSON.stringify(value)));
  return `1.${base64url(nonce)}.${base64url(new Uint8Array(ciphertext))}`;
}
export async function open(value, secret, purpose) {
  try {
    const parts = String(value).split('.');
    if (parts.length !== 3 || parts[0] !== '1' || typeof purpose !== 'string' || !purpose) throw Error();
    const nonce = decode(parts[1]); if (nonce.length !== 12) throw Error();
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(`Bradbury Cabin v1:${purpose}`) }, await keyFor(secret, 'decrypt'), decode(parts[2]));
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch { throw Error('The protected connection needs reconnecting'); }
}
