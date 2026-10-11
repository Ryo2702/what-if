import EmojiIcon from './EmojiIcon';

export default function OutcomeEmoji({ outcome, signals = [] }) {
  if (!outcome) return null;
  const visibleSignals = signals.filter(signal => signal !== outcome).slice(0, 2);
  return <div className={`outcome-emoji outcome-${outcome.key || 'unknown'}`}>
    <EmojiIcon emoji={outcome.emoji} className="outcome-emoji-icon" title={outcome.label}/>
    <div><span>{outcome.label}</span>{outcome.detail && <p>{outcome.detail}</p>}{visibleSignals.length > 0 && <div className="outcome-signals">{visibleSignals.map(signal => <span key={signal.key}><EmojiIcon emoji={signal.emoji}/>{signal.label}</span>)}</div>}</div>
  </div>;
}
