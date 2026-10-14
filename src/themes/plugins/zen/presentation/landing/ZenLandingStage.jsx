import React from 'react';

import ZenLandingPondCanvas from './canvas/ZenLandingPondCanvas.jsx';
import ZenLandingBonsai from './layers/ZenLandingBonsai.jsx';
import './ZenLandingStage.css';

export default function ZenLandingStage({ className = '', presentation }) {
  if (
    !presentation
    || typeof presentation !== 'object'
    || !presentation.state
    || !presentation.layers
    || !Number.isFinite(presentation.visualProgress)
  ) {
    throw new Error('ZEN_LANDING_PRESENTATION_REQUIRED');
  }
  const { environment, motionMode } = presentation.state;
  const sunArc = Math.sin(presentation.visualProgress * Math.PI);
  const stageClassName = ['zenLandingStage', className].filter(Boolean).join(' ');
  const style = {
    '--zen-landing-dawn': environment.dawn,
    '--zen-landing-daylight': environment.daylight,
    '--zen-landing-ink': presentation.palette.ink,
    '--zen-landing-invitation': presentation.layers.invitation,
    '--zen-landing-journey-progress': presentation.visualProgress,
    '--zen-landing-mist': presentation.palette.mist,
    '--zen-landing-bank-rear': presentation.palette.bankRear,
    '--zen-landing-bank-near': presentation.palette.bankNear,
    '--zen-landing-night': environment.nightDepth,
    '--zen-landing-paper': presentation.palette.paper,
    '--zen-landing-pond-opacity': presentation.layers.pond,
    '--zen-landing-shore': presentation.palette.shore,
    '--zen-landing-sky-bottom': presentation.palette.skyBottom,
    '--zen-landing-sky-top': presentation.palette.skyTop,
    '--zen-landing-sun-opacity': Math.max(
      environment.dawn * 0.35,
      environment.daylight * 0.62,
      environment.twilight * 0.3,
    ),
    '--zen-landing-sun-x': `${20 + (presentation.visualProgress * 63)}%`,
    '--zen-landing-sun-y': `${27 - (sunArc * 15) + (presentation.visualProgress * 5)}%`,
    '--zen-landing-twilight': environment.twilight,
  };

  return (
    <div
      className={stageClassName}
      data-phase={presentation.state.phase}
      data-motion={motionMode}
      style={style}
      aria-hidden="true"
    >
      <div className="zenLandingStage__sky" />
      <div className="zenLandingStage__sun" />
      <div className="zenLandingStage__stars" />

      <div className="zenLandingStage__lightField">
        <div className="zenLandingStage__lightFieldGlow" />
      </div>

      <svg
        className="zenLandingStage__pondArchitecture"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <path
          className="zenLandingStage__pondPlane"
          d="M-80 328C282 279 647 292 914 312c286 22 511 14 766-24v692H-80Z"
        />
        <path
          className="zenLandingStage__pondBank zenLandingStage__pondBank--rear"
          d="M-80 300c273-38 533-42 773-23 168 13 323 39 479 35 184-4 341-38 508-64v92c-225 38-447 48-665 30-273-23-475-49-727-27-123 11-245 30-368 47Z"
        />
        <path
          className="zenLandingStage__pondRim zenLandingStage__pondRim--rear"
          d="M-80 327c286-42 564-45 817-23 177 16 335 35 500 28 158-7 299-34 443-57"
        />
        <path
          className="zenLandingStage__pondRim zenLandingStage__pondRim--near"
          d="M-80 829c291 22 596 31 899 19 327-13 609-44 861-82"
        />
      </svg>

      <div className="zenLandingStage__mist zenLandingStage__mist--one" />
      <div className="zenLandingStage__mist zenLandingStage__mist--two" />

      <ZenLandingPondCanvas presentation={presentation} />

      <ZenLandingBonsai presentation={presentation} />

      <div className="zenLandingStage__shore" />
      <div className="zenLandingStage__vignette" />
      <div className="zenLandingStage__grain" />
    </div>
  );
}
