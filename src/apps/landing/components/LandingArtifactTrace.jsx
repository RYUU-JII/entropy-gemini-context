import React from 'react';

const TRACE_ITEMS = Object.freeze([
  Object.freeze({ id: 'shoji', glyph: '障', family: 'LENS' }),
  Object.freeze({ id: 'shishi', glyph: '鹿', family: 'GATE' }),
  Object.freeze({ id: 'furin', glyph: '鈴', family: 'FLARE' }),
]);

function requireArtifactTrace(trace) {
  if (!trace || typeof trace !== 'object' || Array.isArray(trace)) {
    throw new Error('LANDING_ARTIFACT_TRACE_REQUIRED');
  }
  if (!trace.colors || typeof trace.colors !== 'object') {
    throw new Error('LANDING_ARTIFACT_TRACE_COLORS_REQUIRED');
  }
  TRACE_ITEMS.forEach(({ id }) => {
    const color = trace.colors[id];
    if (typeof color !== 'string' || color.length === 0) {
      throw new Error(`LANDING_ARTIFACT_TRACE_COLOR_REQUIRED:${id}`);
    }
  });
  return trace;
}

export default function LandingArtifactTrace({ activeArtifactId, copy, trace }) {
  const resolvedTrace = requireArtifactTrace(trace);
  if (activeArtifactId !== null && !TRACE_ITEMS.some(({ id }) => id === activeArtifactId)) {
    throw new Error(`LANDING_ARTIFACT_TRACE_ACTIVE_ID_INVALID:${String(activeArtifactId)}`);
  }

  return (
    <aside
      className="landing-artifact-trace"
      aria-label={copy.artifactTraceLabel}
      style={{ '--landing-trace-presence': resolvedTrace.presence }}
    >
      <div className="landing-artifact-trace__line" aria-hidden="true" />
      <ol>
        {TRACE_ITEMS.map((item, index) => {
          const active = item.id === activeArtifactId;
          const passed = resolvedTrace.passedIds.includes(item.id);
          return (
            <li
              key={item.id}
              data-artifact={item.id}
              data-active={active ? 'true' : 'false'}
              data-passed={passed ? 'true' : 'false'}
              aria-current={active ? 'step' : undefined}
              style={{
                '--landing-artifact-accent': resolvedTrace.colors[item.id],
                '--landing-trace-index': index,
              }}
            >
              <span className="landing-artifact-trace__notch" aria-hidden="true" />
              <span className="landing-artifact-trace__sigil" aria-hidden="true">{item.glyph}</span>
              <span className="landing-artifact-trace__label" aria-hidden="true">
                <span>{copy.artifactNames[item.id]}</span>
                <small>{item.family}</small>
              </span>
              <span className="sr-only">
                {copy.artifactNames[item.id]} — {item.family}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
