import React, { useLayoutEffect, useRef } from 'react';
import { createZenFurinPresentation } from '../artifacts/ZenFurinPresentation.js';
import './ZenInstallationScene.css';

export const ZEN_INSTALLATION_PALETTE = Object.freeze({ surface: '#13201c', ink: '#e9e4d2', border: '#6d8270' });

export default function ZenInstallationScene({ frame }) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const lastTimeRef = useRef(0);
  const breezeRef = useRef(false);
  useLayoutEffect(() => {
    const renderer = createZenFurinPresentation({ container: containerRef.current, reducedMotion: frame.reducedMotion });
    rendererRef.current = renderer;
    lastTimeRef.current = 0;
    breezeRef.current = false;
    return () => { renderer.dispose(); rendererRef.current = null; };
  }, [frame.reducedMotion]);
  useLayoutEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) throw new Error('zen_installation_renderer_unprepared');
    if (frame.elapsedMs >= 5000 && !breezeRef.current) {
      breezeRef.current = true;
      renderer.blow();
    }
    renderer.frame({ frameMs: Math.max(0, Math.min(50, frame.elapsedMs - lastTimeRef.current)),
      progress: { visibleElapsedMs: frame.elapsedMs, arrivalMs: 3500 } });
    lastTimeRef.current = frame.elapsedMs;
  }, [frame]);

  const ripple = frame.reducedMotion ? 0.45 : Math.sin(Math.PI * frame.response);
  return <div className="installation-world installation-world-zen" style={{ background: '#13201c' }} aria-hidden="true">
    <svg className="installation-landscape" viewBox="0 0 900 540" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="installation-zen-dawn"><stop stopColor="#ece7d7" stopOpacity=".13"/><stop offset="1" stopColor="#ece7d7" stopOpacity="0"/></radialGradient>
        <linearGradient id="installation-zen-water" x2="0" y2="1"><stop stopColor="#253934"/><stop offset="1" stopColor="#101f1c"/></linearGradient>
      </defs>
      <circle cx="620" cy="155" r="240" fill="url(#installation-zen-dawn)"/>
      <circle cx="640" cy="145" r="24" fill="#ded8c6" opacity=".16"/>
      <path d="M0 318Q110 261 236 303T480 302T710 316T900 273V540H0Z" fill="#1f3029"/>
      <path d="M0 378Q145 323 310 365T655 356T900 346V540H0Z" fill="url(#installation-zen-water)"/>
      <path d="M0 367Q175 322 345 367T730 357T900 357" fill="none" stroke="#b4bdab" opacity=".17"/>
      <g fill="none" stroke="#d8d8ba" strokeWidth=".8">
        {[0, 1, 2].map(index => <ellipse key={index} cx="450" cy="418" rx={35 + 130 * frame.response + index * 36} ry={5 + 18 * frame.response + index * 5} opacity={ripple * (.34 - index * .07)}/>)}
      </g>
      <path d="M70 0L142 65L267 77M142 65L137 135M142 65L82 130" fill="none" stroke="#252923" strokeWidth="10" strokeLinecap="round"/>
      <path d="M900 34L793 57L690 42M793 57L812 139" fill="none" stroke="#252923" strokeWidth="9" strokeLinecap="round"/>
      <g stroke="#62715b" opacity=".5" fill="none" strokeWidth="3"><path d="M113 538Q121 446 87 388M127 540Q158 469 189 430M742 540Q721 466 755 414"/></g>
      <path d="M149 428Q186 414 202 433Q180 430 149 428Z" fill="#465447"/>
      <path d="M695 398Q720 387 741 400Q716 395 695 398Z" fill="#49564a"/>
    </svg>
    <div className="installation-zen-furin-position" style={{ opacity: .05 + .95 * frame.focus,
      transform: `translateY(${(1 - frame.installed) * 95}px) scale(${.88 + frame.installed * .12})` }}>
      <div ref={containerRef} className="installation-zen-furin"/>
    </div>
    <div className="installation-response-light" style={{ opacity: ripple * .32 }}/>
  </div>;
}
