import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useReducedMotion } from 'motion/react';

const sprite = [
  '....aaaaaa......', '...abbbbbba.....', '..abbbbbbbba....', '.aaaaaaaaaaaa...',
  '....cccccc......', '....ccdccd......', '....cccccc......', '.....cccc.......',
  '...eeeffeee.....', '..eeeeffeeee....', '..ceeeffeeec....', '..c.eeffee.c....',
  '....eeeeee......', '....gg..gg......', '....gg..gg......', '...ggg..ggg.....',
];
const colors = { a: '#98734a', b: '#e8bd75', c: '#d8b58a', d: '#17231b', e: '#5c8468', f: '#a4e68a', g: '#b3a68a' };
export function Explorer({ mood = 'idle', className = '', paused = false }) {
  const canvas = useRef(null), reduced = useReducedMotion();
  useEffect(() => {
    const ctx = canvas.current.getContext('2d'); if (!ctx) return;
    const draw = () => {
      const frame = reduced || paused ? 0 : Math.floor(performance.now() / 240) % 2;
      ctx.clearRect(0, 0, 24, 24);
      const hop = mood === 'celebrating' ? frame * 2 : 0;
      sprite.forEach((row, y) => [...row].forEach((pixel, x) => {
        if (!colors[pixel]) return;
        ctx.fillStyle = colors[pixel];
        const stride = mood === 'walking' && y > 12 ? (x < 8 ? frame : -frame) : 0;
        ctx.fillRect(x + 4 + (mood === 'regret' && y < 8 ? 1 : 0), y + 6 - hop + stride, 1, 1);
      }));
      if (mood === 'examining') { ctx.fillStyle = '#dcdcc7'; ctx.fillRect(17, 13, 5, 6); ctx.fillStyle = '#334a3a'; ctx.fillRect(18, 15, 3, 1); }
      if (mood === 'celebrating') { ctx.fillStyle = '#e8bd75'; ctx.fillRect(2, 2 + frame, 2, 2); ctx.fillRect(20, 4 - frame, 2, 2); }
    };
    draw(); const interval = reduced || paused ? null : setInterval(draw, 240);
    return () => clearInterval(interval);
  }, [mood, reduced, paused]);
  return <canvas ref={canvas} width="24" height="24" className={`explorer ${className}`} role="img" aria-label={`Pixel explorer ${mood}`}/>;
}

