import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { requestId } from '../packages/shared/request-id.mjs';
test('Las acciones generan claves únicas por HTTP sin randomUUID', () => {
  const httpCrypto = {getRandomValues: bytes => webcrypto.getRandomValues(bytes)};
  const ids = Array.from({length:100},()=>requestId(httpCrypto));
  assert.equal(new Set(ids).size,100);
  for(const id of ids) assert.match(id,/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
});
test('Usa randomUUID cuando está disponible', () => {
  assert.equal(requestId({randomUUID:()=> 'native-id'}),'native-id');
});
