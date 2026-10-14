import {
  getRuntimeLanguage,
  tRuntime,
} from '../../domains/settings/i18n/runtime.js';
import {
  createRoom478Experience,
  parseRoom478Handoff,
} from './room478Experience.js';
import { createRoom478AudioController } from './room478Audio.js';
import { mountRoom478Surface } from './room478Template.js';

const ROOM478_COPY_PREFIX = 'tools:sentinel_flare_protocol';
const ROOM478_DEPARTURE_MS = 1_400;

function translateRoom478(key) {
  return tRuntime(`${ROOM478_COPY_PREFIX}.${key}`);
}

function resolveRoom478Copy() {
  return Object.freeze({
    breathingLabel: translateRoom478('room_478_breathing_label'),
    departureNotice: translateRoom478('room_478_departure_notice'),
    exit: translateRoom478('room_478_exit'),
    groundingHint: translateRoom478('room_478_grounding_hint'),
    groundingTouchHint: translateRoom478('room_478_grounding_touch_hint'),
    return: translateRoom478('room_478_return'),
    repeat: translateRoom478('room_478_repeat'),
    phases: Object.freeze({
      arrival: translateRoom478('room_478_phase_arrival'),
      grounding: translateRoom478('room_478_phase_grounding'),
      inhale: translateRoom478('room_478_phase_inhale'),
      hold: translateRoom478('room_478_phase_hold'),
      exhale: translateRoom478('room_478_phase_exhale'),
      still: translateRoom478('room_478_phase_still'),
    }),
    statuses: Object.freeze({
      arrival: translateRoom478('room_478_status_arrival'),
      grounding: translateRoom478('room_478_status_grounding'),
      inhale: translateRoom478('room_478_status_inhale'),
      hold: translateRoom478('room_478_status_hold'),
      exhale: translateRoom478('room_478_status_exhale'),
      still: translateRoom478('room_478_status_still'),
    }),
  });
}

function reportRoom478NavigationFailure(phase, error) {
  console.warn('[Room 478] navigation failed', {
    code: `room_478_navigation_${phase}_failed`,
    error: String(error?.message || error || 'navigation_failed'),
  });
}

function resolveDashboardUrl() {
  try {
    const runtimeGetURL = globalThis.chrome?.runtime?.getURL;
    if (typeof runtimeGetURL === 'function') {
      return runtimeGetURL('src/pages/dashboard.html');
    }
  } catch (error) {
    reportRoom478NavigationFailure('dashboard_url', error);
  }
  return 'dashboard.html';
}

function navigateOutOfRoom() {
  try {
    if ((globalThis.history?.length || 0) > 1) {
      globalThis.history.back();
      return;
    }
  } catch (error) {
    reportRoom478NavigationFailure('history_back', error);
  }

  try {
    globalThis.close();
  } catch (error) {
    reportRoom478NavigationFailure('window_close', error);
  }

  globalThis.setTimeout(() => {
    try {
      globalThis.location.assign(resolveDashboardUrl());
    } catch (error) {
      reportRoom478NavigationFailure('dashboard_assign', error);
    }
  }, 120);
}

function renderRoom478StartupFailure(container, error) {
  const code = String(error?.message || 'room_478_startup_failed');
  console.error('[Room 478] canonical startup contract failed.', error);
  container.innerHTML = `
    <main class="room-478 room-478--error" data-room478-startup-error="${code}">
      <p>ROOM 478 / ${code}</p>
    </main>
  `;
}

function startRoom478() {
  const container = document.querySelector('#room478App');
  if (!(container instanceof HTMLElement)) {
    throw new Error('room_478_app_container_missing');
  }

  const language = getRuntimeLanguage();
  document.documentElement.lang = language;
  document.title = translateRoom478('room_478_page_title');

  try {
    const copy = resolveRoom478Copy();
    const handoff = parseRoom478Handoff(globalThis.location.search);
    const root = mountRoom478Surface(container, copy);
    const audioController = createRoom478AudioController();
    const experience = createRoom478Experience({
      audioController,
      copy,
      handoff,
      root,
    });
    const exitButton = root.querySelector('[data-room478-exit]');
    let departureStarted = false;

    function leaveRoom() {
      if (departureStarted) return;
      departureStarted = true;
      root.dataset.stage = 'departing';
      experience.pause();
      audioController.playDepartureSeal();
      globalThis.setTimeout(navigateOutOfRoom, ROOM478_DEPARTURE_MS);
    }

    function handleKeydown(event) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      leaveRoom();
    }

    exitButton.addEventListener('click', leaveRoom);
    root.querySelector('[data-room478-repeat]').addEventListener('click', () => {
      if (!departureStarted) experience.repeatBreath();
    });
    globalThis.addEventListener('keydown', handleKeydown);
    globalThis.addEventListener('pagehide', experience.pause);
    globalThis.addEventListener('pageshow', experience.resume);
    globalThis.addEventListener('beforeunload', experience.destroy, { once: true });
    experience.start();
  } catch (error) {
    renderRoom478StartupFailure(container, error);
  }
}

startRoom478();
