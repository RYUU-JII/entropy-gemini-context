import React, { useLayoutEffect, useRef } from 'react';
import FeedLandingApp from '../../feed-landing/FeedLandingApp.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

let sceneId;
function ShortFormScene({ signalReady }) {
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    let frame = 0;
    let canceled = false;
    const later = (callback) => { frame = requestAnimationFrame(() => { frame = requestAnimationFrame(() => { frame = requestAnimationFrame(callback); }); }); };
    const afterInitialMediaReady = (callback) => {
      const video = rootRef.current.querySelector('[data-active=true] video');
      const check = () => {
        if (canceled) return;
        if (video.readyState >= 2 && video.networkState !== 2) {
          video.removeEventListener('loadeddata', check);
          video.removeEventListener('progress', check);
          video.removeEventListener('suspend', check);
          callback();
        }
      };
      video.addEventListener('loadeddata', check);
      video.addEventListener('progress', check);
      video.addEventListener('suspend', check);
      check();
    };
    const finish = () => {
      const root = rootRef.current;
      const viewport = root.querySelector('.short-viewport');
      const surface = viewport.querySelector('[data-active=true] .short-surface');
      const video = surface.querySelector('video');
      const ready = () => {
        if (canceled) return;
        if (!video.videoWidth) throw new Error('SHORT_FORM_CAPTURE_VIDEO_NOT_DECODED');
        if ([...viewport.querySelectorAll('[data-active=false] video')].some((inactive) => !inactive.paused)) throw new Error('SHORT_FORM_CAPTURE_INACTIVE_VIDEO_PLAYING');
        if (sceneId.endsWith('-desktop') && video.currentTime < 0.05) {
          video.addEventListener('timeupdate', ready, { once: true });
          return;
        }
        if (sceneId.endsWith('-desktop') && video.paused) throw new Error('SHORT_FORM_CAPTURE_AUTOPLAY_NOT_RUNNING');
        const bounds = surface.getBoundingClientRect();
        if (bounds.left < 0 || bounds.right > innerWidth + 1 || bounds.top < 0 || bounds.bottom > innerHeight + 1 || document.documentElement.scrollWidth > innerWidth + 1) throw new Error('SHORT_FORM_CAPTURE_SURFACE_CLIPPED');
        if (sceneId.endsWith('-dulled') && root.querySelector('[data-view]').dataset.frictionPhase !== 'friction') throw new Error('SHORT_FORM_CAPTURE_REVERSAL_LOST_FRICTION');
        signalReady();
      };
      if (video.readyState >= 2) ready(); else video.addEventListener('loadeddata', ready, { once: true });
    };
    later(() => {
      const entry = [...rootRef.current.querySelectorAll('.feed-nav-links button')].find((button) => button.textContent.trim() === '숏폼');
      entry.click();
      later(() => {
        const viewport = rootRef.current.querySelector('.short-viewport');
        if (sceneId.endsWith('-ending')) {
          // Deterministic preparation of the declarative endpoint; no choice is offered there.
          viewport.scrollTo({ top: viewport.clientHeight * 12, behavior: 'auto' });
          later(() => {
            const terminus = viewport.querySelector('.short-terminus[data-active=true]');
            if (!terminus || terminus.querySelector('#feed-horizon button') || !terminus.querySelector('#feed-afterword .feed-comparison img')) {
              throw new Error('SHORT_FORM_CAPTURE_ENDING_INCOMPLETE');
            }
            if (rootRef.current.querySelector('[data-view]').dataset.frictionPhase !== 'horizon') throw new Error('SHORT_FORM_CAPTURE_FRICTION_NOT_ACCUMULATED');
            signalReady();
          });
          return;
        }
        afterInitialMediaReady(() => {
          if (sceneId.endsWith('-dulled')) {
            viewport.scrollTo({ top: viewport.clientHeight * 10, behavior: 'auto' });
            later(() => { viewport.scrollTo({ top: 0, behavior: 'auto' }); later(finish); });
          } else if (sceneId.endsWith('-clip')) {
            viewport.scrollTo({ top: viewport.clientHeight, behavior: 'auto' });
            later(finish);
          } else finish();
        });
      });
    });
    return () => { canceled = true; cancelAnimationFrame(frame); };
  }, [signalReady]);
  return <div ref={rootRef}><FeedLandingApp /></div>;
}
export default defineVisualSceneImplementation({ Component: ShortFormScene, prepare({ manifest }) { sceneId = manifest.id; } });
