import {
  isGlobalNudgeProtocolScene,
} from '../protocols/nudgeProtocolScene.js';
import {
  GLOBAL_SENTINEL_GAME_PHASES,
  isGlobalSentinelTerminalGamePhase,
} from './nudgeGameGlobalSentinelProtocol.js';
import {
  SITE_FURIN_PROTOCOL_SYSTEM,
} from './nudgeGameSiteFurinProtocol.js';
import {
  NUDGE_SCENE_PHASES,
  assertNudgeScenePhase,
} from './nudgeGameScene.js';

export const NUDGE_ENGINE_CLOCK_MODES = Object.freeze({
  ACTIVE: 'active',
  FROZEN: 'frozen',
});

export const NUDGE_ENGINE_SPAWN_MODES = Object.freeze({
  INITIAL_ONLY: 'initial_only',
  STARTER_ONLY: 'starter_only',
  CADENCE: 'cadence',
  REPAIR_BEAT: 'repair_beat',
  NONE: 'none',
});

export const NUDGE_ENGINE_SPLIT_MODES = Object.freeze({
  ENABLED: 'enabled',
  NONE: 'none',
});

export const NUDGE_ENGINE_INPUT_MODES = Object.freeze({
  STARTER: 'starter',
  VULNERABLE_ENTITIES: 'vulnerable_entities',
  SITE_GUIDANCE: 'site_guidance',
  NONE: 'none',
});

export const NUDGE_ENGINE_ENTITY_MODES = Object.freeze({
  ACTIVE: 'active',
  HOLD: 'hold',
});

export const NUDGE_ENGINE_RENDER_MODES = Object.freeze({
  AWAITING_START: 'awaiting_start',
  RITUAL: 'ritual',
  REFLECTION: 'reflection',
  TERMINAL: 'terminal',
  RIFT: 'rift',
});

const TERMINAL_SCENE_PHASES = new Set([
  NUDGE_SCENE_PHASES.BANISH,
  NUDGE_SCENE_PHASES.RESYNCING,
  NUDGE_SCENE_PHASES.COLLAPSE,
  NUDGE_SCENE_PHASES.RESYNC,
  NUDGE_SCENE_PHASES.ESCAPE,
]);

function assertProtocolScene(protocolScene) {
  if (!protocolScene || typeof protocolScene !== 'object') {
    throw new Error('nudge_engine_control_protocol_scene_missing');
  }
  if (typeof protocolScene.protocolSystem !== 'string' || !protocolScene.protocolSystem.trim()) {
    throw new Error('nudge_engine_control_protocol_system_missing');
  }
  return protocolScene;
}

function resolveGlobalGamePhase(protocolProgress = null) {
  const gamePhase = typeof protocolProgress?.gamePhase === 'string'
    ? protocolProgress.gamePhase.trim()
    : '';
  if (!gamePhase) throw new Error('nudge_engine_control_global_game_phase_missing');
  return gamePhase;
}

function freezeControl({
  scenePhase,
  renderMode,
  blockReason,
}) {
  return {
    scenePhase,
    clockMode: NUDGE_ENGINE_CLOCK_MODES.FROZEN,
    spawnMode: NUDGE_ENGINE_SPAWN_MODES.NONE,
    splitMode: NUDGE_ENGINE_SPLIT_MODES.NONE,
    inputMode: NUDGE_ENGINE_INPUT_MODES.NONE,
    entityMode: NUDGE_ENGINE_ENTITY_MODES.HOLD,
    renderMode,
    blockReason,
  };
}

