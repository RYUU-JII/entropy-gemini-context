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

const MOBILE_EXHALE_FRAME_MS = ROOM478_ARRIVAL_MS + 4_000 + 7_000 + 5_200;

function Room478MobileScene({ signalReady }) {
  const mountRef = useRef(null);
  const [error, setError] = useState(null);

  useLayoutEffect(() => {
    const mount = mountRef.current;
    if (!(mount instanceof HTMLElement)) {
      throw new Error('[VisualHarness] Room 478 mobile mount is unavailable.');
    }
    const copy = resolveRoom478HarnessCopy();
    const root = mountRoom478Surface(mount, copy);
    const bounds = root.getBoundingClientRect();
    const plan = resolveRoom478ScenePlan({
      handoff: ROOM478_HARNESS_HANDOFF,
      width: bounds.width,
      height: bounds.height,
    });
    applyRoom478Frame(
      resolveRoom478Surface(root),
      resolveRoom478Frame(MOBILE_EXHALE_FRAME_MS),
      plan,
      copy,
    );
    let active = true;
    decodeRoom478HarnessGarden([root]).then(() => {
      if (active) signalReady();
    }).catch(failure => { if (active) setError(failure); });
    return () => { active = false; releaseRoom478Arrival(root); };
  }, [signalReady]);

  if (error) throw error;

  return <main data-visual-capture="room478-mobile" ref={mountRef} />;
}

export default defineVisualSceneImplementation({
  Component: Room478MobileScene,
});
