import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBase58, detectTransaction, loadTransaction, loadDemoTrade, networks } from './transaction.js';

const hash = '0x' + 'ab'.repeat(32), signature = '1'.repeat(64);
const tx = { hash, from: '0x' + '12'.repeat(20), value: '0x123', blockNumber: '0x10', blockHash: '0x' + 'cd'.repeat(32) };
const receipt = { transactionHash: hash, blockNumber: tx.blockNumber, blockHash: tx.blockHash, status: '0x1' };
function mockRpc(results) {
  const calls = [];
  const fetcher = async (url, options) => {
    const body = JSON.parse(options.body); calls.push({ url, ...body });
    assert.ok(Object.hasOwn(results, body.method), `Unexpected RPC: ${body.method}`);
    return { ok: true, json: async () => ({ jsonrpc: '2.0', id: body.id, result: results[body.method] }) };
  };
  return { fetcher, calls };
}
const evmRpc = extra => mockRpc({ eth_chainId: '0x1', eth_getTransactionByHash: tx, eth_getTransactionReceipt: receipt, ...extra });

test('EVM exact format, case, trimming and rejection', () => {
  assert.deepEqual(detectTransaction('  ' + hash.toUpperCase().replace('0X', '0x') + '  '), { format: 'evm', hash });
  for (const value of ['', '0x' + 'a'.repeat(63), '0x' + 'a'.repeat(65), '0x' + 'g'.repeat(64), '0X' + 'a'.repeat(64), null]) assert.equal(detectTransaction(value), null);
});
test('Base58 decoding preserves leading zeros and verifies bytes, not character count', () => {
  assert.deepEqual([...decodeBase58('112')], [0, 0, 1]);
  assert.deepEqual([...decodeBase58('2g')], [97]);
  assert.equal(detectTransaction(signature)?.format, 'solana');
  assert.equal(detectTransaction('5'.repeat(88))?.format, 'solana');
  for (const value of ['1'.repeat(63), '1'.repeat(65), '1'.repeat(87), 'z'.repeat(88), '0'.repeat(88), 'O'.repeat(88), 'I'.repeat(88), 'l'.repeat(88), '5'.repeat(89)]) assert.equal(detectTransaction(value), null);
});
test('invalid formats and unsupported networks never call RPC', async () => {
  const mock = mockRpc({});
  await assert.rejects(loadTransaction('bad', 'ethereum', mock), { code: 'INVALID_FORMAT' });
  for (const network of ['other', 'solana', '__proto__']) await assert.rejects(loadTransaction(hash, network, mock), { code: 'UNSUPPORTED_NETWORK' });
  assert.equal(mock.calls.length, 0);
});
test('EVM verifies network, hash and receipt; reports actual receipt status', async () => {
  const mock = evmRpc();
  const result = await loadTransaction(hash, 'ethereum', mock);
  assert.equal(result.demo, false); assert.equal(result.status, 'Confirmed'); assert.equal(result.value, '291 wei'); assert.equal(result.block, '16');
  assert.deepEqual(mock.calls.map(c => c.method), ['eth_chainId', 'eth_getTransactionByHash', 'eth_getTransactionReceipt']);
  assert.equal((await loadTransaction(hash, 'ethereum', evmRpc({ eth_getTransactionReceipt: { ...receipt, status: '0x0' } }))).status, 'Failed on-chain');
  const pending = evmRpc({ eth_getTransactionByHash: { ...tx, blockNumber: null } });
  assert.equal((await loadTransaction(hash, 'ethereum', pending)).status, 'Pending'); assert.equal(pending.calls.length, 2);
});
test('selected EVM network chooses the endpoint', async () => {
  for (const key of ['base', 'arbitrum']) {
    const mock = evmRpc({ eth_chainId: networks[key].chainId });
    assert.equal((await loadTransaction(hash, key, mock)).network, networks[key].name);
    assert.ok(mock.calls.every(call => call.url === networks[key].rpc));
  }
});
test('not found is distinct from wrong network and malformed or mismatched responses', async () => {
  await assert.rejects(loadTransaction(hash, 'ethereum', evmRpc({ eth_getTransactionByHash: null })), { code: 'NOT_FOUND' });
  await assert.rejects(loadTransaction(hash, 'ethereum', evmRpc({ eth_chainId: '0x89' })), { code: 'UNSUPPORTED_NETWORK' });
  for (const extra of [{ eth_getTransactionByHash: {} }, { eth_getTransactionByHash: { ...tx, hash: '0x' + 'ff'.repeat(32) } }, { eth_getTransactionReceipt: null }, { eth_getTransactionReceipt: { ...receipt, blockHash: 'wrong' } }]) await assert.rejects(loadTransaction(hash, 'ethereum', evmRpc(extra)), { code: 'API_FAILURE' });
});
test('Solana auto-routes, verifies cluster and signature, and preserves failure status', async () => {
  const transaction = { slot: 123, meta: { err: null }, transaction: { signatures: [signature], message: { accountKeys: ['1'.repeat(32)] } } };
  const mock = mockRpc({ getGenesisHash: networks.solana.genesis, getTransaction: transaction });
  const result = await loadTransaction(signature, 'other', mock);
  assert.equal(result.network, 'Solana mainnet'); assert.equal(result.status, 'Confirmed'); assert.equal(result.block, '123');
  assert.equal(mock.calls[1].params[1].maxSupportedTransactionVersion, 1);
  for (const [value, code] of [[null, 'NOT_FOUND'], [{ ...transaction, transaction: { signatures: ['wrong'] } }, 'API_FAILURE']]) await assert.rejects(loadTransaction(signature, undefined, mockRpc({ getGenesisHash: networks.solana.genesis, getTransaction: value })), { code });
  const failed = { ...transaction, meta: { err: { InstructionError: [0, 'error'] } } };
  assert.equal((await loadTransaction(signature, undefined, mockRpc({ getGenesisHash: networks.solana.genesis, getTransaction: failed }))).status, 'Failed on-chain');
  await assert.rejects(loadTransaction(signature, undefined, mockRpc({ getGenesisHash: 'devnet' })), { code: 'UNSUPPORTED_NETWORK' });
});
test('HTTP, transport, JSON and RPC failures are API failures, never not-found', async () => {
  for (const fetcher of [async () => { throw new TypeError('network'); }, async () => ({ ok: false, status: 429 }), async () => ({ ok: true, json: async () => { throw new SyntaxError(); } }), async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 1, error: { code: -32000 } }) }), async () => ({ ok: true, json: async () => ({ jsonrpc: '2.0', id: 2, result: '0x1' }) })]) await assert.rejects(loadTransaction(hash, 'ethereum', { fetcher }), { code: 'API_FAILURE' });
});
test('cancelled requests are not returned as results', async () => {
  const controller = new AbortController();
  const fetcher = async (_url, { signal }) => { controller.abort(); throw signal.reason; };
  await assert.rejects(loadTransaction(hash, 'ethereum', { fetcher, signal: controller.signal }), { name: 'AbortError' });
});
test('demo is synthetic, isolated, and cannot call fetch', () => {
  const original = globalThis.fetch; globalThis.fetch = () => { throw new Error('Demo must be offline'); };
  try {
    const demo = loadDemoTrade(); assert.equal(demo.demo, true); assert.equal(demo.history.length, 4);
    assert.equal(demo.proceeds, demo.quantity * demo.history[1].price);
    assert.equal(demo.invested, demo.quantity * demo.history[0].price);
    demo.history[0].price = 999; assert.equal(loadDemoTrade().history[0].price, 1);
  } finally { globalThis.fetch = original; }
});
