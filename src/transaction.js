export const decisions = ['NEVER SOLD', 'SOLD AT ATH', 'SOLD 50%, HELD 50%', 'BOUGHT 2× MORE', 'SOLD ONE DAY LATER', 'TOOK INITIAL INVESTMENT AT 2×', 'HELD UNTIL TODAY'];
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const networks = {
  ethereum: { name: 'Ethereum mainnet', format: 'evm', chainId: '0x1', rpc: 'https://ethereum-rpc.publicnode.com' },
  base: { name: 'Base mainnet', format: 'evm', chainId: '0x2105', rpc: 'https://base-rpc.publicnode.com' },
  arbitrum: { name: 'Arbitrum One', format: 'evm', chainId: '0xa4b1', rpc: 'https://arbitrum-one-rpc.publicnode.com' },
  solana: { name: 'Solana mainnet', format: 'solana', genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', rpc: 'https://solana.publicnode.com' },
};
export const errorTitles = { INVALID_FORMAT: 'Invalid format', NOT_FOUND: 'No result found', UNSUPPORTED_NETWORK: 'Unsupported network', API_FAILURE: 'API failure' };
export class TransactionError extends Error {
  constructor(code, message) { super(message); this.name = 'TransactionError'; this.code = code; }
}

export function decodeBase58(value) {
  if (typeof value !== 'string' || !value.length || value.length > 88) return null;
  let number = 0n;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return null;
    number = number * 58n + BigInt(digit);
  }
  const bytes = [];
  while (number > 0n) { bytes.push(Number(number & 255n)); number >>= 8n; }
  for (const character of value) { if (character !== '1') break; bytes.push(0); }
  return Uint8Array.from(bytes.reverse());
}

export function detectTransaction(value) {
  if (typeof value !== 'string') return null;
  const hash = value.trim();
  try {
    const url = new URL(hash);
    const match = url.pathname.match(/^\/trade\/solana\/([1-9A-HJ-NP-Za-km-z]+)\/?$/);
    if (url.origin === 'https://trade.padre.gg' && !url.username && !url.password && match && decodeBase58(match[1])?.length === 32) return { format: 'solana', kind: 'market', hash: match[1] };
  } catch { /* Plain transaction hashes are not URLs. */ }
  if (/^0x[\da-f]{64}$/.test(hash.toLowerCase()) && hash.startsWith('0x')) return { format: 'evm', hash: hash.toLowerCase() };
  if (decodeBase58(hash)?.length === 64) return { format: 'solana', hash };
  return null;
}

