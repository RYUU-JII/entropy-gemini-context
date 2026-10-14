import React from 'react';

export const CLINICAL_INSTALLATION_PALETTE = Object.freeze({ surface: '#e8eeeb', ink: '#325752', border: '#8faa9f' });

export default function ClinicalInstallationScene({ frame }) {
  const echo = frame.reducedMotion ? .3 : Math.sin(Math.PI * frame.response);
  return <div className="installation-world installation-world-clinical" style={{ background: '#e8eeeb' }} aria-hidden="true">
    <svg className="installation-landscape" viewBox="0 0 900 540">
      <g stroke="#78959b" strokeWidth=".5" opacity=".16">
        {Array.from({ length: 15 }, (_, index) => <path key={index} d={`M${index * 65} 0V540`}/>)}
        {Array.from({ length: 10 }, (_, index) => <path key={index} d={`M0 ${index * 60}H900`}/>)}
      </g>
      <g transform={`translate(450 ${243 + 35 * (1 - frame.installed)})`} opacity={frame.focus}>
        <circle r="115" fill="#d9e9e5" stroke="#7f9b97" strokeWidth=".8"/>
        <circle r="87" fill="#ecf3ef" stroke="#adc1b9"/>
        <circle r="62" fill="none" stroke="#417b78" strokeWidth="1" strokeDasharray="2 7" opacity={frame.installed}/>
        <path d="M-31 0H-13L-5-23L7 24L18 0H33" stroke="#3e7a76" strokeWidth="2" fill="none" opacity={frame.installed}/>
        <path d="M0-113V-96M0 96V113M-113 0H-96M96 0H113" stroke="#6b9088"/>
        {[0, 1, 2].map(index => <circle key={index} r={90 + frame.response * (55 + index * 45)} fill="none" stroke="#3b8981" opacity={echo * (.3 - index * .07)}/>)}
      </g>
      <path d="M100 429H365L379 418L393 442L408 405L425 429H800" fill="none" stroke="#739a91" opacity={.2 + frame.response * .3}/>
    </svg>
  </div>;
}
