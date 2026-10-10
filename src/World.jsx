import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

function Pine({ x, y, scale = 1, color = '#253b3e' }) { return <g transform={`translate(${x} ${y}) scale(${scale})`}><path fill="#443b44" d="M-3 0h6v-48h-6z"/><path fill={color} d="M0-97h6v12h8v12h8v11h-8v5h15v12h9v12H16v5h24v12H-35v-12h15v-6h-11v-12h10v-12h9v-5h-9v-11h9v-12h7v-11H0z"/><path fill="#789778" opacity=".25" d="M0-85h5v13h-9v13h-9v12h-9v12h9v-9h10v-12h8v-12H0z"/></g>; }
function House({ x, y, scale = 1 }) { return <g transform={`translate(${x} ${y}) scale(${scale})`}><path fill="#292b3d" d="M0 0v-53h86V0z"/><path fill="#675468" d="M4-4v-47h78v47z"/><path fill="#392f43" d="M-10-51v-7h10v-9h11v-9h12v-9h39v9h12v9h12v9h10v7z"/><path fill="#92717c" d="M-10-58H0v-9h11v-9h12v-9h39v7H25v9H14v10H4v7h-14z"/><path fill="#bd9384" d="M67-73v-26h11v34z"/><path fill="#edd198" d="M12-40h20v22H12zm44 0h17v22H56z"/><path stroke="#755459" strokeWidth="3" d="M22-40v22M12-29h20m32-11v22m-8-11h17"/><path fill="#352f3e" d="M37-31h13V0H37z"/><path fill="#d9ae68" d="M46-17h2v2h-2z"/><path fill="#927680" d="M0-8h34v3H0m52-6h32v3H52"/></g>; }
export function Explorer({ mood = 'idle', className = '' }) { return <svg className={`explorer ${mood} ${className}`} viewBox="0 0 24 32" role="img" aria-label={`Pixel explorer ${mood}`} shapeRendering="crispEdges"><g className="explorer-body"><path fill="#302d40" d="M6 5h12v3h3v13H3V8h3z"/><path fill="#d6a065" d="M6 3h12v3h3v4H3V6h3z"/><path fill="#ebbd7c" d="M7 2h10v4H7zM1 9h22v3H1z"/><path fill="#cbb18c" d="M7 12h11v9H7z"/><path fill="#353044" d="M15 13h2v3h-2z"/><path fill="#789778" d="M5 21h13v7H5z"/><path fill="#b17468" d="M2 19h5v8H2z"/><path fill="#d9b28a" d="M18 22h3v5h-3z"/></g><path className="leg left-leg" fill="#453747" d="M6 28h5v4H4v-2h2z"/><path className="leg right-leg" fill="#453747" d="M13 28h5v2h2v2h-7z"/></svg>; }
export default function World({ journey = false, progress = 0, mood = 'idle' }) {
  const root = useRef(null);
  useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; const ctx = gsap.context(() => { gsap.to('.cloud-layer', { x: 30, duration: 26, yoyo: true, repeat: -1, ease: 'sine.inOut' }); gsap.to('.scenery', { y: 55, ease: 'none', scrollTrigger: { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true } }); }, root); return () => ctx.revert(); }, []);
  useEffect(() => { if (!journey) return; const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; gsap.to(root.current.querySelector('.traveler'), { x: progress * 8.3, duration: reduce ? 0 : 1.1, ease: 'power1.inOut' }); }, [progress, journey]);
  return <div ref={root} className={`world ${journey ? 'journey-world' : ''} ${journey && progress === 75 ? 'rain-world' : ''}`} aria-label="Pixel art mountain village beneath a lavender night sky" role="img">
    <svg className="scenery" viewBox="0 0 1440 680" preserveAspectRatio="xMidYMid slice" shapeRendering="crispEdges">
      <defs><linearGradient id={journey ? 'sky-j' : 'sky'} x2="0" y2="1"><stop stopColor="#22253e"/><stop offset=".53" stopColor="#70617e"/><stop offset="1" stopColor="#c39799"/></linearGradient><linearGradient id={journey ? 'water-j' : 'water'} x2="0" y2="1"><stop stopColor="#81718a"/><stop offset="1" stopColor="#3f5660"/></linearGradient></defs>
      <path fill={`url(#${journey ? 'sky-j' : 'sky'})`} d="M0 0h1440v680H0z"/>
      {Array.from({ length: 70 }, (_, i) => <rect key={i} x={(i * 179 + 31) % 1440} y={(i * 73 + 17) % 270} width={i % 6 ? 2 : 4} height={i % 6 ? 2 : 4} fill="#f2e6c9" opacity={.2 + (i % 4) * .16}/>)}
      <path fill="#f2e6c9" d="M1130 65h30v7h8v26h-8v8h-30v-8h-7V73h7z"/><path fill="#d1c4b8" d="M1152 73h8v8h-8zm-18 21h7v6h-7z"/>
      <path className="shooting-star" fill="#f2e6c9" d="M760 55h4v4h-4zm-6-4h5v3h-5zm-6-4h5v3h-5zm-6-4h5v3h-5z"/>
      <g className="cloud-layer" fill="#a190a9" opacity=".2"><path d="M82 141h37v-8h55v8h43v8h46v9H62v-8h20zM870 173h55v-9h61v9h31v8h45v8H846v-8h24zM1204 237h55v-7h76v7h46v9h-192v-5h15z"/><path d="M331 82h28v-8h58v8h37v8h-123z"/></g>
      <path fill="#665e7d" d="M0 315h35v-20h36v-19h30v-27h37v-33h32v-27h32v-20h33v24h29v23h30v34h32v29h33v25h41v-20h38v-31h36v-32h33v-32h31v-29h30v32h33v31h31v33h35v32h43v23h61v-28h39v-28h33v-28h34v-31h32v-28h32v-24h31v29h29v29h29v25h33v31h29v24h35v27h30v-17h42v-34h33v-33h35v-27h36v-28h33v-29h31v32h34v29h33v32h34v31h40v33h46v190H0z"/>
      <path fill="#48465f" d="M0 381h46v-26h42v-24h41v-28h45v-29h38v25h42v24h44v28h49v30h59v-17h42v-26h44v-30h41v-27h37v30h40v31h48v24h45v24h66v-17h43v-26h41v-22h40v-26h39v-22h38v23h39v26h44v26h40v27h66v-21h50v-24h45v-30h43v-25h40v30h47v28h45v30h55v31h55v230H0z"/>
      <path fill="#354451" d="M0 442h92v-18h66v-16h112v19h117v24h167v-16h104v15h153v-23h138v-13h113v15h111v-11h119v16h148v246H0z"/>
      <path fill={`url(#${journey ? 'water-j' : 'water'})`} d="M600 445h214v16h81v18h-52v18h-98v22H611v24H476v31H201v-35h152v-28h119v-26h76v-22h52z"/>
      <g fill="#b4a0ac" opacity=".45"><path d="M621 467h144v3H621zm-48 17h95v3h-95zm61 17h123v3H634zm-154 19h108v3H480zm-71 22h146v3H409zm-139 16h115v3H270z"/></g>
      <g fill="#34423f"><path d="M0 482h90v-13h106v13h138v19h102v26h-74v27H212v38H0zM901 477h177v-12h161v12h201v203H806v-65h-93v-51h99v-38h89z"/></g>
      {Array.from({ length: 17 }, (_, i) => <Pine key={i} x={i * 97 + 13} y={444 + i % 3 * 12} scale={.38 + i % 3 * .14} color="#31434b"/>)}
      <House x={1020} y={473} scale={.85}/><House x={1152} y={492} scale={.63}/><House x={283} y={489} scale={.59}/>
      <path fill="#867468" d="M1440 535h-247v16h-160v19H864v24H668v26H411v29H0v31h434v-23h249v-24h202v-23h173v-25h171v-17h211z"/>
      <path fill="#413d43" d="M0 652h424v-29h251v-26h196v-22h176v-19h172v-15h221v11h-215v16h-169v20H880v24H684v27H435v29H0z"/>
      <path fill="none" stroke="#c0a395" strokeWidth="3" d="M0 654h425v-28h253v-25h195v-23h178v-20h172v-15h217M0 667h438v-28h253v-25h195v-23h178v-20h172v-15h204"/>
      {Array.from({ length: 22 }, (_, i) => <path key={i} stroke="#4d4044" strokeWidth="5" d={`M${i * 20} 647v26`}/>)}
      <path fill="#252f32" d="M0 602h125v-21h88v-21h117v21h94v24h86v75H0zm971 59h117v-26h115v-15h87v-27h150v87H971z"/>
      <Pine x={51} y={602} scale={2.4}/><Pine x={143} y={617} scale={1.6}/><Pine x={9} y={660} scale={2.1}/><Pine x={1328} y={601} scale={2}/><Pine x={1412} y={634} scale={2.7}/><Pine x={1244} y={593} scale={1.25}/>
      <g transform="translate(981 549)"><path fill="#292e3a" d="M0 0h5v-114h-5zm-10-114h25v-6h-25z"/><path fill="#f4d99a" d="M-6-111h17v17H-6z"/><path fill="#f6d798" opacity=".07" d="M-24-129h54v55h-54zM-45-150h96v98h-96z"/></g>
      <g fill="#bd9b75" opacity=".7">{Array.from({ length: 35 }, (_, i) => <path key={i} d={`M${(i * 127) % 1440} ${590 + i * 17 % 86}h4v3h-4z`}/>)}</g>
      <g className="traveler" transform={journey ? 'translate(230 572)' : 'translate(916 532)'}><foreignObject width="31" height="42"><Explorer mood={mood}/></foreignObject></g>
    </svg><div className="scene-vignette"/>
  </div>;
}