async function rpc(network, method, params, signal, fetcher) {
  try {
    const response = await fetcher(network.rpc, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (body?.jsonrpc !== '2.0' || body.id !== 1 || body.error || !Object.hasOwn(body, 'result')) throw new Error('Invalid RPC response');
    return body.result;
  } catch (error) {
    if (signal.aborted) throw signal.reason;
    throw new TransactionError('API_FAILURE', 'The blockchain service could not complete the request. It may be unavailable, rate limited, or blocked by your browser. Try again.');
  }
}

export async function loadTransaction(value, selectedNetwork = 'ethereum', { signal, fetcher = fetch, onProgress = () => {} } = {}) {
  const detected = detectTransaction(value);
  if (!detected) throw new TransactionError('INVALID_FORMAT', 'Paste a Padre Solana market link, an EVM transaction hash (0x + 64 hex characters), or a Solana transaction signature.');
  const networkKey = detected.format === 'solana' ? 'solana' : selectedNetwork;
  const network = Object.hasOwn(networks, networkKey) ? networks[networkKey] : null;
  if (!network || network.format !== detected.format) throw new TransactionError('UNSUPPORTED_NETWORK', 'Choose Ethereum, Base, Arbitrum One, or use a Solana mainnet signature. Other networks are not supported.');
  onProgress(`FORMAT VALIDATED · ${network.name.toUpperCase()}`);
  const timeout = AbortSignal.timeout(20000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const call = (method, params = []) => rpc(network, method, params, requestSignal, fetcher);
  const failResponse = () => { throw new TransactionError('API_FAILURE', 'The blockchain service returned an incomplete or mismatched transaction. Please retry.'); };
  try {
    if (detected.kind === 'market') {
      onProgress('FETCHING CURRENT MARKET SNAPSHOT...');
      const response = await fetcher(`https://api.dexscreener.com/latest/dex/pairs/solana/${detected.hash}`, { signal: requestSignal });
      if (!response.ok) throw new TransactionError('API_FAILURE', 'Market data is unavailable. Please retry.');
      const body = await response.json();
      if (body?.pairs === null || (Array.isArray(body?.pairs) && body.pairs.length === 0)) throw new TransactionError('NOT_FOUND', 'This Solana market is not indexed by DEX Screener yet. Check the link or try again later.');
      if (!Array.isArray(body?.pairs)) failResponse();
      const pair = body.pairs.find(pair => pair?.chainId === 'solana' && pair.pairAddress === detected.hash);
      if (!pair || typeof pair.baseToken?.name !== 'string' || typeof pair.baseToken?.symbol !== 'string' || decodeBase58(pair.baseToken?.address)?.length !== 32 || typeof pair.quoteToken?.symbol !== 'string') failResponse();
      const usd = value => (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumSignificantDigits: 6 }).format(Number(value)) : 'Unavailable';
      onProgress('MARKET SNAPSHOT MATCHED.');
      onProgress('HISTORICAL PRICE DATA UNAVAILABLE.');
      return { kind: 'market', network: network.name, hash: detected.hash, token: pair.baseToken.name, symbol: pair.baseToken.symbol, address: pair.baseToken.address, pair: `${pair.baseToken.symbol} / ${pair.quoteToken.symbol}`, price: usd(pair.priceUsd), marketCap: usd(pair.marketCap), liquidity: usd(pair.liquidity?.usd), volume: usd(pair.volume?.h24), url: `https://trade.padre.gg/trade/solana/${detected.hash}` };
    }
    onProgress('VERIFYING RPC NETWORK...');
    const identity = await call(detected.format === 'evm' ? 'eth_chainId' : 'getGenesisHash');
    if (typeof identity !== 'string') failResponse();
    if ((detected.format === 'evm' ? identity.toLowerCase() : identity) !== (network.chainId || network.genesis)) throw new TransactionError('UNSUPPORTED_NETWORK', 'The RPC service is connected to a different network. This transaction has not been verified.');
    onProgress('NETWORK VERIFIED · FETCHING TRANSACTION...');
    const hash = detected.hash;
    if (detected.format === 'evm') {
      const transaction = await call('eth_getTransactionByHash', [hash]);
      if (transaction === null) throw new TransactionError('NOT_FOUND', `No transaction was found on ${network.name}. Check the selected network and hash; pending or unavailable history may not be indexed yet.`);
      if (transaction?.hash?.toLowerCase() !== hash || !/^0x[\da-f]{40}$/i.test(transaction.from) || !/^0x[\da-f]+$/i.test(transaction.value)) failResponse();
      if (transaction.chainId && transaction.chainId.toLowerCase() !== network.chainId) failResponse();
      let status = 'Pending';
      if (transaction.blockNumber !== null) {
        if (!/^0x[\da-f]+$/i.test(transaction.blockNumber) || !/^0x[\da-f]{64}$/i.test(transaction.blockHash)) failResponse();
        const receipt = await call('eth_getTransactionReceipt', [hash]);
        if (receipt?.transactionHash?.toLowerCase() !== hash || receipt.blockHash !== transaction.blockHash || receipt.blockNumber !== transaction.blockNumber || !['0x0', '0x1'].includes(receipt.status)) failResponse();
        status = receipt.status === '0x1' ? 'Confirmed' : 'Failed on-chain';
      }
      onProgress('TRANSACTION VERIFIED.');
      onProgress('TRADE RECONSTRUCTION UNAVAILABLE.');
      const explorer = { ethereum: 'https://etherscan.io/tx/', base: 'https://basescan.org/tx/', arbitrum: 'https://arbiscan.io/tx/' }[networkKey];
      return { demo: false, hash, network: network.name, status, explorer: explorer + hash, from: transaction.from, block: transaction.blockNumber === null ? null : BigInt(transaction.blockNumber).toString(), value: `${BigInt(transaction.value)} wei` };
    }
    const transaction = await call('getTransaction', [hash, { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 1 }]);
    if (transaction === null) throw new TransactionError('NOT_FOUND', 'No confirmed transaction was found on Solana mainnet. Check the signature; the transaction may be unconfirmed or outside this provider’s retained history.');
    const payer = transaction?.transaction?.message?.accountKeys?.[0];
    if (transaction?.transaction?.signatures?.[0] !== hash || !Number.isSafeInteger(transaction.slot) || transaction.slot < 0 || !transaction.meta || !Object.hasOwn(transaction.meta, 'err') || decodeBase58(payer)?.length !== 32) failResponse();
    onProgress('TRANSACTION VERIFIED.');
    onProgress('TRADE RECONSTRUCTION UNAVAILABLE.');
    const timestamp = Number.isSafeInteger(transaction.blockTime) && transaction.blockTime > 0 && transaction.blockTime < 8640000000000 ? new Date(transaction.blockTime * 1000).toISOString() : null;
    return { demo: false, hash, network: network.name, explorer: `https://solscan.io/tx/${hash}`, timestamp, status: transaction.meta.err === null ? 'Confirmed' : 'Failed on-chain', block: String(transaction.slot), from: payer };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw new TransactionError('API_FAILURE', 'The blockchain service timed out. Please retry.');
    if (error instanceof TransactionError) throw error;
    throw new TransactionError('API_FAILURE', detected.kind === 'market' ? 'The market data service could not complete the request. Please retry.' : 'The blockchain service returned an unreadable response. Please retry.');
  }
}

export function loadDemoTrade() {
  return {
    demo: true, hash: 'WHATIF-MEMORY-01', network: 'MEMORY timeline', status: 'Scenario inputs',
    token: 'MEMORY', quantity: 1000, invested: 1000, proceeds: 2400,
    history: [
      { date: '2023-11-12', label: 'Bought 1,000 MEMORY', price: 1 },
      { date: '2023-12-08', label: 'Sold 1,000 MEMORY', price: 2.4 },
      { date: '2024-03-14', label: 'Scenario peak', price: 8.6 },
      { date: '2024-04-19', label: 'After the rain', price: .7 },
    ],
  };
}
