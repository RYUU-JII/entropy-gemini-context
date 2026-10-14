import { MAIN_PRESENTATION_PHASES, MAIN_PRESENTATION_SCENE_KINDS } from '../../../themes/core/presentation/mainSceneContract.js';

export function isBonsaiFirstBloomReady({
  homePresented, bootShellDismissed, exactBonsaiFrameCurrent,
  decision, interactionLocked, overlayActive, registrationOpen,
}) {
  return homePresented === true
    && bootShellDismissed === true
    && exactBonsaiFrameCurrent === true
    && decision?.kind === MAIN_PRESENTATION_SCENE_KINDS.CURRENT
    && decision?.renderTarget?.kind === MAIN_PRESENTATION_SCENE_KINDS.CURRENT
    && decision?.phase === MAIN_PRESENTATION_PHASES.SETTLED
    && interactionLocked === false
    && overlayActive === false
    && registrationOpen === false;
}
