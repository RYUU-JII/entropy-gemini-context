import React from 'react';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import ZenEnsoE03Lab from '../../../../scripts/dev/zen-enso-research/e03/ZenEnsoE03Lab.jsx';
function ZenEnsoE03Scene({ signalReady }) { return <ZenEnsoE03Lab automated onReady={signalReady} />; }
export default defineVisualSceneImplementation({ Component: ZenEnsoE03Scene });
