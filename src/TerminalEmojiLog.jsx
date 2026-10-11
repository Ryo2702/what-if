import { forwardRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import EmojiIcon from './EmojiIcon';

const TerminalEmojiLog = forwardRef(function TerminalEmojiLog({ lines, paused = false, className = 'console-output', ariaLabel = 'Terminal output', intro = false, cursor = true }, ref) {
  const reduced = useReducedMotion();
  return <div ref={ref} className={className} role="log" aria-label={ariaLabel} aria-live="polite">
    {lines.map((line, index) => {
      const entry = typeof line === 'string' ? { message: line } : line;
      return <motion.p key={`${index}-${entry.message}`} initial={reduced || paused ? false : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: .15, delay: intro ? index * .12 : 0 }}>
        <span>&gt;</span><EmojiIcon emoji={entry.emoji}/><span className="terminal-log-message">{entry.message}</span>
      </motion.p>;
    })}
    {cursor && <span className="cursor" aria-hidden="true">█</span>}
  </div>;
});

export default TerminalEmojiLog;