export function resolveNudgeEngineControl({
  scenePhase,
  protocolScene,
  protocolProgress = null,
  modalOpen = false,
  terminalSequence = null,
  globalEntryRevealActive = false,
} = {}) {
  const phase = assertNudgeScenePhase(scenePhase, 'nudge_engine_control_scene_phase');
  const scene = assertProtocolScene(protocolScene);

  if (modalOpen === true) {
    return freezeControl({
      scenePhase: phase,
      renderMode: NUDGE_ENGINE_RENDER_MODES.TERMINAL,
      blockReason: 'modal_open',
    });
  }

  if (terminalSequence) {
    return freezeControl({
      scenePhase: phase,
      renderMode: NUDGE_ENGINE_RENDER_MODES.TERMINAL,
      blockReason: 'terminal_sequence',
    });
  }

  if (phase === NUDGE_SCENE_PHASES.RIFT) {
    return freezeControl({
      scenePhase: phase,
      renderMode: NUDGE_ENGINE_RENDER_MODES.RIFT,
      blockReason: 'scene:rift',
    });
  }

  if (TERMINAL_SCENE_PHASES.has(phase)) {
    return freezeControl({
      scenePhase: phase,
      renderMode: NUDGE_ENGINE_RENDER_MODES.TERMINAL,
      blockReason: `scene:${phase}`,
    });
  }

  if (phase === NUDGE_SCENE_PHASES.REFLECTION) {
    return freezeControl({
      scenePhase: phase,
      renderMode: NUDGE_ENGINE_RENDER_MODES.REFLECTION,
      blockReason: 'scene:reflection',
    });
  }

  if (phase !== NUDGE_SCENE_PHASES.RITUAL) {
    throw new Error(`nudge_engine_control_unhandled_scene_phase:${phase}`);
  }

  if (isGlobalNudgeProtocolScene(scene)) {
    const gamePhase = resolveGlobalGamePhase(protocolProgress);
    if (gamePhase === GLOBAL_SENTINEL_GAME_PHASES.AWAITING_START) {
      return {
        scenePhase: phase,
        clockMode: NUDGE_ENGINE_CLOCK_MODES.ACTIVE,
        spawnMode: NUDGE_ENGINE_SPAWN_MODES.STARTER_ONLY,
        splitMode: NUDGE_ENGINE_SPLIT_MODES.NONE,
        inputMode: NUDGE_ENGINE_INPUT_MODES.STARTER,
        entityMode: NUDGE_ENGINE_ENTITY_MODES.ACTIVE,
        renderMode: NUDGE_ENGINE_RENDER_MODES.AWAITING_START,
        blockReason: 'awaiting_start',
      };
    }
    if (isGlobalSentinelTerminalGamePhase(gamePhase)) {
      return freezeControl({
        scenePhase: phase,
        renderMode: NUDGE_ENGINE_RENDER_MODES.TERMINAL,
        blockReason: `protocol:${gamePhase}`,
      });
    }
    if (gamePhase !== GLOBAL_SENTINEL_GAME_PHASES.REPAIR_RACE) {
      throw new Error(`nudge_engine_control_global_game_phase_unhandled:${gamePhase}`);
    }
    if (globalEntryRevealActive) {
      return {
        ...freezeControl({ scenePhase: phase, renderMode: NUDGE_ENGINE_RENDER_MODES.RITUAL, blockReason: 'entry_recovery' }),
        clockMode: NUDGE_ENGINE_CLOCK_MODES.ACTIVE,
      };
    }
    return {
      scenePhase: phase,
      clockMode: NUDGE_ENGINE_CLOCK_MODES.ACTIVE,
      spawnMode: NUDGE_ENGINE_SPAWN_MODES.REPAIR_BEAT,
      splitMode: NUDGE_ENGINE_SPLIT_MODES.NONE,
      inputMode: NUDGE_ENGINE_INPUT_MODES.VULNERABLE_ENTITIES,
      entityMode: NUDGE_ENGINE_ENTITY_MODES.ACTIVE,
      renderMode: NUDGE_ENGINE_RENDER_MODES.RITUAL,
      blockReason: '',
    };
  }

  if (scene.protocolSystem === SITE_FURIN_PROTOCOL_SYSTEM) {
    return freezeControl({ scenePhase: phase, renderMode: NUDGE_ENGINE_RENDER_MODES.RITUAL, blockReason: 'site_furin_dom_owned' });
  }

  throw new Error(`nudge_engine_control_protocol_system_unhandled:${scene.protocolSystem}`);
}
