import React from 'react';
import { defineVisualSceneImplementation } from '../visualSceneContract.js';
import ZenEnsoE02Lab from '../../../../scripts/dev/zen-enso-research/e02/ZenEnsoE02Lab.jsx';
function ZenEnsoE02Scene({ signalReady }) { return <ZenEnsoE02Lab automated onReady={signalReady} />; }
export default defineVisualSceneImplementation({ Component: ZenEnsoE02Scene });
