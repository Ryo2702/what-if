import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Volume2, VolumeX, X, Terminal, Pause, Play, BookOpen } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import MemoryTerminal from './MemoryTerminal';
import useWallet from './useWallet';
import WalletControl from './WalletControl';
import './style.css';
import './wallet.css';

function App() {
  const reduced = useReducedMotion();
  const wallet = useWallet();
  const [sound, setSound] = useState(false), [paused, setPaused] = useState(false), [about, setAbout] = useState(false), [error, setError] = useState('');
  const audio = useRef(null), dialog = useRef(null);
  useEffect(() => () => { audio.current?.close(); }, []);
  useEffect(() => { if (about) dialog.current.showModal(); }, [about]);
  function tone(enabled = sound) {
    if (!enabled || !audio.current) return;
    const ctx = audio.current; ctx.resume().catch(() => setError('Audio could not start.')); const now = ctx.currentTime;
    [440, 660].forEach((frequency, index) => { const oscillator = ctx.createOscillator(), gain = ctx.createGain(); oscillator.type = 'triangle'; oscillator.frequency.value = frequency; gain.gain.setValueAtTime(.025, now + index * .1); gain.gain.exponentialRampToValueAtTime(.001, now + index * .1 + .22); oscillator.connect(gain).connect(ctx.destination); oscillator.start(now + index * .1); oscillator.stop(now + index * .1 + .23); });
  }
  function toggleSound() { if (!sound) { try { audio.current ||= new (window.AudioContext || window.webkitAudioContext)(); tone(true); } catch { setError('Audio is unavailable in this browser.'); return; } } setSound(!sound); }
  return <div className={`terminal-app ${paused || reduced ? 'effects-paused' : ''}`}>
    <header className="system-header"><a href="#terminal" className="wordmark"><Terminal size={25}/><span>WHATIF<span className="wordmark-suffix">_</span></span><small>TERMINAL v1.0</small></a><div className="system-tools"><span className="online"><i/> SYSTEM ONLINE</span><button onClick={() => setAbout(true)} aria-label="Open field manual"><BookOpen size={16}/><span>MANUAL</span></button><button onClick={() => setPaused(!paused)} aria-pressed={paused} aria-label={paused ? 'Resume animations' : 'Pause animations'}>{paused ? <Play size={15}/> : <Pause size={15}/>}<span>FX {paused || reduced ? 'OFF' : 'ON'}</span></button><button onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute sound' : 'Enable sound'}>{sound ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button><WalletControl wallet={wallet} paused={paused || reduced}/></div></header>
    <main id="terminal"><div className="workstation-intro"><div><div className="eyebrow">EST. 1995 / CONNECTED TO ANOTHER TIMELINE</div><h1>The terminal that<br/>rewrites your <span>what if.</span></h1><p>Your past is read-only. Your what-ifs aren’t.</p></div><div className="intro-stamp"><span>[ WT–001 ]</span><span>PUBLIC RECORDS.<br/>PRIVATE CURIOSITY.</span><span>NO WALLET REQUIRED ↙</span></div></div><MemoryTerminal tone={tone} paused={paused || reduced} walletLogs={wallet.walletLogs}/>{error && <p role="alert" className="form-error">{error}</p>}</main>
    <footer><span><i className="status-dot"/> READ-ONLY CONNECTION · NO DATA STORED</span><span>MADE FOR SECOND THOUGHTS <span className="amber">✦</span></span><span>© WHATIF / 1995–2026</span></footer>
    {about && <dialog ref={dialog} className="manual-modal" aria-labelledby="manual-title" onClose={() => setAbout(false)}><button className="close-modal" aria-label="Close manual" onClick={() => dialog.current.close()}><X size={20}/></button><div className="eyebrow">WHATIF / FIELD MANUAL</div><h2 id="manual-title">A little time travel.</h2><ol><li>Paste an EVM hash, Solana signature, or Padre Solana link. EVM hashes need a selected network.</li><li>Analyze public records, or explore the MEMORY timeline. Check each record’s source and the timeline’s price assumptions.</li><li>Choose one of seven paths. Use arrow keys in the command menu, then run the timeline.</li><li>Compare outcomes, replay, or export a PNG report. All scenario assumptions travel with the report.</li></ol><p>Live market snapshots are not price history. A verified transaction is not a reconstructed trade. Historical prices, executable exits, and liquidity are marked unavailable when unsupported.</p><p>No account, backend, or persistent browser storage. Optional Phantom and Solflare desktop extension connections read only your authorized public address and reset on refresh; wallet permissions are managed by your extension. Public lookups send the entered identifier to a public RPC provider or DEX Screener. Closing this page clears your session.</p><button onClick={() => dialog.current.close()}>[ RETURN TO TERMINAL ]</button></dialog>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
