import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, ArrowRight, Terminal, CircleHelp, LoaderCircle } from 'lucide-react';
import { detectTransaction, errorTitles, loadDemoTrade, loadTransaction, networks } from './transaction';
import PathModal, { DecisionMenu } from './PathModal';
import World from './World';
import Coin from './Coin';

function Record({ result }) {
  const demo = result.demo, market = result.kind === 'market';
  const rows = [
    [demo ? 'TIMELINE' : 'BLOCKCHAIN', result.network], ['STATUS', demo ? 'Ready to explore' : market ? 'Current market snapshot' : result.status],
    ['TOKEN', result.symbol || result.token || 'Unavailable · not reconstructed'],
    ['TRADE TIMESTAMP', demo ? result.history[0].date : result.timestamp || 'Unavailable'],
    ['TOKEN QUANTITY', demo ? `${result.quantity.toLocaleString()} MEMORY` : 'Unavailable · not reconstructed'],
    ['ENTRY AMOUNT', demo ? '$1,000.00' : 'Unavailable'], ['EXIT AMOUNT', demo ? '$2,400.00' : 'Unavailable'],
    [demo ? 'BASELINE PROFIT / LOSS' : 'ACTUAL PROFIT / LOSS', demo ? '+$1,400.00' : 'Unavailable · no verified trade'],
    ...(market ? [['SPOT PRICE', result.price], ['MARKET CAP', result.marketCap], ['CURRENT LIQUIDITY', result.liquidity], ['24H VOLUME', result.volume]] : []),
    ...(!market && !demo ? [['BLOCK / SLOT', result.block ?? 'Pending'], ['SENDER / FEE PAYER', result.from], ...(result.value ? [['NATIVE TRANSFER', result.value]] : [])] : []),
  ];
  return <div className="record-output"><div className="section-caption"><span>RECORD / {demo ? 'MEMORY-001' : market ? 'MARKET SNAPSHOT' : 'RPC VERIFIED'}</span><span className="data-tag">{demo ? 'SCENARIO INPUTS' : market ? 'LIVE SNAPSHOT' : 'VERIFIED RECORD'}</span></div><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd className={value?.startsWith?.('Unavailable') ? 'unavailable' : ''}>{value}</dd></div>)}</dl><details><summary>Inspect {market ? 'market identifiers' : 'record identifier'}</summary><code>{result.hash}</code>{market && <><span>TOKEN ADDRESS</span><code>{result.address}</code></>}</details>{(result.explorer || result.url) && <a className="text-link" href={result.explorer || result.url} target="_blank" rel="noopener noreferrer">{market ? 'OPEN ON PADRE' : 'VIEW IN BLOCK EXPLORER'} <ArrowUpRight size={14}/></a>}<p className="data-note">{demo ? 'Source: preset price and trade assumptions for MEMORY.' : market ? 'Snapshot from DEX Screener. Price history and historical liquidity are unavailable.' : 'Record verified against the public RPC response. Trade reconstruction, historical prices, and executable exits are unavailable.'}</p>{demo && <details><summary>Inspect timeline prices</summary><dl>{result.history.map(point => <div key={point.date}><dt>{point.date}</dt><dd>{point.label} · ${point.price.toFixed(2)} / token</dd></div>)}</dl></details>}</div>;
}

