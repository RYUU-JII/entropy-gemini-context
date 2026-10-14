import React from 'react';

function lines(value) {
  return String(value || '').split('\n');
}

function LandingChapterComponent({
  phaseId,
  activePhase,
  copy,
  headingLevel = 2,
  contentPresence = 1,
  style = undefined,
  children = null,
}) {
  if (!phaseId || !copy?.title) {
    throw new Error(`LANDING_READING_PHASE_CONTRACT_INVALID:${String(phaseId || 'unknown')}`);
  }
  const active = activePhase === phaseId;
  if (!Number.isFinite(contentPresence) || contentPresence < 0 || contentPresence > 1) {
    throw new Error(`LANDING_READING_PHASE_PRESENCE_INVALID:${phaseId}`);
  }
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  return (
    <section
      id={`landing-phase-${phaseId}`}
      className="landing-reading-section"
      data-landing-phase={phaseId}
      data-active={active ? 'true' : 'false'}
      aria-labelledby={`landing-title-${phaseId}`}
      tabIndex={phaseId === 'invitation' ? -1 : undefined}
      style={style}
    >
      <div className="landing-reading-section__viewport">
        <article
          className="landing-reading-plane"
          inert={active ? undefined : true}
          style={{ '--landing-reading-presence': active ? contentPresence : 0 }}
        >
          <p className="landing-reading-plane__eyebrow">{copy.eyebrow}</p>
          <Heading id={`landing-title-${phaseId}`} className="landing-reading-plane__title">
            {lines(copy.title).map((line, index) => (
              <React.Fragment key={`${phaseId}:${line}`}>
                {index > 0 ? <br /> : null}
                {line}
              </React.Fragment>
            ))}
          </Heading>
          {copy.body ? <p className="landing-reading-plane__body">{copy.body}</p> : null}
          {children}
          {copy.note ? <p className="landing-reading-plane__note">{copy.note}</p> : null}
          {copy.citation ? (
            <p className="landing-reading-plane__citation">{copy.citation}</p>
          ) : null}
        </article>
      </div>
    </section>
  );
}

export const LandingChapter = React.memo(LandingChapterComponent);
