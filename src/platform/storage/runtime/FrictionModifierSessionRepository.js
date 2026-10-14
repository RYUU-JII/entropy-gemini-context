import RuntimeSessionRepository, { STORAGE_SESSION_KEYS } from './RuntimeSessionRepository.js';
import {
  DEFAULT_FRICTION_MODIFIER_SESSION_STATE,
  buildFrictionModifierSessionState,
  normalizeFrictionModifierSessionState,
  selectFrictionModifiersForHostname,
} from '../../../domains/protection/runtime/frictionModifierSessionState.js';
import { normalizeFrictionModifierIntent } from '../../../domains/protection/runtime/frictionModifierResolver.js';

export const FRICTION_MODIFIER_SESSION_STORAGE_KEY = STORAGE_SESSION_KEYS.FRICTION_MODIFIERS;

export class FrictionModifierSessionRepository {
  constructor({ runtimeSessionRepository = RuntimeSessionRepository.getInstance() } = {}) {
    this.runtimeSessionRepository = runtimeSessionRepository;
  }

  static getInstance() {
    if (!FrictionModifierSessionRepository.instance) {
      FrictionModifierSessionRepository.instance = new FrictionModifierSessionRepository();
    }
    return FrictionModifierSessionRepository.instance;
  }

  async readState({ now = Date.now() } = {}) {
    const items = await this.runtimeSessionRepository.get({
      [FRICTION_MODIFIER_SESSION_STORAGE_KEY]: DEFAULT_FRICTION_MODIFIER_SESSION_STATE,
    });
    return normalizeFrictionModifierSessionState(items[FRICTION_MODIFIER_SESSION_STORAGE_KEY], { now });
  }

  async writeState(nextState, { now = Date.now() } = {}) {
    const normalized = normalizeFrictionModifierSessionState(nextState, { now });
    await this.runtimeSessionRepository.set({
      [FRICTION_MODIFIER_SESSION_STORAGE_KEY]: normalized,
    });
    return normalizeFrictionModifierSessionState(normalized, { now });
  }

  async replaceModifiers(modifiers = [], { now = Date.now() } = {}) {
    const nextState = buildFrictionModifierSessionState(modifiers, { now });
    await this.runtimeSessionRepository.set({
      [FRICTION_MODIFIER_SESSION_STORAGE_KEY]: nextState,
    });
    return normalizeFrictionModifierSessionState(nextState, { now });
  }

  async upsertModifier(modifier, { now = Date.now() } = {}) {
    const normalizedModifier = normalizeFrictionModifierIntent(modifier);
    const currentState = await this.readState({ now });
    const nextState = {
      ...currentState,
      modifiersById: {
        ...currentState.modifiersById,
        [normalizedModifier.id]: normalizedModifier,
      },
    };
    return this.writeState(nextState, { now });
  }

  async removeModifier(modifierId, { now = Date.now() } = {}) {
    const normalizedId = typeof modifierId === 'string' ? modifierId.trim() : '';
    if (!normalizedId) {
      throw new Error('FRICTION_MODIFIER_ID_REQUIRED');
    }
    const currentState = await this.readState({ now });
    const nextModifiers = { ...currentState.modifiersById };
    delete nextModifiers[normalizedId];
    return this.writeState({
      ...currentState,
      modifiersById: nextModifiers,
    }, { now });
  }

  async clear() {
    await this.runtimeSessionRepository.remove(FRICTION_MODIFIER_SESSION_STORAGE_KEY);
  }

  async getActiveModifiersForHostname(hostname, { now = Date.now() } = {}) {
    const state = await this.readState({ now });
    return selectFrictionModifiersForHostname(state, hostname, { now });
  }
}

export default FrictionModifierSessionRepository;