export default function MemoryTerminal({ tone, paused, walletLogs = [] }) {
  const [input, setInput] = useState(''), [network, setNetwork] = useState('ethereum');
  const [error, setError] = useState(null), [result, setResult] = useState(null), [loading, setLoading] = useState(false);
  const [choice, setChoice] = useState(0), [preview, setPreview] = useState(false);
  const [logs, setLogs] = useState(['WHATIF OS v1.0 · MEMORY INTERFACE INITIALIZED.', 'PUBLIC RPC ADAPTERS READY.', 'AWAITING A TRANSACTION OR MARKET LINK.']);
  const request = useRef(null), output = useRef(null), field = useRef(null), reduced = useReducedMotion();
  const walletLines = useRef(0);
  useEffect(() => {
    const added = walletLogs.slice(walletLines.current);
    walletLines.current = walletLogs.length;
    if (added.length) setLogs(lines => [...lines, ...added]);
  }, [walletLogs]);
  const detected = detectTransaction(input);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { output.current.scrollTop = output.current.scrollHeight; }, [logs]);
  function resetRequest() { request.current?.abort(); request.current = null; setLoading(false); setError(null); setResult(null); }
  function newTrade() { resetRequest(); setPreview(false); setInput(''); setLogs(['SESSION CLEARED. NO DATA STORED.', 'AWAITING YOUR NEXT MEMORY.']); field.current.focus(); }
  async function submit(event) {
    event.preventDefault(); resetRequest(); tone(); setLogs(['VALIDATING INPUT...']);
    const controller = new AbortController(); request.current = controller; setLoading(true);
    try {
      const next = await loadTransaction(input, network, { signal: controller.signal, onProgress: line => { if (!controller.signal.aborted) setLogs(lines => [...lines, line]); } });
      if (!controller.signal.aborted) { setResult(next); setLogs(lines => [...lines, 'ANALYSIS COMPLETE. SELECT AN ALTERNATE TIMELINE.']); }
    } catch (failure) {
      if (!controller.signal.aborted) { setError({ code: failure.code || 'API_FAILURE', message: failure.message }); setLogs(lines => [...lines, `STOPPED · ${errorTitles[failure.code] || 'API failure'}`]); }
    } finally { if (request.current === controller) { request.current = null; setLoading(false); } }
  }
  function demo() { resetRequest(); setResult(loadDemoTrade()); setLogs(['MEMORY / USD TIMELINE LOADED.', 'PRICE ASSUMPTIONS LOADED.', 'NO NETWORK REQUEST MADE.', 'READY. SELECT AN ALTERNATE TIMELINE.']); tone(); }
  return <div className="workstation">
    <section className="terminal-window command-window" aria-labelledby="input-title"><div className="window-bar"><span><Terminal size={14}/> TRANSACTION CONSOLE</span><span>01 / INPUT</span></div><form onSubmit={submit} className="command-form" aria-busy={loading}>
      <div className="system-specs"><span>NETWORK <b>{detected?.format === 'solana' ? 'SOLANA' : 'SOLANA / EVM'}</b></span><span>ACCESS <b>READ-ONLY</b></span></div>
      <h2 id="input-title"><span className="prompt-mark">&gt;</span> Investigate a memory<span className="cursor">_</span></h2>
      <p className="muted">A transaction. A token. The one you still think about.</p>
      <label htmlFor="transaction" className="input-label">PASTE A TRANSACTION HASH OR PADRE SOLANA LINK</label><div className="input-wrap"><span aria-hidden="true">↳</span><input ref={field} id="transaction" value={input} maxLength={256} onChange={event => { resetRequest(); setInput(event.target.value); }} placeholder="0x... / Solana signature / https://trade.padre.gg/..." autoComplete="off" spellCheck="false" aria-describedby="network-help" aria-invalid={error?.code === 'INVALID_FORMAT'}/></div>
      <div className="input-meta"><span><i className="status-dot"/> {detected ? detected.kind === 'market' ? 'SOLANA MARKET LINK DETECTED' : `${detected.format.toUpperCase()} FORMAT DETECTED` : 'AUTO-DETECT ENABLED'}</span><span>NO WALLET REQUIRED</span></div>
      {detected?.format !== 'solana' && <label className="network-select">EVM NETWORK<select value={network} onChange={event => { resetRequest(); setNetwork(event.target.value); }}>{Object.entries(networks).filter(([, n]) => n.format === 'evm').map(([key, n]) => <option key={key} value={key}>{n.name}</option>)}<option value="other">Other network (unsupported)</option></select></label>}
      <p id="network-help" className="data-note">{detected?.kind === 'market' ? 'The market address is sent to DEX Screener for a current snapshot.' : detected?.format === 'solana' ? 'Your signature is sent to a public Solana mainnet RPC.' : 'EVM hashes do not encode a chain. Select its network before the public RPC lookup.'}</p>
      <div className="command-actions"><button className="primary-button" type="submit" disabled={loading}>{loading ? <LoaderCircle className="loading-icon" size={15}/> : <Terminal size={15}/>} {loading ? 'ANALYZING...' : 'ANALYZE'} <ArrowRight size={15}/></button><button type="button" onClick={demo}>[ EXPLORE A TRADE ]</button>{loading && <button type="button" onClick={() => { resetRequest(); setLogs(lines => [...lines, 'REQUEST CANCELLED.']); }}>CANCEL</button>}</div>
      {error && <p className="form-error" role="alert"><strong>{errorTitles[error.code] || 'API failure'}</strong><br/>{error.message}</p>}
    </form></section>
    <aside className="terminal-window lab-window"><div className="window-bar"><span><span className="pixel-square"/> THE WAITING ROOM</span><span>LIVE FEED</span></div><World mood={loading ? 'examining' : error ? 'regret' : result ? 'celebrating' : 'idle'} paused={paused}/><div className="lab-caption"><span className="data-tag">PLAYER 01</span><h3>{loading ? 'Searching the archives...' : error ? 'A memory out of reach.' : result ? 'A new path is waiting.' : 'Your past self is waiting.'}</h3><p>{loading ? 'Checking the public record. No transactions are sent.' : result ? 'Choose a decision. See where it could lead.' : 'Somewhere, you made a different choice.'}</p></div><div className="room-status"><span>LOCATION <b>THE CROSSROADS</b></span><span>STATE <b>{loading ? 'EXAMINING' : error ? 'RETRY READY' : result ? 'RECORD FOUND' : 'IDLE'}</b></span></div></aside>
    <section className="terminal-window output-window" aria-label="Analysis output"><div className="window-bar"><span>RECENT TERMINAL OUTPUT</span><span>{String(logs.length).padStart(2, '0')} LINES</span></div><div ref={output} className="console-output" role="log" aria-label="Terminal output" aria-live="polite">{logs.map((line, index) => <motion.p key={`${index}-${line}`} initial={reduced || paused ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .15, delay: index < 3 && !result && !loading ? index * .12 : 0 }}><span>&gt;</span>{line}</motion.p>)}<span className="cursor" aria-hidden="true">█</span></div>{result && <Record result={result}/>}</section>
    <section className="terminal-window decision-window" aria-labelledby="decision-title"><div className="window-bar"><span>ALTERNATE TIMELINE SELECTOR</span><span>02 / DECISION</span></div><div className="decision-body"><h2 id="decision-title"><span className="prompt-mark">&gt;</span> What would you change?</h2><p className="data-note">Choose a path. All seven outcomes use the price assumptions shown in the timeline.</p><DecisionMenu choice={choice} onChange={index => { setChoice(index); tone(); }}/><div className="decision-footer"><span>↑ ↓ SELECT · SPACE CONFIRM</span><button className="primary-button" onClick={() => { setPreview(true); tone(); }}>OPEN TIMELINE <ArrowRight size={15}/></button></div></div></section>
    <aside className="terminal-window coin-window"><div className="window-bar"><span>ARTIFACT / 001</span><span>COLLECTIBLE</span></div><div className="coin-content"><Coin paused={paused}/><div><span className="eyebrow">THE WHATIF COIN</span><h3>Two sides.<br/>Infinite possibilities.</h3><p>Hover to turn. Click to flip.</p></div></div><div className="archive-note"><CircleHelp size={14}/><p>Reality is read-only.<br/>This is where curiosity gets a cursor.</p></div></aside>
    {preview && <PathModal result={result} choice={choice} setChoice={setChoice} onClose={() => setPreview(false)} onNewTrade={newTrade} tone={tone} paused={paused}/>}
  </div>;
}
