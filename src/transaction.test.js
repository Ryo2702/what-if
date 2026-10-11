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

const marketAddress = 'HTTDbbgiUZQcoUeaQxZQdtWExCVeYeD8Ur6DjmLQErqr';
const marketLink = `https://trade.padre.gg/trade/solana/${marketAddress}`;
const marketPair = { chainId: 'solana', pairAddress: marketAddress, baseToken: { address: 'DCuJKYAhXrrfNkjboVAeEbE7RzHndcZe6kDekg9znoma', name: 'NomaMarkets', symbol: 'NOMA' }, quoteToken: { symbol: 'SOL' }, priceUsd: '0.00004039', marketCap: 40398.02, volume: { h24: 15905.12 } };
const marketFetch = body => ({ fetcher: async () => ({ ok: true, json: async () => body }) });
test('Padre Solana links preserve address case and reject unsupported or spoofed URLs', () => {
  assert.deepEqual(detectTransaction(` ${marketLink}/?ref=test `), { format: 'solana', kind: 'market', hash: marketAddress });
  for (const value of [marketLink.replace('https:', 'http:'), marketLink.replace('solana', 'base'), marketLink.replace('padre.gg', 'padre.gg.evil.com'), marketLink.replace(marketAddress, signature), marketLink + '/extra', marketLink.replace('trade.padre.gg', 'user@trade.padre.gg')]) assert.equal(detectTransaction(value), null);
});
test('Padre market lookup uses fixed Solana endpoint and returns readable market data', async () => {
  const result = await loadTransaction(marketLink, 'ethereum', { fetcher: async (url, options) => {
    assert.equal(url, `https://api.dexscreener.com/latest/dex/pairs/solana/${marketAddress}`);
    assert.ok(options.signal);
    return { ok: true, json: async () => ({ pairs: [marketPair] }) };
  } });
  assert.equal(result.kind, 'market'); assert.equal(result.network, 'Solana mainnet');
  assert.equal(result.token, 'NomaMarkets'); assert.equal(result.pair, 'NOMA / SOL');
  assert.equal(result.price, '$0.00004039'); assert.equal(result.liquidity, 'Unavailable');
  assert.equal(result.url, marketLink); assert.equal(result.from, undefined);
  const missing = await loadTransaction(marketLink, undefined, marketFetch({ pairs: [{ ...marketPair, priceUsd: null, marketCap: '', volume: { h24: -1 } }] }));
  assert.equal(missing.price, 'Unavailable'); assert.equal(missing.marketCap, 'Unavailable'); assert.equal(missing.volume, 'Unavailable');
});
test('market lookup distinguishes missing markets from malformed or failed responses', async () => {
  for (const pairs of [null, []]) await assert.rejects(loadTransaction(marketLink, undefined, marketFetch({ pairs })), { code: 'NOT_FOUND' });
  for (const body of [{}, { pairs: {} }, { pairs: [null] }, { pairs: [{ ...marketPair, chainId: 'base' }] }, { pairs: [{ ...marketPair, pairAddress: 'wrong' }] }, { pairs: [{ ...marketPair, baseToken: {} }] }]) await assert.rejects(loadTransaction(marketLink, undefined, marketFetch(body)), { code: 'API_FAILURE' });
  await assert.rejects(loadTransaction(marketLink, undefined, { fetcher: async () => ({ ok: false }) }), { code: 'API_FAILURE' });
});

const { simulatePath, reportLines } = await import('./scenario.js');
test('all seven paths account for cash, holdings and added contributions', () => {
  const expected = [700, 3000, 1550, 700 * (1 + 2 / 2.4), 1500, 1350, 700];
  for (let choice = 0; choice < 7; choice++) {
    const result = simulatePath(choice, 1000, .7);
    assert.ok(Math.abs(result.total - expected[choice]) < 1e-9);
    assert.equal(result.contributed, choice === 3 ? 3000 : 1000);
    assert.equal(result.profit, result.total - result.contributed);
    assert.equal(result.difference, result.profit - 1400);
    assert.equal(result.cash + result.held, result.total);
    assert.equal(result.actions.length, 6);
    assert.equal(simulatePath(choice, 1000, .7, 0).total, 1000);
  }
  assert.equal(simulatePath(0, 1000, .7).cash, 0);
  assert.equal(simulatePath(6, 1000, .7).held, 0);
  assert.equal(simulatePath(5, 1000, .7, 1).cash, 1000);
  assert.equal(simulatePath(5, 1000, .7, 1).held, 1000);
  assert.equal(simulatePath(4, 1000, .7, 3).cash, 0);
  assert.equal(simulatePath(4, 1000, .7, 4).cash, 1500);
  assert.equal(simulatePath(3, 1000, .7, 1).contributed, 1000);
  assert.equal(simulatePath(3, 1000, .7, 2).contributed, 3000);
});
test('ending changes affect exposed positions; malformed inputs are rejected', () => {
  assert.equal(simulatePath(0, 1000, 0).total, 0);
  assert.equal(simulatePath(1, 1000, 0).total, 3000);
  assert.equal(simulatePath(5, 1000, 0).total, 1000);
  assert.equal(simulatePath(3, 1000, 3).total, 5500);
  assert.equal(simulatePath(1, 1000, .7, 5, 8.6).total, 8600);
  for (const args of [[-1, 1000, .7], [7, 1000, .7], [0, 0, .7], [0, NaN, .7], [0, Infinity, .7], [0, 1e10, .7], [0, 1000, -1], [0, 1000, 4], [0, 1000, .7, 6], [0, 1000, .7, 5, 2], [0, 1000, .7, 5, Infinity]]) assert.throws(() => simulatePath(...args), RangeError);
});
test('export report carries calculation basis, contributions and limitations', () => {
  const lines = reportLines({ choice: 3, investment: 1000, ending: .7, peak: 3, token: 'NOMA', demo: false });
  assert.ok(lines.includes('WHAT-IF TIMELINE | NOMA'));
  assert.ok(lines.includes('Total contributed: $3,000.00'));
  assert.ok(lines.includes('Alternate value: $1,283.33'));
  assert.ok(lines.includes('Executable sale proceeds: unavailable.'));
  assert.ok(lines.some(line => line.includes('Historical liquidity: unavailable')));
  assert.ok(reportLines({ choice: 1, investment: 1000, ending: .7, peak: 8.6, token: 'MEMORY', demo: true }).includes('MEMORY TIMELINE | MEMORY'));
});
test('verified record exposes a canonical explorer and optional Solana timestamp', async () => {
  const events = [];
  const result = await loadTransaction(hash, 'ethereum', { ...evmRpc(), onProgress: line => events.push(line) });
  assert.equal(result.explorer, 'https://etherscan.io/tx/' + hash);
  assert.ok(events.some(line => line.includes('NETWORK VERIFIED')));
  assert.ok(!events.some(line => line.includes('LOADING HISTORICAL PRICES')));
  const transaction = { slot: 123, blockTime: 1700000000, meta: { err: null }, transaction: { signatures: [signature], message: { accountKeys: ['1'.repeat(32)] } } };
  const solana = await loadTransaction(signature, undefined, mockRpc({ getGenesisHash: networks.solana.genesis, getTransaction: transaction }));
  assert.equal(solana.timestamp, '2023-11-14T22:13:20.000Z');
  assert.equal(solana.explorer, 'https://solscan.io/tx/' + signature);
});
