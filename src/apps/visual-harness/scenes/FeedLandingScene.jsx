import React, { useLayoutEffect, useRef } from 'react';

import FeedLandingApp from '../../feed-landing/FeedLandingApp.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

let sceneId;

function FeedLandingScene({ signalReady }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    // The standalone page owns document scrolling; the shared component harness
    // otherwise clips body overflow. Keep this adjustment inside this scene.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'auto';
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root.querySelector('main') || !root.querySelector('article')) {
          throw new Error('FEED_LANDING_CAPTURE_CONTENT_MISSING');
        }
        if (document.documentElement.scrollWidth > window.innerWidth + 1) {
          throw new Error('FEED_LANDING_CAPTURE_HORIZONTAL_OVERFLOW');
        }
        if (sceneId.endsWith('-aligned')) {
          // Operate the public native control, not the artwork's internal state.
          const input = root.querySelector('input[type=range]');
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '100');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          frame = requestAnimationFrame(() => {
            if (!root.querySelector('svg[aria-label="점들이 고리가 있는 행성으로 맞춰진 모습"]') || !root.querySelector('[role=status]').textContent) {
              throw new Error('FEED_LANDING_CAPTURE_ALIGNMENT_NOT_REVEALED');
            }
            signalReady();
          });
        } else if (sceneId.endsWith('-horizon') || sceneId.endsWith('-reflection')) {
          // Deterministic scene preparation, not a trusted-input gesture test.
          const horizon = root.querySelector('#feed-horizon');
          horizon.scrollIntoView({ block: 'center' });
          frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(() => {
              if (root.querySelector('.entropy-feed-app').dataset.frictionPhase !== 'horizon') {
                throw new Error('FEED_LANDING_CAPTURE_FRICTION_NOT_ACCUMULATED');
              }
              if (horizon.querySelector('button')) throw new Error('FEED_LANDING_CAPTURE_HORIZON_NOT_DECLARATIVE');
              if (sceneId.endsWith('-reflection')) {
                // The afterword follows the empty run below the Horizon without any choice.
                const afterword = root.querySelector('#feed-afterword');
                afterword.scrollIntoView({ block: 'start' });
                frame = requestAnimationFrame(() => {
                  if (afterword.querySelector('input[type=range]') || !afterword.querySelector('.feed-comparison .feed-media--sky') || !afterword.querySelector('a.feed-button-primary')) {
                    throw new Error('FEED_LANDING_CAPTURE_AFTERWORD_INCOMPLETE');
                  }
                  signalReady();
                });
              } else signalReady();
            });
          });
        } else signalReady();
      });
    });

    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [signalReady]);

  return <div ref={rootRef} data-feed-landing-qa><FeedLandingApp /></div>;
}

export default defineVisualSceneImplementation({
  Component: FeedLandingScene,
  prepare({ manifest }) { sceneId = manifest.id; },
});
