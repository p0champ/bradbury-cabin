import test from 'node:test';
import assert from 'node:assert/strict';
import { randomToken, digest, challenge, seal, open } from '../connection/connection-crypto.js';
test('encrypted credentials restore exactly but do not appear in stored ciphertext', async () => {
  const key = randomToken(), value = { refresh: 'fixture-only-google-refresh', owner: 'fixture-owner' };
  const stored = await seal(value, key, 'google-refresh:fixture-owner');
  assert.equal(stored.includes(value.refresh), false); assert.deepEqual(await open(stored, key, 'google-refresh:fixture-owner'), value);
  assert.notEqual(await seal(value, key, 'google-refresh:fixture-owner'), stored, 'every encryption gets a fresh nonce');
});
test('tampering, wrong owner/purpose, wrong key and malformed ciphertext fail without exposing private values', async () => {
  const key = randomToken(), stored = await seal({ refresh: 'fixture-only' }, key, 'google-refresh:owner-A');
  for (const [value, otherKey, purpose] of [[stored, key, 'oauth-cookie'], [stored, key, 'google-refresh:owner-B'], [stored, randomToken(), 'google-refresh:owner-A'], [stored.slice(0, -4), key, 'google-refresh:owner-A'], ['bad', key, 'google-refresh:owner-A']]) {
    await assert.rejects(open(value, otherKey, purpose), error => error.message === 'The protected connection needs reconnecting');
  }
});
test('PKCE uses the published S256 vector and random tokens contain 256 bits', async () => {
  assert.equal(await challenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  assert.match(randomToken(), /^[A-Za-z0-9_-]{43}$/); assert.notEqual(randomToken(), randomToken());
  assert.match(await digest('fixture token'), /^[a-f0-9]{64}$/);
});
