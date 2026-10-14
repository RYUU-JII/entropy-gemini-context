const ASSET_ROOT = 'assets';

export const FRICTION_ASSET_PATHS = {
  nudge: {
    gif: '',
    fallbackGif: '',
    audio: '',
  },
  gatekeeper: {
    staticLoop: '',
  },
  effects: {
    burstImpact: '',
  },
};

export const SHARED_SOUND_PATHS = {
  uiClickPrimary: `${ASSET_ROOT}/shared/sounds/ui-click-primary.mp3`,
  uiClickSoft: `${ASSET_ROOT}/shared/sounds/ui-click-soft.mp3`,
  uiNavigate: `${ASSET_ROOT}/shared/sounds/ui-navigate.mp3`,
};

export function normalizeAssetPath(path) {
  if (!path) return '';
  return path;
}
