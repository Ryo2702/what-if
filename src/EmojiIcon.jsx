export default function EmojiIcon({ emoji, className = '', title }) {
  if (!emoji) return null;
  return <span className={`emoji-icon ${className}`.trim()} aria-hidden="true" title={title}>{emoji}</span>;
}
