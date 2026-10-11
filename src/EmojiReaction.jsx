import { useLayoutEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import gsap from 'gsap';
import EmojiIcon from './EmojiIcon';

export default function EmojiReaction({ reaction, paused = false }) {
  const reduced = useReducedMotion(), glyph = useRef(null), still = paused || reduced;
  useLayoutEffect(() => {
    if (!reaction || still || !glyph.current) return;
    const tween = gsap.to(glyph.current, { rotate: reaction.tone === 'bad' ? -8 : 8, duration: .14, repeat: 1, yoyo: true, ease: 'steps(2)' });
    return () => tween.kill();
  }, [reaction?.id, reaction?.tone, still]);
  return <AnimatePresence mode="wait">{reaction && <motion.div key={reaction.id} className="emoji-reaction" initial={still ? false : { opacity: 0, scale: .65, y: 5 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={still ? undefined : { opacity: 0, scale: .8, y: -6 }} transition={{ duration: .16, ease: 'steps(3)' }}>
    <span ref={glyph}><EmojiIcon emoji={reaction.emoji} title={reaction.label}/></span><span className="sr-only">{reaction.label}</span>
  </motion.div>}</AnimatePresence>;
}
