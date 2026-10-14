import React from 'react';
import FurinControlFeedback, { FurinTemporaryPauseControl } from '../components/FurinControlFeedback.jsx';
import { requireFurinTimeAvailability } from '../../../utils/furinTimeAvailability.js';
import {
  buildArtifactControlSurface, buildArtifactDockModel, buildArtifactStatusBlockModel,
  getArtifactFamilyChildren, getArtifactFamilyHandlers, getArtifactFamilyState, resolveArtifactChildConfiguredEnabled,
  resolveArtifactChildDescription, resolveArtifactChildTitle,
} from './shared.jsx';

export function buildSentinelFlareCard({ shell, t, state, handlers }) {
  const flareFamily = getArtifactFamilyState(state, 'flare');
  const flareHandlers = getArtifactFamilyHandlers(handlers, 'flare');
  const sentinelFlareFamily = getArtifactFamilyChildren(state, 'flare').sentinelFlare;
  const timeAvailability = requireFurinTimeAvailability(sentinelFlareFamily.timeAvailability);
  const configuredEnabled = resolveArtifactChildConfiguredEnabled(state, 'flare', 'sentinelFlare');
  return {
    controlSurface: buildArtifactControlSurface({
      dock: buildArtifactDockModel({ blocks: [buildArtifactStatusBlockModel({ status: {
        text: resolveArtifactChildTitle(t, 'flare', 'sentinelFlare'),
        detail: <>
          <p>{resolveArtifactChildDescription(t, 'flare', 'sentinelFlare')}</p>
          <FurinControlFeedback enabled={configuredEnabled} goalEnds={sentinelFlareFamily.goalEnds}
            paused={flareFamily.suspended === true || flareFamily.globallyPaused === true}
            timeAvailability={timeAvailability} applicationStatus={shell.applicationStatus} handlers={handlers} />
          <FurinTemporaryPauseControl enabled={configuredEnabled} suspended={flareFamily.suspended === true}
            globallyPaused={flareFamily.globallyPaused === true} setSuspended={flareHandlers.setSuspended} />
        </>,
      } })] }),
    }),
  };
}
