import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Link } from 'lucide-react';
import { decisions, detectTransaction, errorTitles, loadDemoTrade, loadTransaction, networks } from './transaction';

export default function MemoryTerminal({ tone }) {
  const [input, setInput] = useState(''), [network, setNetwork] = useState('ethereum');
  const [error, setError] = useState(null), [result, setResult] = useState(null);
  const [stage, setStage] = useState('start'), [loading, setLoading] = useState(false), [choice, setChoice] = useState(1);
  const request = useRef(null), reduced = useReducedMotion();
  const detected = detectTransaction(input);
  useEffect(() => () => request.current?.abort(), []);
  function resetRequest() { request.current?.abort(); request.current = null; setLoading(false); setError(null); setResult(null); }
  async function submit(event) {
    event.preventDefault(); resetRequest(); tone();
    const controller = new AbortController(); request.current = controller; setLoading(true);
    try {
      const next = await loadTransaction(input, network, { signal: controller.signal });
      if (!controller.signal.aborted) { setResult(next); setStage('result'); }
    } catch (failure) {
      if (!controller.signal.aborted) setError({ code: failure.code || 'API_FAILURE', message: failure.message });
    } finally { if (request.current === controller) { request.current = null; setLoading(false); } }
  }
  function demo() { resetRequest(); setResult(loadDemoTrade()); setStage('result'); tone(); }
  return <div className="computer">
    <div className="computer-top"><span>WHATIF PERSONAL TIME MACHINE</span><span>WT–01 <span className="power-light"/></span></div>
    <div className="computer-screen" aria-busy={loading}>
      <div className="screen-top"><span><span className="status-dot"/> {result?.demo ? 'DEMO MODE' : result ? 'TRANSACTION FOUND' : loading ? 'LOADING MEMORY...' : 'AWAITING A MEMORY'}</span><span>v.1998</span></div>
      <AnimatePresence mode="wait"><motion.div key={stage} initial={{ opacity: 0, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: .2 }}>
        {stage === 'start' && <form onSubmit={submit}>
          <div className="screen-prompt"><span>›</span> Let’s find that moment<span className="cursor">_</span></div>
          <p className="screen-description">Paste a transaction hash to begin your journey.</p>
          <label className="sr-only" htmlFor="transaction">Transaction hash</label>
          <div className="input-wrap"><Link size={15}/><input id="transaction" value={input} maxLength={256} onChange={event => { resetRequest(); setInput(event.target.value); }} placeholder="Enter transaction hash..." autoComplete="off" spellCheck="false" aria-describedby={error ? 'transaction-error' : 'network-help'} aria-invalid={error?.code === 'INVALID_FORMAT'}/></div>
          <div className="network-line"><span className="network-gem">◆</span>{detected ? (detected.format === 'solana' ? 'Solana signature detected' : 'EVM hash detected') : 'EVM / Solana · auto-detect'}<span>READ-ONLY</span></div>
          {detected?.format !== 'solana' && <label className="network-select">EVM network<select value={network} onChange={event => { resetRequest(); setNetwork(event.target.value); }}>{Object.entries(networks).filter(([, n]) => n.format === 'evm').map(([key, n]) => <option key={key} value={key}>{n.name}</option>)}<option value="other">Other network (unsupported)</option></select></label>}
          <p className="screen-description" id="network-help">{detected?.format === 'solana' ? 'Looking up Solana mainnet. Your signature is sent to a public RPC service.' : 'An EVM hash does not encode its network. Choose where your transaction happened. Lookup sends the hash to that network’s public RPC.'}</p>
          <button className="terminal-button" type="submit" disabled={loading}>{loading ? 'LOADING MEMORY...' : 'LOAD A MEMORY'}<ArrowRight size={16}/></button>
          <button className="small-button demo-button" type="button" onClick={demo}>Try Demo Trade</button>
          <div className="paths-line">A different decision? <button type="button" onClick={() => { resetRequest(); setStage('decision'); tone(); }}>Explore the paths <ArrowRight size={12}/></button></div>
        </form>}
        {stage === 'decision' && <div className="decisions"><div className="screen-prompt">IF YOU COULD GO BACK...</div><p className="screen-description">Choose the path you’d like to explore.</p><fieldset><legend className="sr-only">Choose your decision</legend>{decisions.map((decision, i) => <label key={decision} className={choice === i ? 'selected' : ''}><input type="radio" name="decision" checked={choice === i} onChange={() => { setChoice(i); tone(); }}/><span className="selection-arrow">{choice === i ? '▶' : '·'}</span>{decision.toUpperCase()}</label>)}</fieldset><button className="terminal-button" onClick={() => { setStage('start'); tone(); }}>FIND MY TRANSACTION <ArrowRight size={15}/></button><p className="screen-description">Your path: {decisions[choice].toLowerCase()}.</p></div>}
        {stage === 'result' && result && <section className="transaction-result" aria-label={result.demo ? 'DEMO MODE transaction results' : 'Verified transaction'}>
          <h3 className="screen-prompt">{result.demo ? 'DEMO MODE' : 'SAVE FILE FOUND'}</h3>
          <p className="screen-description">{result.demo ? 'Synthetic historical trade. Every price, date and outcome below is fictional. No RPC request was made.' : 'Transaction identity and network verified against the RPC response. This is transaction data, not a reconstructed trade or price estimate.'}</p>
          <dl><dt>Network</dt><dd>{result.network}</dd><dt>Status</dt><dd>{result.status}</dd><dt>{result.demo ? 'Memory' : 'Transaction'}</dt><dd className="transaction-hash">{result.hash}</dd>{!result.demo && <><dt>Block / slot</dt><dd>{result.block ?? 'Pending'}</dd><dt>Sender / fee payer</dt><dd className="transaction-hash">{result.from}</dd>{result.value && <><dt>Native value</dt><dd>{result.value}</dd></>}</>}</dl>
          {result.demo && <div className="demo-history"><h4>DEMO MODE · MEMORY history</h4><ol>{result.history.map(point => <li key={point.date}><span>{point.date} · {point.label}</span><strong>${point.price.toFixed(2)} / token</strong></li>)}</ol><p>DEMO MODE · Invested: ${result.invested.toLocaleString('en-US')} · Sale proceeds: ${result.proceeds.toLocaleString('en-US')} · Profit before fees: ${(result.proceeds - result.invested).toLocaleString('en-US')}.</p><p>Fees, taxes, slippage and liquidity are not modeled.</p></div>}
          <button className="terminal-button" onClick={() => { resetRequest(); setStage('start'); tone(); }}>LOAD ANOTHER MEMORY <ArrowRight size={15}/></button>
        </section>}
      </motion.div></AnimatePresence>
      {loading && <p className="screen-description" role="status">Verifying the transaction on {detected?.format === 'solana' ? 'Solana mainnet' : networks[network]?.name}…</p>}
      {error && <p className="form-error" id="transaction-error" role="alert"><strong>{errorTitles[error.code] || 'API failure'}</strong><br/>{error.message}</p>}
    </div>
    <div className="computer-bottom"><span><i/><i/><i/><i/><i/><i/></span><div>MADE FOR SECOND THOUGHTS <span className="computer-switch"/></div></div>
  </div>;
}
