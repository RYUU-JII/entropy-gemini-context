import React from 'react';

export const MATRIX_INSTALLATION_PALETTE = Object.freeze({ surface: '#06110c', ink: '#b9edcd', border: '#507b60' });

export default function MatrixInstallationScene({ frame }) {
  const echo = frame.reducedMotion ? .3 : Math.sin(Math.PI * frame.response);
  const columns = Array.from({ length: 17 }, (_, index) => index);
  return <div className="installation-world installation-world-matrix" style={{ background: '#06110c' }} aria-hidden="true">
    <svg className="installation-landscape" viewBox="0 0 900 540">
      <g fill="none" stroke="#53ba80" strokeWidth=".6" opacity=".16">
        {columns.map(index => <path key={index} d={`M${index * 58 - 15} 0V540`} />)}
        {Array.from({ length: 10 }, (_, index) => <path key={index} d={`M0 ${index * 60}H900`}/>)}
      </g>
      <g fill="#71d891" opacity={.12 + .12 * frame.focus} fontFamily="var(--font-theme-mono)" fontSize="11">
        {columns.map(index => <text key={index} x={index * 54 + 18} y={70 + (index * 43) % 280} writingMode="vertical-rl">{index % 2 ? '1010011010001101' : '0100110101010010'}</text>)}
      </g>
      <g transform={`translate(450 252) scale(${.75 + .25 * frame.installed})`}>
        <circle r="110" fill="#08180e" stroke="#77db9d" strokeWidth=".8" opacity={frame.focus}/>
        <path d="M-93-27V-77H-43M43-77H93V-27M93 27V77H43M-43 77H-93V27" fill="none" stroke="#a1efb8" opacity={frame.installed}/>
        <path d="M0-65L54-32V32L0 65L-54 32V-32Z" fill="#123320" stroke="#84e6ac" strokeWidth="1.3" opacity={frame.installed}/>
        <path d="M0-40V40M-34-20L34 20M-34 20L34-20" stroke="#d7fce4" strokeWidth="1" opacity={frame.installed}/>
        {[0, 1, 2].map(index => <circle key={index} r={80 + index * 45 + frame.response * 85} fill="none" stroke="#8ef5b0" opacity={echo * (.5 - index * .12)}/>)}
        <circle r="3" fill="#d7ffe3" opacity={frame.installed}/>
      </g>
      <path d="M0 445H355L376 429H524L545 445H900" stroke="#67ca91" fill="none" opacity=".25"/>
    </svg>
  </div>;
}
