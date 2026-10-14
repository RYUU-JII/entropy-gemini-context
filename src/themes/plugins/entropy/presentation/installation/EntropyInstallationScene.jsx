import React from 'react';

export const ENTROPY_INSTALLATION_PALETTE = Object.freeze({ surface: '#151b16', ink: '#d4dcc5', border: '#687962' });

export default function EntropyInstallationScene({ frame }) {
  const echo = frame.reducedMotion ? .3 : Math.sin(Math.PI * frame.response);
  return <div className="installation-world installation-world-entropy" style={{ background: '#151b16' }} aria-hidden="true">
    <svg className="installation-landscape" viewBox="0 0 900 540">
      <g fill="none" stroke="#a4b39d" opacity=".12">
        {Array.from({ length: 12 }, (_, index) => <path key={index} d={`M${index * 82} 0V540`}/>)}
        <path d="M0 120H900M0 420H900M95 0V540M805 0V540"/>
      </g>
      <g transform={`translate(450 ${246 + 50 * (1 - frame.installed)})`} opacity={frame.focus}>
        <path d="M-115-108H115V108H-115Z" fill="#181d19" stroke="#738675" strokeWidth="1"/>
        <path d="M-128-70H-115M115-70H128M-128 70H-115M115 70H128" stroke="#d4d7b9" strokeWidth="8"/>
        <path d="M-80-74H80V40L57 63H-80Z" fill="#0d120e" stroke="#829782"/>
        <path d="M-66 31H66" stroke="#c4d9ac" strokeWidth="2" opacity={frame.installed}/>
        {Array.from({ length: 13 }, (_, index) => <path key={index} d={`M${index * 10 - 60} 15V${15 - frame.installed * (10 + index % 4 * 10)}`} stroke="#bacda7" opacity=".65"/>)}
        <circle cx="-81" cy="83" r="3" fill="#ddca78" opacity={frame.installed}/>
        <path d="M-63 83H-28M28 83H61" stroke="#667667" strokeWidth="2"/>
        <circle cx="85" cy="83" r="5" fill="#a6c39b" opacity={frame.installed}/>
      </g>
      {[0, 1, 2].map(index => <rect key={index} x={312 - frame.response * (60 + index * 40)} y={112 - frame.response * (35 + index * 25)} width={276 + frame.response * (120 + index * 80)} height={268 + frame.response * (70 + index * 50)} fill="none" stroke="#c8dcaf" opacity={echo * (.3 - index * .08)}/>)}
      <g fill="#b4bda7" opacity=".25"><circle cx="117" cy="140" r="2"/><circle cx="783" cy="140" r="2"/><circle cx="117" cy="400" r="2"/><circle cx="783" cy="400" r="2"/></g>
    </svg>
  </div>;
}
