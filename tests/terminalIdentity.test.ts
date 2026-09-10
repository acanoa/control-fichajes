import assert from 'node:assert/strict';
import test from 'node:test';
import { checkTerminalStorage, saveTerminalToken, TERMINAL_TOKEN_KEY, validateStoredTerminal } from '../src/features/devices/services/terminalIdentity.js';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

test('conserva la identidad si Supabase devuelve un error o falla la red', async () => {
  const storage = memoryStorage();
  saveTerminalToken(storage, 'test-terminal');
  await assert.rejects(validateStoredTerminal(storage, async () => ({ data: null, error: new Error('unavailable') })), /conserva/);
  await assert.rejects(validateStoredTerminal(storage, async () => { throw new Error('offline'); }), /conserva/);
  assert.equal(storage.getItem(TERMINAL_TOKEN_KEY), 'test-terminal');
});

test('permite revalidar la misma identidad tras reactivar el dispositivo o su centro', async () => {
  const storage = memoryStorage();
  saveTerminalToken(storage, 'test-terminal');
  assert.equal(await validateStoredTerminal(storage, async () => ({ data: null, error: null })), null);
  const device = { status: 'active', camera_validation_status: 'validated' };
  assert.deepEqual(await validateStoredTerminal(storage, async token => {
    assert.equal(token, 'test-terminal');
    return { data: device, error: null };
  }), device);
});

test('refleja la aprobación administrativa al volver a consultar el mismo token', async () => {
  const storage = memoryStorage();
  saveTerminalToken(storage, 'test-terminal');
  let status = 'pending';
  const validate = async () => ({ data: { status }, error: null });
  assert.equal((await validateStoredTerminal(storage, validate))?.status, 'pending');
  status = 'active';
  assert.equal((await validateStoredTerminal(storage, validate))?.status, 'active');
});

test('sin identidad local no consulta ni autoriza otro dispositivo por su nombre', async () => {
  assert.equal(await validateStoredTerminal(memoryStorage(), async () => {
    assert.fail('No debe consultar sin token');
  }), null);
});

test('detecta almacenamiento bloqueado y escrituras que no persisten', () => {
  const blocked = { ...memoryStorage(), setItem: () => { throw new Error('quota'); } };
  const silent = { ...memoryStorage(), setItem: () => {} };
  for (const storage of [blocked, silent]) {
    assert.throws(() => checkTerminalStorage(storage), /almacenamiento/);
    assert.throws(() => saveTerminalToken(storage, 'test-terminal'), /almacenamiento/);
  }
});

test('la comprobación de almacenamiento conserva la identificación existente', () => {
  const storage = memoryStorage();
  saveTerminalToken(storage, 'test-terminal');
  checkTerminalStorage(storage);
  assert.equal(storage.getItem(TERMINAL_TOKEN_KEY), 'test-terminal');
});