export default function World({ journey = false, progress = 0, mood = 'idle', paused = false }) {
  const root = useRef(null), actor = useRef(null), reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || paused) return;
    const context = gsap.context(() => {
      gsap.to('.pixel-clouds', { x: 18, duration: 18, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      if (!journey && mood === 'idle') gsap.to(actor.current, { x: 25, duration: 5, repeat: -1, yoyo: true, ease: 'steps(12)' });
      if (!journey && mood === 'examining') gsap.to(actor.current, { x: 58, duration: 1, ease: 'steps(8)' });
    }, root);
    return () => context.revert();
  }, [journey, mood, paused, reduced]);
  const camera = journey ? -progress * 420 : 0;
  return <div ref={root} className={`pixel-world ${journey ? 'journey-world' : ''}`}>
    <svg viewBox={journey ? '0 0 480 190' : '0 0 480 300'} aria-hidden="true" shapeRendering="crispEdges">
      <defs><pattern id={journey ? 'tiles-journey' : 'tiles-lab'} width="32" height="16" patternUnits="userSpaceOnUse"><rect width="32" height="16" fill="#16251b"/><path d="M0 0h32v16M16 0v8M0 8h32" stroke="#2b3f2d" fill="none"/></pattern></defs>
      {journey ? <>
        <path fill="#0c1711" d="M0 0h480v190H0z"/>
        <g className="pixel-clouds" fill="#243b2b"><path d="M40 22h28v-6h30v6h18v8H40zM320 33h28v-8h35v8h20v8h-83z"/></g>
        <g transform={`translate(${camera * .3} 0)`} fill="#1b3022"><path d="M0 90h35V72h25V54h30v25h25v24h45V60h24V35h40v31h35v35h40V78h30V58h35v24h30v19h30V69h40v36h50V75h50v40h75v-38h38v20h70v52H0z"/></g>
        <g transform={`translate(${camera} 0)`}>
          <path fill="url(#tiles-journey)" d="M0 150h960v40H0z"/><path stroke="#5c8468" strokeWidth="3" d="M0 150h960"/>
          {[60, 208, 356, 504, 652, 800].map((x, i) => <g key={x} transform={`translate(${x} 110)`}><path stroke="#5c8468" strokeWidth="3" d="M0 0v40"/><rect x="-15" y="-16" width="30" height="19" fill={progress * 5 >= i ? '#a4e68a' : '#334a3a'}/><text x="0" y="-3" textAnchor="middle" fill="#080d0b" fontSize="10" fontFamily="monospace">0{i + 1}</text></g>)}
          <path fill="#334a3a" d="M806 85h8v-8h48v8h8v65h-8V89h-48v61h-8z"/><path fill="#a4e68a" opacity=".2" d="M816 91h44v59h-44z"/>
        </g>
      </> : <>
        <path fill="#111d16" d="M0 0h480v300H0z"/>
        <path stroke="#1d3023" d="M0 50h480M0 100h480M0 150h480M40 0v190M440 0v190"/>
        <rect x="43" y="29" width="159" height="99" fill="#334a3a"/><rect x="49" y="35" width="147" height="87" fill="#0a120e"/>
        <path fill="#dcdcc7" d="M159 46h12v4h4v12h-4v4h-12v-4h-4V50h4z"/>
        <g className="pixel-clouds" fill="#344737"><path d="M58 70h20v-5h29v5h16v7H58zM130 95h18v-4h26v4h16v6h-60z"/></g>
        <path fill="#233b2a" d="M49 115h20V99h12v-8h12v17h15v-8h11v-15h10v-9h10v33h18v-10h10v-9h13v15h16v17H49z"/>
        <path stroke="#455944" strokeWidth="5" d="M124 35v87M49 81h147"/>
        <path stroke="#415b44" strokeWidth="4" fill="none" d="M252 0v23h36v30M355 0v20h-30v13h57v38"/>
        <path fill="#314134" d="M237 63h159v128H237z"/><path fill="#7f8667" d="M247 74h139v78H247z"/><path fill="#080d0b" d="M255 82h123v62H255z"/>
        <path fill="#a4e68a" d="M265 94h35v3h-35zm0 9h76v3h-76zm0 9h54v3h-54zm0 9h14v3h-14z"/><rect className="monitor-cursor" x="283" y="121" width="6" height="4" fill="#a4e68a"/>
        <path fill="#536a4b" d="M265 159h37v7h-37zm46 0h37v7h-37z"/><rect x="369" y="159" width="5" height="5" fill="#a4e68a"/>
        <path fill="#7c7351" d="M218 185h191v9H218z"/><path fill="#3c4430" d="M229 194h9v51h-9zm151 0h9v51h-9z"/>
        <path fill="#928262" d="M231 171h17v14h-17zm17 3h5v8h-5z"/>
        <path fill="#223629" d="M53 182h58v63H53z"/><path fill="#455e42" d="M49 176h66v9H49z"/><path fill="#8aa872" d="M72 147h7v31h-7zm-12-8h12v17H60zm21 9h12v15H81z"/>
        <path fill="#344c39" d="M139 145h42v60h-42z"/><path fill="#080d0b" d="M146 151h28v20h-28z"/><path fill="#e8bd75" d="M150 157h20v3h-20zm0 7h11v2h-11z"/>
        <path fill="url(#tiles-lab)" d="M0 246h480v54H0z"/><path stroke="#5c8468" strokeWidth="3" d="M0 246h480"/>
        <path fill="#e8bd75" opacity=".05" d="M247 150h139l51 96H185z"/>
        <path stroke="#405542" strokeWidth="3" fill="none" d="M321 195v29h-45v22"/>
      </>}
    </svg>
    <div ref={actor} className="pixel-actor" style={journey ? { left: `${10 + progress * 69}%`, bottom: '20%' } : undefined}><Explorer mood={journey ? mood : mood === 'idle' && !paused ? 'walking' : mood} paused={paused}/></div>
    <span className="scene-coordinate">{journey ? `TIMELINE / ${Math.round(progress * 100)}%` : 'ROOM 001 / THE ARCHIVE'}</span>
  </div>;
}
