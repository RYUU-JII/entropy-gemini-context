import React from 'react';

export const SCP_INSTALLATION_PALETTE = Object.freeze({ surface: '#1b1f19', ink: '#d3d6c3', border: '#77806c' });

export default function ScpInstallationScene({ frame }) {
  const echo = frame.reducedMotion ? .3 : Math.sin(Math.PI * frame.response);
  return <div className="installation-world installation-world-scp" style={{ background: '#1b1f19' }} aria-hidden="true">
    <svg className="installation-landscape" viewBox="0 0 900 540">
      <g fill="none" stroke="#a39883" opacity=".16"><path d="M92 75H808V445H92ZM110 93H790V427H110Z"/><path d="M92 161H208M692 161H808M92 359H208M692 359H808"/></g>
      <g transform={`translate(450 ${255 + 55 * (1 - frame.installed)})`} opacity={frame.focus}>
        <path d="M-104-103H104V103H-104Z" fill="#262820" stroke="#bdb8a4" strokeWidth="1"/>
        <path d="M-87-86H87V86H-87Z" fill="#171b17" stroke="#676e59"/>
        <path d="M-72-64H72M-72 64H72" stroke="#9eae87" opacity={frame.installed}/>
        <circle r="45" stroke="#bac2a6" fill="none" opacity={frame.installed}/>
        <path d="M0-55V-20M-47 27L-17 10M47 27L17 10" stroke="#ced1bd" strokeWidth="4" opacity={frame.installed}/>
        <path d="M-7-32L0-20L7-32M-25 7L-17 10L-22 19M25 7L17 10L22 19" stroke="#ced1bd" strokeWidth="2" fill="none" opacity={frame.installed}/>
        <path d="M-101 85L-82 101M-78 85L-59 101M59 85L78 101M82 85L101 101" stroke="#ac9a67" strokeWidth="4"/>
      </g>
      {[0, 1, 2].map(index => <path key={index} d={`M${316 - frame.response * index * 40} 130H${584 + frame.response * index * 40}V${380 + frame.response * index * 20}H${316 - frame.response * index * 40}Z`} stroke="#d0d6bb" fill="none" opacity={echo * (.4 - index * .1)}/>)}
      <g fill="#c0c6ac" opacity={frame.installed}><circle cx="207" cy="255" r="2"/><circle cx="693" cy="255" r="2"/></g>
    </svg>
  </div>;
}
