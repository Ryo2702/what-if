import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import gsap from 'gsap';
import { Wallet, X, LoaderCircle } from 'lucide-react';
import { shortenAddress } from './useWallet';

function WalletDialog({ wallet, paused, onClose }) {
  const dialog = useRef(null);
  const connecting = wallet.connectionStatus === 'connecting';
  useEffect(() => { dialog.current.showModal(); }, []);
  useEffect(() => { if (wallet.connectionStatus === 'connected') onClose(); }, [wallet.connectionStatus]);
  return <motion.dialog ref={dialog} className="wallet-modal" aria-labelledby="wallet-title" aria-describedby="wallet-help"
    initial={paused ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: paused ? 0 : -8 }} transition={{ duration: paused ? 0 : .16 }}
    onCancel={event => { event.preventDefault(); onClose(); }} onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = dialog.current.querySelectorAll('button:not(:disabled), a[href]');
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
    <div className="window-bar"><span>WHATIF://WALLET_CONNECTION</span><button onClick={onClose} aria-label="Close wallet selection"><X size={18}/></button></div>
    <div className="wallet-modal-body"><h2 id="wallet-title">SELECT WALLET PROVIDER<span className="cursor" aria-hidden="true">_</span></h2>
      <p id="wallet-help" className="data-note">Desktop browser extensions only. Public address access; no signing or transactions.</p>
      {wallet.mobile && <p className="wallet-notice">Desktop browser extensions are required. Open WhatIf on a desktop browser with Phantom or Solflare installed. Mobile wallet apps are not supported.</p>}
      <div className="wallet-options">{wallet.wallets.map((option, index) => <motion.div className="wallet-option" key={option.name} whileHover={paused ? undefined : { x: 2 }} transition={{ duration: .12 }}>
        <div className="wallet-provider"><img src={option.icon} width="32" height="32" alt=""/><h3>[0{index + 1}] {option.name}</h3></div>
        <p>STATUS: <span className={option.enabled ? 'positive' : ''}>{option.status}</span></p>
        {option.status === 'NOT DETECTED' ? <a className="wallet-action" href={option.install} target="_blank" rel="noopener noreferrer" aria-label={`Install ${option.name} browser extension`}>[ INSTALL → ]</a> :
          <button disabled={!option.enabled || connecting} onClick={() => wallet.connect(option.provider)} aria-label={`Connect ${option.name}`}>[ CONNECT → ]</button>}
      </motion.div>)}</div>
      {!wallet.mobile && wallet.wallets.some(option => !option.enabled) && <p className="data-note">Not detected? Install or enable the extension, open it to finish setup, then reload this page.</p>}
      {connecting && <p role="status" className="wallet-progress"><LoaderCircle className="loading-icon" size={16}/> Waiting for {wallet.selectedWallet} approval. Unlock the extension if needed.</p>}
      {wallet.connectionError && <motion.p role="alert" className="form-error" initial={paused ? false : { opacity: 0, x: -3 }} animate={{ opacity: 1, x: 0 }}>{wallet.connectionError}</motion.p>}
      <button className="wallet-close" onClick={onClose}>[ ESC ] {connecting ? 'CANCEL / CLOSE' : 'CLOSE'}</button>
    </div>
  </motion.dialog>;
}

export default function WalletControl({ wallet, paused }) {
  const [selection, setSelection] = useState(false), [menu, setMenu] = useState(false), [copyStatus, setCopyStatus] = useState(''), [notice, setNotice] = useState(false);
  const root = useRef(null), trigger = useRef(null), firstAction = useRef(null), toast = useRef(null);
  const connected = wallet.connectionStatus === 'connected';
  useEffect(() => {
    if (!connected) { setMenu(false); setNotice(false); return; }
    setNotice(true);
    const timer = setTimeout(() => setNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [connected]);
  useEffect(() => {
    if (!notice || paused) return;
    const tween = gsap.fromTo(toast.current, { opacity: 0, y: -5 }, { opacity: 1, y: 0, duration: .2, ease: 'steps(3)' });
    return () => { tween.progress(1); tween.kill(); };
  }, [notice, paused]);
  useEffect(() => { setCopyStatus(''); }, [wallet.walletAddress, menu]);
  useEffect(() => {
    if (!menu) return;
    firstAction.current?.focus();
    function outside(event) { if (!root.current?.contains(event.target)) setMenu(false); }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('focusin', outside); };
  }, [menu]);
  function closeSelection() { wallet.cancelConnection(); setSelection(false); }
  async function copyAddress() {
    try { await navigator.clipboard.writeText(wallet.walletAddress); setCopyStatus('Full address copied.'); }
    catch { setCopyStatus('Clipboard unavailable. Select and copy the full address above.'); }
  }
  return <div className="wallet-control" ref={root} onKeyDown={event => {
    if (event.key === 'Escape' && menu) { event.stopPropagation(); setMenu(false); trigger.current.focus(); }
  }}>
    <button ref={trigger} className={`wallet-trigger ${connected ? 'is-connected' : ''}`} aria-label={connected ? `Solana wallet ${shortenAddress(wallet.walletAddress)}. Open wallet details` : 'Connect wallet'}
      aria-expanded={selection || menu} aria-haspopup="dialog" disabled={wallet.connectionStatus === 'disconnecting'} onClick={() => connected ? setMenu(!menu) : setSelection(true)}>
      <Wallet className="wallet-mobile-icon" size={18}/><span className="wallet-button-label">{connected ? `[ SOL ● ${shortenAddress(wallet.walletAddress)} ]` : '[ > CONNECT WALLET ]'}</span>{connected && <i className="wallet-mobile-dot" aria-hidden="true"/>}
    </button>
    <AnimatePresence onExitComplete={() => requestAnimationFrame(() => trigger.current?.focus())}>{selection && <WalletDialog key="selection" wallet={wallet} paused={paused} onClose={closeSelection}/>}</AnimatePresence>
    <AnimatePresence>{menu && connected && <motion.div className="wallet-menu" role="dialog" aria-label="Connected wallet" initial={paused ? false : { opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: paused ? 0 : .12 }}>
      <div className="wallet-menu-heading"><h2>{wallet.selectedWallet}</h2><button aria-label="Close wallet details" onClick={() => { setMenu(false); trigger.current.focus(); }}><X size={16}/></button></div>
      <p className="positive">SOL ● CONNECTED</p><p>{shortenAddress(wallet.walletAddress)}</p><code tabIndex={0} aria-label="Full public address">{wallet.walletAddress}</code>
      <button ref={firstAction} onClick={copyAddress}>COPY ADDRESS</button><a className="wallet-action" href={`https://solscan.io/account/${wallet.walletAddress}`} target="_blank" rel="noopener noreferrer">VIEW ON SOLSCAN ↗</a>
      <button onClick={() => { wallet.disconnect(); setMenu(false); trigger.current.focus(); }}>DISCONNECT WALLET</button>
      <p role="status">{copyStatus}</p>
    </motion.div>}</AnimatePresence>
    {notice && <div ref={toast} role="status" className="wallet-toast"><span className="pixel-square"/> CONNECTION ESTABLISHED</div>}
    {!selection && wallet.connectionError && <p className="sr-only" role="alert">{wallet.connectionError}</p>}
  </div>;
}
