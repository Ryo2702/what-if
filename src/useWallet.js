import { useEffect, useRef, useState } from 'react';
import { getWallets } from '@wallet-standard/app';
import { decodeBase58 } from './transaction.js';

export const walletOptions = [
  { name: 'Phantom', install: 'https://phantom.com/download', icon: '/wallets/phantom.svg' },
  { name: 'Solflare', install: 'https://www.solflare.com/download/', icon: '/wallets/solflare.svg' },
];
export const shortenAddress = address => `${address.slice(0, 4)}...${address.slice(-4)}`;
const hasSolana = chains => Array.isArray(chains) && chains.some(chain => typeof chain === 'string' && chain.startsWith('solana:'));
const supported = wallet => walletOptions.some(option => option.name === wallet.name);
const ready = wallet => hasSolana(wallet.chains) && ['connect', 'disconnect', 'events'].every(feature =>
  typeof wallet.features?.[`standard:${feature}`]?.[feature === 'events' ? 'on' : feature] === 'function');
const disconnected = { selectedWallet: null, walletAddress: '', connectionStatus: 'disconnected', walletProvider: null, connectionError: '' };

function solanaAddress(accounts) {
  if (!Array.isArray(accounts)) return '';
  return accounts.find(account => {
    const bytes = decodeBase58(account?.address);
    return hasSolana(account?.chains) && bytes?.length === 32 && account.publicKey?.length === 32 && bytes.every((byte, index) => byte === account.publicKey[index]);
  })?.address || '';
}

function connectionError(error) {
  if (error?.code === 4001 || /reject|denied|declined|cancel/i.test(error?.message || '')) return 'Connection rejected. No wallet was connected. Try again when ready.';
  if (/locked/i.test(error?.message || '')) return 'Wallet locked. Unlock it in the browser extension, then try again.';
  return 'Connection interrupted. Open and unlock the extension, close any pending request, then try again.';
}

export default function useWallet() {
  const [state, setState] = useState(disconnected), [wallets, setWallets] = useState([]), [walletLogs, setWalletLogs] = useState([]);
  const registry = useRef(null), active = useRef(null), mounted = useRef(false), disconnecting = useRef(false);
  // Wallet Standard has no transport flag; exclude mobile/in-app browsers and never load adapter fallbacks.
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function log(...lines) { if (mounted.current) setWalletLogs(previous => [...previous, ...lines]); }
  function release() {
    const session = active.current;
    active.current = null;
    if (session) { clearTimeout(session.timer); session.off?.(); }
    return session;
  }
  function reset(error = '', line = 'WALLET DISCONNECTED.') {
    release();
    if (mounted.current) { setState({ ...disconnected, connectionError: error }); log(line); }
  }
  useEffect(() => {
    mounted.current = true;
    const api = getWallets(); registry.current = api;
    const subscriptions = new Map();
    function sync() {
      const discovered = api.get().filter(supported);
      for (const [wallet, off] of subscriptions) if (!discovered.includes(wallet)) { off(); subscriptions.delete(wallet); }
      for (const wallet of discovered) {
        if (!subscriptions.has(wallet) && typeof wallet.features?.['standard:events']?.on === 'function') {
          subscriptions.set(wallet, wallet.features['standard:events'].on('change', sync));
        }
      }
      setWallets(walletOptions.map(option => {
        const matches = discovered.filter(wallet => wallet.name === option.name);
        const provider = matches.length === 1 ? matches[0] : null;
        return { ...option, provider, status: matches.length > 1 ? 'MULTIPLE PROVIDERS — RELOAD WITH ONE ENABLED' : !provider ? 'NOT DETECTED' : ready(provider) ? 'DETECTED' : 'NOT INITIALIZED', enabled: !mobile && !!provider && ready(provider) };
      }));
      const session = active.current;
      if (session && (!discovered.includes(session.wallet) || !ready(session.wallet) || discovered.filter(wallet => wallet.name === session.wallet.name).length !== 1)) reset('Wallet became unavailable or ambiguous. Reopen the extension and try again.');
    }
    const offRegister = api.on('register', sync), offUnregister = api.on('unregister', sync);
    sync();
    return () => { mounted.current = false; release(); offRegister(); offUnregister(); subscriptions.forEach(off => off()); };
  }, []);

  async function connect(wallet) {
    if (active.current || mobile || disconnecting.current) return;
    if (!registry.current?.get().includes(wallet) || !supported(wallet) || !ready(wallet)) {
      setState({ ...disconnected, connectionError: 'Extension not initialized. Open it, then reload this page.' }); return;
    }
    const session = { wallet, connected: false, off: null, timer: null };
    active.current = session;
    setState({ ...disconnected, selectedWallet: wallet.name, walletProvider: wallet, connectionStatus: 'connecting' });
    log('INITIALIZING WALLET CONNECTION...', `PROVIDER: ${wallet.name.toUpperCase()}`, 'REQUESTING PERMISSION...');
    try {
      session.off = wallet.features['standard:events'].on('change', change => {
        if (active.current !== session || !Object.hasOwn(change, 'accounts')) return;
        const address = solanaAddress(change.accounts);
        if (!address) { reset('', 'WALLET DISCONNECTED. NO AUTHORIZED SOLANA ACCOUNT.'); return; }
        // Connection events do not replace the result of the explicit permission request.
        if (session.connected) {
          setState(previous => ({ ...previous, walletAddress: address }));
          log(`WALLET ACCOUNT CHANGED: ${shortenAddress(address)}`);
        }
      });
      session.timer = setTimeout(() => {
        if (active.current === session) reset('Connection timed out. Close the pending extension popup before retrying.', 'WALLET CONNECTION TIMED OUT.');
      }, 60000);
      const result = await wallet.features['standard:connect'].connect({ silent: false });
      if (active.current !== session) return;
      const address = solanaAddress(result?.accounts);
      if (!address) { reset('The wallet did not authorize a valid Solana account.', 'NO AUTHORIZED SOLANA ACCOUNT.'); return; }
      clearTimeout(session.timer); session.connected = true;
      setState({ selectedWallet: wallet.name, walletAddress: address, connectionStatus: 'connected', walletProvider: wallet, connectionError: '' });
      log('CONNECTION ESTABLISHED', `PUBLIC ADDRESS: ${shortenAddress(address)}`, 'STATUS: CONNECTED');
    } catch (error) {
      if (active.current === session) reset(connectionError(error), 'WALLET CONNECTION FAILED. NO ACCOUNT CONNECTED.');
    }
  }

  async function disconnect() {
    const session = active.current;
    if (!session?.connected) return;
    disconnecting.current = true;
    reset();
    setState({ ...disconnected, connectionStatus: 'disconnecting' });
    let timer;
    try {
      await Promise.race([
        session.wallet.features['standard:disconnect'].disconnect(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), 10000); }),
      ]);
    } catch {
      if (mounted.current && !active.current) {
        setState({ ...disconnected, connectionError: 'Disconnected from WhatIf. The extension could not confirm disconnection; revoke site access in its settings if needed.' });
        log('LOCAL SESSION CLEARED. EXTENSION DISCONNECTION NOT CONFIRMED.');
      }
    } finally {
      clearTimeout(timer); disconnecting.current = false;
      if (mounted.current && !active.current) setState(previous => ({ ...previous, connectionStatus: 'disconnected' }));
    }
  }

  function cancelConnection() {
    if (active.current && !active.current.connected) reset('Connection cancelled here. Close any pending extension popup before retrying.', 'WALLET CONNECTION CANCELLED.');
  }
  return { ...state, wallets, walletLogs, mobile, connect, disconnect, cancelConnection };
}
