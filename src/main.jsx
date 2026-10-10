import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowRight, Volume2, VolumeX, X, Play, ChevronRight, Link, Gamepad2, Sparkles, ShieldCheck } from 'lucide-react';
import World, { Explorer } from './World';
import Coin from './Coin';
import MemoryTerminal from "./MemoryTerminal";
import './style.css';

function App() {
  const [sound, setSound] = useState(false), audio = useRef(null);
  const [error, setError] = useState("");
  const [about, setAbout] = useState(false);
  const dialog = useRef(null);
  useEffect(() => () => { audio.current?.close(); }, []);
  useEffect(() => {
    if (!sound) return;
    let note = 0;
    const interval = setInterval(() => {
      const ctx = audio.current; if (!ctx || document.hidden) return;
      const oscillator = ctx.createOscillator(), gain = ctx.createGain();
      oscillator.type = 'triangle'; oscillator.frequency.value = [196, 246.94, 293.66, 220, 196, 329.63, 293.66, 246.94][note++ % 8];
      gain.gain.setValueAtTime(.001, ctx.currentTime); gain.gain.linearRampToValueAtTime(.012, ctx.currentTime + .15); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + 1.5);
      oscillator.connect(gain).connect(ctx.destination); oscillator.start(); oscillator.stop(ctx.currentTime + 1.5);
    }, 1800);
    return () => clearInterval(interval);
  }, [sound]);
  useEffect(() => { if (about) dialog.current?.showModal(); else dialog.current?.close(); }, [about]);
  function tone(enabled = sound) {
    if (!enabled || !audio.current) return;
    const ctx = audio.current; ctx.resume(); const now = ctx.currentTime;
    [440, 660].forEach((frequency, i) => { const osc = ctx.createOscillator(), gain = ctx.createGain(); osc.type = 'triangle'; osc.frequency.value = frequency; gain.gain.setValueAtTime(.025, now + i * .1); gain.gain.exponentialRampToValueAtTime(.001, now + i * .1 + .22); osc.connect(gain).connect(ctx.destination); osc.start(now + i * .1); osc.stop(now + i * .1 + .23); });
  }
  function toggleSound() { if (!sound) { try { audio.current ||= new (window.AudioContext || window.webkitAudioContext)(); tone(true); } catch { setError('Audio is unavailable in this browser.'); return; } } else { audio.current?.suspend(); } setSound(!sound); }
  return <>
    <header className="site-header"><a className="wordmark" href="#" aria-label="WhatIf home"><span className="logo-symbol">W<span>?</span></span>what<span>if</span><span className="logo-dot">.</span></a><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><button onClick={() => setAbout(true)}>The story</button><a href="#time-machine" className="nav-explore">Explore a memory <ArrowRight size={14}/></a></nav><button className="sound-button" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Mute sound' : 'Enable sound'}>{sound ? <Volume2 size={15}/> : <VolumeX size={15}/>}<span>SOUND {sound ? 'ON' : 'OFF'}</span></button></header>
    <main>
      <section className="hero"><World/><div className="hero-content"><div className="eyebrow"><span/> A LITTLE TIME TRAVEL. A LOT OF WHAT IF.</div><h1>Your past is<br/><span>playable.</span></h1><p>That one trade. That one decision. That one what if.<br/>Take a trip back and see where another path could have led.</p><a href="#time-machine" className="primary-button" onClick={() => tone()}><Play size={14} fill="currentColor"/> VISIT YOUR PAST <ArrowRight size={16}/></a><div className="hero-note">No wallet connection. Just a memory.</div></div><div className="scene-caption"><span className="tiny-star">✦</span> SOMEWHERE BETWEEN THEN & NOW <span className="caption-line"/></div><a href="#time-machine" className="scroll-cue" aria-label="Scroll to time machine"><ArrowDown size={16}/></a><div className="coordinate">LVL. 01 <span>•</span> THE CROSSROADS</div></section>
      <section id="time-machine" className="machine-section"><div className="section-intro"><div className="eyebrow">↳ PRESS START ON AN OLD MEMORY</div><h2>Every decision has another story.</h2><p>Find yours. Step into the timeline you never got to see.</p></div>
        <div className="machine-layout"><aside className="memory-aside"><div className="save-label"><span className="status-dot"/> MEMORY SLOT 01</div><h3>A little curiosity.<br/>A different ending.</h3><p>You can’t change the past.<br/>But you can visit it.</p><div className="explorer-card"><Explorer mood="idle"/><div><span>YOUR PAST SELF</span><p>Ready when you are.</p></div><span className="mini-spark">✧</span></div><div className="privacy"><ShieldCheck size={15}/><span>No wallet. No sign-up.<br/>Your memories stay yours.</span></div></aside>
        <MemoryTerminal tone={tone}/></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="data-note"><span>✧</span> A journey through possibilities. Not a prediction of the future.</div>
      </section>
      <section id="how-it-works" className="how-section"><div className="how-heading"><div><div className="eyebrow">THE JOURNEY, IN THREE LITTLE STEPS</div><h2>A save file for your what if.</h2></div><span className="pixel-flower">✳</span></div><div className="steps"><article><div className="step-icon"><Link size={24}/><span>01</span></div><h3>Find a memory</h3><p>Start with a transaction.<br/>A little piece of your past.</p></article><article><div className="step-icon"><Gamepad2 size={28}/><span>02</span></div><h3>Choose another path</h3><p>Hold a little longer. Sell a little sooner.<br/>See what your past self could have done.</p></article><article><div className="step-icon"><Sparkles size={25}/><span>03</span></div><h3>Meet your other ending</h3><p>Watch an alternate timeline unfold.<br/>Leave with a story, not just a number.</p></article></div></section>
      <section className="closing"><Coin/><p>Somewhere, in another timeline,<br/><em>you made a different choice.</em></p><a href="#time-machine">LET’S GO VISIT IT <ChevronRight size={14}/></a></section>
    </main><footer><a className="wordmark" href="#">what<span>if</span>.</a><span>You can’t change the past. But you can visit it.</span><div><span className="status-dot"/> NO DATA STORED <span className="footer-star">✦</span> MADE OF WHAT IFS</div></footer>
    <dialog ref={dialog} aria-labelledby="story-title" onClose={() => setAbout(false)} onClick={e => { if (e.target === dialog.current) { const rect = dialog.current.getBoundingClientRect(); if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) setAbout(false); } }}><button className="close-modal" aria-label="Close story" autoFocus onClick={() => setAbout(false)}><X size={20}/></button><div className="eyebrow">A LETTER FROM ANOTHER TIMELINE</div><h2 id="story-title">We all have that one what if.</h2><p>A decision you replay. A moment you’d like to borrow back. WhatIf is a small place to visit those possibilities, inspired by the games we grew up with.</p><p>No wallet connections, accounts, databases, or browser storage. Your choices exist only until you close or reload this page.</p><button className="small-button" onClick={() => setAbout(false)}>BACK TO THE PRESENT <ArrowRight size={14}/></button></dialog>
  </>;
}
createRoot(document.getElementById('root')).render(<App/>);
