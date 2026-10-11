import { useEffect, useId, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import { X, Play, Pause, SkipForward, RotateCcw, Download, ArrowRight } from 'lucide-react';
import { decisions } from './transaction';
import { simulatePath, moments, money, reportLines, exportReport } from './scenario';
import World from './World';
import Coin from './Coin';
import EmojiIcon from './EmojiIcon';
import OutcomeEmoji from './OutcomeEmoji';
import { classifyFinancialOutcome, decisionEmoji, emoji } from './emoji';

const explanations = [
  'Keep every token. Your ending value stays unrealized.',
  'Sell everything at the scenario peak. Assumes perfect hindsight and unlimited execution.',
  'Sell half at the original exit (2.4×); keep the other half.',
  'Add twice your initial amount at 2.4×. Total capital contributed becomes 3×.',
  'Sell one day after the scenario peak, at half the peak price.',
  'At 2×, sell half to recover your starting amount. Keep the remaining tokens.',
  'Sell everything at the ending price you choose below.',
];

const decisionStep = [null, 3, 2, 2, 4, 1, 5];
const decisionEmojiMotion = { idle: { scale: 1, rotate: 0 }, selected: { scale: [1, 1.08, 1], rotate: 0 }, hover: { scale: 1.14, rotate: -5 } };
function timelineEmoji(index, choice, outcome) {
  if (index === 0) return emoji.terminal.loading.emoji;
  if (decisionStep[choice] === index) return decisionEmoji(choice)?.emoji;
  const previous = outcome?.prices?.[index - 1], current = outcome?.prices?.[index];
  if (current > previous) return '📈';
  if (current < previous) return '📉';
  return null;
}
function outcomeDetail(outcome, reliable) {
  if (!reliable) return 'Trade reconstruction and price history are unavailable, so this scenario cannot be a verified financial outcome.';
  if (outcome === emoji.outcomes.FUMBLE) return 'The calculated alternate profit exceeds the original assumed exit.';
  if (outcome === emoji.outcomes.GREAT_ESCAPE) return 'The original assumed exit performs better than this selected path.';
  if (outcome === emoji.outcomes.DIAMOND_HANDS) return 'The selected holding strategy remains profitable at the scenario ending.';
  if (outcome === emoji.outcomes.TO_THE_MOON) return 'The calculated value reaches the five-times-contributed major-gain milestone.';
  if (outcome === emoji.outcomes.MARKET_CRASH) return 'The scenario ending price is at least 50% below the scenario peak.';
  return 'There is not enough reliable information for a financial outcome.';
}

export function DecisionMenu({ choice, onChange }) {
  const name = useId(), reduced = useReducedMotion();
  return <fieldset className="command-menu"><legend className="sr-only">Select an alternate timeline</legend>{decisions.map((decision, index) => <motion.label key={decision} className={choice === index ? 'selected' : ''} initial={false} animate={choice === index && !reduced ? 'selected' : 'idle'} whileHover={reduced ? undefined : 'hover'}><input type="radio" name={name} checked={choice === index} onChange={() => onChange(index)}/><span className="selection-cursor" aria-hidden="true">{choice === index ? '▸' : ' '}</span><span className="option-index">[{String(index + 1).padStart(2, '0')}]</span><motion.span className="decision-emoji" aria-hidden="true" variants={decisionEmojiMotion} transition={{ duration: .16 }}>{decisionEmoji(index)?.emoji}</motion.span><span>{decision}</span>{choice === index && <span className="selected-mark" aria-hidden="true">↵</span>}</motion.label>)}</fieldset>;
}

function Counter({ value, paused }) {
  const output = useRef(null), previous = useRef(value);
  useEffect(() => {
    const state = { value: previous.current };
    const tween = gsap.to(state, { value, duration: paused ? 0 : .35, onUpdate: () => { output.current.textContent = money(state.value); } });
    previous.current = value;
    return () => tween.kill();
  }, [value, paused]);
  return <strong ref={output}>{money(value)}</strong>;
}

export default function PathModal({ result, choice, setChoice, onClose, onNewTrade, tone, paused }) {
  const dialog = useRef(null), playback = useRef(null), simulation = useRef(null), report = useRef(null), log = useRef(null), reactionTimer = useRef(null);
  const reduced = useReducedMotion(), noMotion = paused || reduced;
  const [amount, setAmount] = useState('1000'), [ending, setEnding] = useState(.7), [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState('ready'), [runPaused, setRunPaused] = useState(false), [exportError, setExportError] = useState(''), [exporting, setExporting] = useState(false), [exported, setExported] = useState(false), [reaction, setReaction] = useState(null);
  const peak = result?.demo ? 8.6 : 3, investment = Number(amount), valid = Number.isFinite(investment) && investment > 0 && investment <= 1e9;
  const step = Math.min(5, Math.floor(progress * 5 + .00001));
  const outcome = valid ? simulatePath(choice, investment, ending, step, peak) : null;
  const final = valid ? simulatePath(choice, investment, ending, 5, peak) : null;
  const classification = classifyFinancialOutcome(final, { choice, reliable: result?.demo === true });
  const displayOutcome = { ...classification.outcome, detail: outcomeDetail(classification.outcome, result?.demo === true) };
  const token = result?.symbol || result?.token || 'TOKEN';
  const source = 'WHAT-IF TIMELINE';
  useEffect(() => { dialog.current.showModal(); return () => { playback.current?.kill(); clearTimeout(reactionTimer.current); }; }, []);
  useEffect(() => { if (noMotion && phase === 'playing') playback.current?.progress(1); }, [noMotion, phase]);
  useEffect(() => { if (phase === 'report') report.current?.focus(); }, [phase]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [step, phase]);
  function showReaction(next, tone = 'good') {
    clearTimeout(reactionTimer.current);
    setReaction({ ...next, id: `${Date.now()}-${Math.random()}`, tone });
    reactionTimer.current = setTimeout(() => setReaction(null), 1400);
  }
  function showOutcomeReaction() {
    if (!final || classification.outcome === emoji.outcomes.UNKNOWN) { showReaction(classification.outcome, 'good'); return; }
    showReaction(final.profit < 0 || classification.outcome === emoji.outcomes.FUMBLE ? emoji.reactions.loss : emoji.reactions.positive, final.profit < 0 || classification.outcome === emoji.outcomes.FUMBLE ? 'bad' : 'good');
  }
  function reset() { playback.current?.kill(); clearTimeout(reactionTimer.current); setReaction(null); setPhase('ready'); setProgress(0); setRunPaused(false); setExported(false); setExportError(''); }
  function choose(index) { if (phase === 'playing') reset(); setChoice(index); setExported(false); tone(); }
  function run() {
    if (!valid) return;
    playback.current?.kill(); setProgress(0); setRunPaused(false); setPhase('playing'); setExported(false); showReaction(emoji.reactions.waiting); tone();
    simulation.current.focus();
    if (noMotion) { setProgress(1); setPhase('report'); showOutcomeReaction(); return; }
    const clock = { progress: 0 };
    playback.current = gsap.timeline({ onComplete: () => { setPhase('report'); setRunPaused(false); showOutcomeReaction(); } }).to(clock, { progress: 1, duration: 9, ease: 'none', onUpdate: () => setProgress(Math.floor(clock.progress * 100) / 100) });
  }
  function scrub(index) { playback.current?.kill(); setRunPaused(false); setProgress(index / 5); setPhase(index === 5 ? 'report' : 'ready'); if (index === 5) showOutcomeReaction(); tone(); }
  async function download() {
    setExporting(true); setExportError('');
    try { const lines = reportLines({ choice, investment, ending, peak, token, demo: result?.demo, decision: decisions[choice], outcome: classification.outcome }); await exportReport(lines, classification.outcome); setExported(true); }
    catch (error) { setExportError(error.message); }
    finally { setExporting(false); }
  }
  const chartY = price => 168 - price / peak * 130;
  const prices = outcome?.prices || [1, 2, 2.4, peak, peak / 2, ending];
  const chart = prices.map((price, index) => `${index === 0 ? 'M' : 'H'}${42 + index * 100}${index === 0 ? ',' : 'V'}${chartY(price)}`).join(' ');
  return <dialog ref={dialog} className="path-modal" aria-labelledby="path-title" onClose={onClose}>
    <div className="window-bar modal-bar"><span>WHATIF / TIMELINE ENGINE</span><span>{source}<button aria-label="Close timeline" onClick={() => dialog.current.close()}><X size={19}/></button></span></div>
    <div className="timeline-heading"><div><div className="eyebrow">PARALLEL SESSION / {token}</div><h2 id="path-title">Same memory. Another ending.</h2><p>You are the explorer. Choose a decision, then follow the consequences.</p></div><Coin paused={noMotion} flipTrigger={phase === 'playing'}/></div>
    <div className="simulation-layout"><section className="scenario-controls"><div className="section-caption">SELECT AN ALTERNATE TIMELINE</div><DecisionMenu choice={choice} onChange={choose}/><p className="choice-explanation">{explanations[choice]}</p>
      <label className="scenario-input">Starting amount / USD<input type="number" min="0.01" max="1000000000" step="any" value={amount} onChange={event => { reset(); setAmount(event.target.value); }} aria-invalid={!valid} aria-describedby={!valid ? 'amount-error' : undefined}/></label>
      <label className="scenario-input">Ending price / <b>{ending.toFixed(1)}× entry</b><input type="range" min="0" max={peak} step="0.1" value={ending} onChange={event => { reset(); setEnding(Number(event.target.value)); }}/><span>0× = zero value · {peak}× = scenario peak</span></label>
      {!valid && <p id="amount-error" className="form-error" role="alert">Enter an amount above $0 and at most $1 billion.</p>}
      <div className="scenario-assumptions"><span className="data-tag">PRICE ASSUMPTIONS</span><p>Entry 1× → original exit 2.4× → peak {peak}× → next day {peak / 2}× → chosen ending.</p><p>Calculated from these price assumptions and your starting amount. Source: scenario inputs.</p><p>Historical liquidity and executable exit estimates: <strong>unavailable.</strong></p></div>
      <button className="primary-button run-button" disabled={!valid || phase === 'playing'} onClick={run}><Play size={15}/> {phase === 'report' ? 'REPLAY TIMELINE' : 'REWRITE TIMELINE'} <ArrowRight size={15}/></button>
    </section>
    <section className="simulation-stage" ref={simulation} tabIndex={-1} aria-label="Interactive timeline">
      <div className="section-caption"><span>{phase === 'playing' ? runPaused ? 'TIMELINE PAUSED' : 'REWRITING TIMELINE...' : phase === 'report' ? 'ALTERNATE ENDING REACHED' : 'TIMELINE READY'}</span><span>{Math.round(progress * 100)}%</span></div>
      <div className="chart-header"><span>PRICE PATH / ENTRY MULTIPLE</span><span className="chart-key">━ SCENARIO <b>┄ ORIGINAL EXIT</b></span></div>
      <svg className="price-chart" viewBox="0 0 600 210" role="img" aria-label={`Price assumptions: entry 1 times, exit 2.4 times, peak ${peak} times, next day ${peak / 2} times, ending ${ending} times entry.`}>
        {[0, peak / 2, peak].map(price => <g key={price}><path d={`M42 ${chartY(price)}H560`} stroke="#273d2e" strokeDasharray="3 5"/><text x="10" y={chartY(price) + 4} fill="#789b7e" fontSize="10">{price.toFixed(1)}×</text></g>)}
        {[0, 1, 2, 3, 4, 5].map(index => <g key={index}><path d={`M${42 + index * 100} 26V175`} stroke="#1d3023"/><text x={42 + index * 100} y="196" textAnchor="middle" fill="#7b9a80" fontSize="10">0{index + 1}</text></g>)}
        <path d={`M42 ${chartY(1)}H142V${chartY(2)}H242V${chartY(2.4)}H542`} fill="none" stroke="#e8bd75" strokeDasharray="4 5" opacity=".6"/>
        <path d={chart} fill="none" stroke="#a4e68a" opacity=".12" strokeWidth="2"/>
        <path d={chart} fill="none" stroke="#a4e68a" strokeWidth="2" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress}/>
        <path d={`M${42 + progress * 500} 25V177`} stroke="#a4e68a" opacity=".3"/>
        <rect x={38 + step * 100} y={chartY(prices[step]) - 4} width="8" height="8" fill="#e8bd75"/>
      </svg>
      <div className="simulation-values" aria-live="polite"><div><span>ALTERNATE VALUE</span>{outcome ? <Counter value={outcome.total} paused={noMotion}/> : <strong>—</strong>}</div><div><span>GAIN / LOSS</span><strong className={outcome?.profit < 0 ? 'loss' : 'positive'}>{outcome ? money(outcome.profit) : '—'}</strong></div></div>
      <World journey progress={progress} mood={phase === 'playing' && !runPaused ? 'walking' : step === 5 ? outcome?.profit >= 0 ? 'celebrating' : 'regret' : step === 0 ? 'idle' : 'examining'} paused={noMotion || runPaused} reaction={reaction}/>
      <div className="timeline-progress"><span style={{ width: `${progress * 100}%` }}/></div>
      <div className="timeline-stops" role="group" aria-label="Timeline milestones">{moments.map((moment, index) => <button key={moment} aria-pressed={step === index} onClick={() => scrub(index)}><span>0{index + 1}</span>{moment}</button>)}</div>
      <div className="playback-controls">{phase === 'playing' ? <><button onClick={() => { playback.current.paused(!runPaused); setRunPaused(!runPaused); }}>{runPaused ? <Play size={14}/> : <Pause size={14}/>} {runPaused ? 'RESUME' : 'PAUSE'}</button><button onClick={() => playback.current.progress(1)}><SkipForward size={14}/> SKIP TO REPORT</button></> : <><button disabled={!valid} onClick={run}><Play size={14}/> {phase === 'report' ? 'REPLAY' : 'PLAY'}</button><button disabled={!valid} onClick={() => { scrub(5); report.current?.focus(); }}><SkipForward size={14}/> SHOW REPORT</button></>}</div>
      <div className="simulation-log" role="log" aria-label="Timeline events" ref={log}>{phase === 'playing' && <p><span>[..]</span> <EmojiIcon emoji={emoji.terminal.loading.emoji}/> RECONSTRUCTING SCENARIO TIMELINE...</p>}{outcome?.actions.map((action, index) => <p key={index}><span>[0{index + 1}]</span> <EmojiIcon emoji={timelineEmoji(index, choice, outcome)}/> {action}</p>)}{phase === 'report' && <p className="positive">&gt; <EmojiIcon emoji={emoji.terminal.complete.emoji}/> SIMULATION COMPLETE. YOUR REPORT IS READY.</p>}</div>
    </section></div>
    {phase === 'report' && final && <motion.section ref={report} tabIndex={-1} className="timeline-report" aria-labelledby="report-title" initial={noMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="section-caption"><span>WHATIF // TIMELINE REPORT</span><span>{source}</span></div><h3 id="report-title"><EmojiIcon emoji={decisionEmoji(choice)?.emoji}/> {decisions[choice]}</h3><OutcomeEmoji outcome={displayOutcome} signals={classification.signals}/>
      <div className="report-columns"><div><h4>BASELINE TIMELINE</h4><dl><div><dt>Investment</dt><dd>{money(investment)}</dd></div><div><dt>Sold at assumed 2.4×</dt><dd>{money(investment * 2.4)}</dd></div><div><dt>Profit before costs</dt><dd>{money(investment * 1.4)}</dd></div></dl></div><div><h4>ALTERNATE TIMELINE</h4><dl><div><dt>Total contributed</dt><dd>{money(final.contributed)}</dd></div><div><dt>Cash / modeled sales</dt><dd>{money(final.cash)}</dd></div><div><dt>Tokens / paper value</dt><dd>{money(final.held)}</dd></div><div><dt>Profit before costs</dt><dd>{money(final.profit)}</dd></div></dl></div></div>
      <div className="outcome-banner"><span>{classification.outcome === emoji.outcomes.UNKNOWN ? 'SCENARIO DIFFERENCE VS ASSUMED BASELINE' : final.difference >= 0 ? 'THIS PATH FINISHES AHEAD BY' : 'THIS PATH FINISHES BEHIND BY'}</span><strong className={final.difference < 0 ? 'loss' : 'positive'}>{money(Math.abs(final.difference))}</strong><span>{classification.outcome === emoji.outcomes.UNKNOWN ? 'Illustrative difference only; the verified record has no reconstructed trade history.' : 'Profit difference, accounting for added capital.'}</span></div>
      <p className="data-note">Calculated from the price assumptions above. Peak valuation assumes every token sells at that price. Historical liquidity and executable proceeds are unavailable; fees, taxes, and slippage are excluded.</p>
      <details className="parallel-comparisons"><summary>COMPARE ALL 7 PARALLEL TIMELINES</summary><div className="comparison-table"><table><caption>Same price assumptions and starting amount. Extra capital is included in profit.</caption><thead><tr><th>PATH</th><th>CAPITAL</th><th>ENDING VALUE</th><th>PROFIT / LOSS</th></tr></thead><tbody>{decisions.map((decision, index) => { const other = simulatePath(index, investment, ending, 5, peak); return <tr key={decision} className={choice === index ? 'selected' : ''}><th><button onClick={() => choose(index)}>{String(index + 1).padStart(2, '0')} {decision}</button></th><td>{money(other.contributed)}</td><td>{money(other.total)}</td><td className={other.profit < 0 ? 'loss' : 'positive'}>{money(other.profit)}</td></tr>; })}</tbody></table></div></details>
      <div className="report-actions"><button className="primary-button" onClick={download} disabled={exporting}><Download size={15}/> {exporting ? 'EXPORTING...' : 'EXPORT PNG'}</button><button onClick={run}><RotateCcw size={15}/> REPLAY</button><button onClick={onNewTrade}>NEW TRADE <ArrowRight size={15}/></button></div>{exportError && <p role="alert" className="form-error">{exportError}</p>}{exported && <p role="status" className="positive">PNG report prepared for download.</p>}
    </motion.section>}
    <div className="modal-footer">YOUR PAST IS READ-ONLY. YOUR WHAT-IFS AREN’T.<button onClick={() => dialog.current.close()}>[ RETURN TO CONSOLE ]</button></div>
  </dialog>;
}
