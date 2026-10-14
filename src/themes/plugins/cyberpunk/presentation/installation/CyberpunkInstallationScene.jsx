import React from 'react';

export const CYBERPUNK_INSTALLATION_PALETTE = Object.freeze({ surface: '#141421', ink: '#d0e5f0', border: '#776b97' });

export default function CyberpunkInstallationScene({ frame }) {
  const echo = frame.reducedMotion ? .35 : Math.sin(Math.PI * frame.response);
  return <div className="installation-world installation-world-cyberpunk" style={{ background: '#141421' }} aria-hidden="true">
    <svg className="installation-landscape" viewBox="0 0 900 540">
      <defs><linearGradient id="installation-cyber-signal"><stop stopColor="#dd57e9"/><stop offset="1" stopColor="#7be5ee"/></linearGradient></defs>
      <g fill="#232238" stroke="#515065" strokeWidth=".5">
        {Array.from({ length: 11 }, (_, index) => <path key={index} d={`M${index * 88 - 12} 450V${230 + (index * 53) % 155}H${index * 88 + 57}V450Z`}/>)}
      </g>
      <g stroke="#a970c0" opacity=".15">
        {Array.from({ length: 10 }, (_, index) => <path key={index} d={`M${index * 100 - 100} 540L450 380`}/>)}
        <path d="M0 445H900M0 488H900M0 527H900"/>
      </g>
      <g transform={`translate(450 ${238 + 55 * (1 - frame.installed)})`} opacity={frame.focus}>
        <path d="M-70-87H70L93-63V63L70 87H-70L-93 63V-63Z" fill="#171729" stroke="url(#installation-cyber-signal)" strokeWidth="2"/>
        <path d="M-49-63H49L63-49V49L49 63H-49L-63 49V-49Z" fill="#1c1832" stroke="#8cb8d3" opacity=".5"/>
        <circle r="35" stroke="#75e2ee" strokeWidth="1.6" fill="#202235" opacity={frame.installed}/>
        <path d="M-17 0L-4 13L21-16" stroke="#b0f7f5" strokeWidth="2" fill="none" opacity={frame.installed}/>
        <path d="M-33 112H33" stroke="#d886e8" strokeWidth="1.5" opacity={frame.installed}/>
      </g>
      {[0, 1, 2].map(index => <path key={index} d={`M${450 - 100 - frame.response * (40 + index * 35)} 350L450 ${160 - frame.response * (40 + index * 35)}L${450 + 100 + frame.response * (40 + index * 35)} 350Z`} stroke={index % 2 ? '#dd71e7' : '#80e5e9'} fill="none" opacity={echo * (.4 - index * .09)}/>)}
      <path d="M140 450H325M575 450H760" stroke="#90e4eb" opacity={.12 + echo * .4}/>
    </svg>
  </div>;
}
