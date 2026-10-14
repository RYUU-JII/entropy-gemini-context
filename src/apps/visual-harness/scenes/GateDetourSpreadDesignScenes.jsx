import React from 'react';
import { GateDetourSpreadDemo } from './GateDetourSpreadScene.jsx';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';

const SELECTION = Object.freeze([101, 102]);
function Selected({ signalReady }) {
  return <GateDetourSpreadDemo language="ko" autoSelectTabIds={SELECTION} signalReady={signalReady} />;
}
function Transfer({ signalReady }) {
  return <GateDetourSpreadDemo language="ko" autoSelectTabId={101} transferAtMs={360} signalReady={signalReady} />;
}
export const selected = defineVisualSceneImplementation({ Component: Selected });
export const transfer = defineVisualSceneImplementation({ Component: Transfer });
function FirstUse({ signalReady }) {
  return <GateDetourSpreadDemo language="ko" tutorialCompleted={false} signalReady={signalReady} />;
}
function FirstUseReady({ signalReady }) {
  return <GateDetourSpreadDemo language="ko" tutorialCompleted={false} autoSelectTabIds={SELECTION} signalReady={signalReady} />;
}
export const firstUse = defineVisualSceneImplementation({ Component: FirstUse });
export const firstUseReady = defineVisualSceneImplementation({ Component: FirstUseReady });
