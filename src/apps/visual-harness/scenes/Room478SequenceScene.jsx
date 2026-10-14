import React, { useLayoutEffect, useRef, useState } from 'react';
import { releaseRoom478Arrival } from '../../room-478/room478Arrival.js';

import {
  ROOM478_ARRIVAL_MS,
  applyRoom478Frame,
  resolveRoom478Frame,
  resolveRoom478ScenePlan,
} from '../../room-478/room478Experience.js';
import {
  mountRoom478Surface,
  resolveRoom478Surface,
} from '../../room-478/room478Template.js';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import {
  ROOM478_HARNESS_HANDOFF,
  resolveRoom478HarnessCopy,
  decodeRoom478HarnessGarden,
} from './room478HarnessFixture.js';
import '../../room-478/room478.css';
import './room478SequenceScene.css';

const ROOM478_HARNESS_STATES = Object.freeze([
  Object.freeze({ id: 'threshold', label: 'threshold / 0 ms', elapsedMs: 0 }),
  Object.freeze({ id: 'traverse', label: 'traverse / 35% arrival', elapsedMs: ROOM478_ARRIVAL_MS * 0.35 }),
  Object.freeze({ id: 'fold', label: 'contour fold / 68% arrival', elapsedMs: ROOM478_ARRIVAL_MS * 0.68 }),
  Object.freeze({ id: 'room-open', label: `room open / ${ROOM478_ARRIVAL_MS} ms`, elapsedMs: ROOM478_ARRIVAL_MS }),
  Object.freeze({ id: 'inhale', label: 'inhale / 50%', elapsedMs: ROOM478_ARRIVAL_MS + 2_000 }),
  Object.freeze({ id: 'hold', label: 'hold / 50%', elapsedMs: ROOM478_ARRIVAL_MS + 4_000 + 3_500 }),
  Object.freeze({ id: 'exhale', label: 'exhale / 50%', elapsedMs: ROOM478_ARRIVAL_MS + 4_000 + 7_000 + 4_000 }),
  Object.freeze({ id: 'still', label: 'unbounded stillness', elapsedMs: ROOM478_ARRIVAL_MS + 19_000 + 1_000 }),
]);

function Room478SequenceScene({ signalReady }) {
  const mountRefs = useRef([]);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    const copy = resolveRoom478HarnessCopy();
    const roots = [];
    let active = true;
    ROOM478_HARNESS_STATES.forEach((state, index) => {
      const mount = mountRefs.current[index];
      if (!(mount instanceof HTMLElement)) {
        throw new Error(`[VisualHarness] Room 478 mount ${state.id} is unavailable.`);
      }
      const root = mountRoom478Surface(mount, copy);
      roots.push(root);
      const bounds = root.getBoundingClientRect();
      const plan = resolveRoom478ScenePlan({
        handoff: ROOM478_HARNESS_HANDOFF,
        width: bounds.width,
        height: bounds.height,
      });
      applyRoom478Frame(
        resolveRoom478Surface(root),
        resolveRoom478Frame(state.elapsedMs),
        plan,
        copy,
      );
      root.setAttribute('data-room478-harness-state', state.id);
    });
    decodeRoom478HarnessGarden(roots).then(() => {
      if (active) signalReady();
    }).catch(failure => { if (active) setError(failure); });
    return () => {
      active = false;
      roots.forEach(releaseRoom478Arrival);
    };
  }, [signalReady]);

  if (error) throw error;

  return (
    <main
      className="visual-room478-sequence"
      data-visual-capture="room478-sequence"
    >
      <header className="visual-room478-sequence__header">
        <span>ROOM 478 / PRODUCTION OWNER</span>
        <p>rift continuity → one guided 4·7·8 breath → unbounded stillness</p>
      </header>
      <section className="visual-room478-sequence__grid">
        {ROOM478_HARNESS_STATES.map((state, index) => (
          <article className="visual-room478-panel" key={state.id}>
            <div
              className="visual-room478-panel__viewport"
              data-visual-capture={`room478-${state.id}`}
              ref={(node) => {
                mountRefs.current[index] = node;
              }}
            />
            <p>{state.label}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

export default defineVisualSceneImplementation({
  Component: Room478SequenceScene,
});
