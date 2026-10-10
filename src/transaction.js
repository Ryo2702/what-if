export const decisions = ['I would never sell', 'I would sell at the peak', 'I would keep half', 'I would buy more', 'I would wait one more day', 'I would take my investment back', 'I would hold until today'];
const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const networks = {
  ethereum: { name: 'Ethereum mainnet', format: 'evm', chainId: '0x1', rpc: 'https://ethereum-rpc.publicnode.com' },
  base: { name: 'Base mainnet', format: 'evm', chainId: '0x2105', rpc: 'https://base-rpc.publicnode.com' },
  arbitrum: { name: 'Arbitrum One', format: 'evm', chainId: '0xa4b1', rpc: 'https://arbitrum-one-rpc.publicnode.com' },
  solana: { name: 'Solana mainnet', format: 'solana', genesis: '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d', rpc: 'https://solana.publicnode.com' },
};
export const errorTitles = { INVALID_FORMAT: 'Invalid format', NOT_FOUND: 'Transaction not found', UNSUPPORTED_NETWORK: 'Unsupported network', API_FAILURE: 'API failure' };
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

export async function loadTransaction(value, selectedNetwork = 'ethereum', { signal, fetcher = fetch } = {}) {
  const detected = detectTransaction(value);
  if (!detected) throw new TransactionError('INVALID_FORMAT', 'Use 0x followed by 64 hex characters, or a Base58 Solana signature that decodes to exactly 64 bytes.');
  const networkKey = detected.format === 'solana' ? 'solana' : selectedNetwork;
  const network = Object.hasOwn(networks, networkKey) ? networks[networkKey] : null;
  if (!network || network.format !== detected.format) throw new TransactionError('UNSUPPORTED_NETWORK', 'Choose Ethereum, Base, Arbitrum One, or use a Solana mainnet signature. Other networks are not supported.');
  const timeout = AbortSignal.timeout(20000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  const call = (method, params = []) => rpc(network, method, params, requestSignal, fetcher);
  const failResponse = () => { throw new TransactionError('API_FAILURE', 'The blockchain service returned an incomplete or mismatched transaction. Please retry.'); };
  try {
    const identity = await call(detected.format === 'evm' ? 'eth_chainId' : 'getGenesisHash');
    if (typeof identity !== 'string') failResponse();
    if ((detected.format === 'evm' ? identity.toLowerCase() : identity) !== (network.chainId || network.genesis)) throw new TransactionError('UNSUPPORTED_NETWORK', 'The RPC service is connected to a different network. This transaction has not been verified.');
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
      return { demo: false, hash, network: network.name, status, from: transaction.from, block: transaction.blockNumber === null ? null : BigInt(transaction.blockNumber).toString(), value: `${BigInt(transaction.value)} wei` };
    }
    const transaction = await call('getTransaction', [hash, { encoding: 'json', commitment: 'confirmed', maxSupportedTransactionVersion: 1 }]);
    if (transaction === null) throw new TransactionError('NOT_FOUND', 'No confirmed transaction was found on Solana mainnet. Check the signature; the transaction may be unconfirmed or outside this provider’s retained history.');
    const payer = transaction?.transaction?.message?.accountKeys?.[0];
    if (transaction?.transaction?.signatures?.[0] !== hash || !Number.isSafeInteger(transaction.slot) || transaction.slot < 0 || !transaction.meta || !Object.hasOwn(transaction.meta, 'err') || decodeBase58(payer)?.length !== 32) failResponse();
    return { demo: false, hash, network: network.name, status: transaction.meta.err === null ? 'Confirmed' : 'Failed on-chain', block: String(transaction.slot), from: payer };
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeout.aborted) throw new TransactionError('API_FAILURE', 'The blockchain service timed out. Please retry.');
    if (error instanceof TransactionError) throw error;
    throw new TransactionError('API_FAILURE', 'The blockchain service returned an unreadable response. Please retry.');
  }
}

export function loadDemoTrade() {
  return {
    demo: true, hash: 'WHATIF-SYNTHETIC-TRADE-01', network: 'Fictional timeline', status: 'Synthetic trade',
    token: 'MEMORY', quantity: 1000, invested: 1000, proceeds: 2400,
    history: [
      { date: '2023-11-12', label: 'Bought 1,000 MEMORY', price: 1 },
      { date: '2023-12-08', label: 'Sold 1,000 MEMORY', price: 2.4 },
      { date: '2024-03-14', label: 'Synthetic peak', price: 8.6 },
      { date: '2024-04-19', label: 'After the rain', price: .7 },
    ],
  };
}
