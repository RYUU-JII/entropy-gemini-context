export const createZenInvitationSlotState = () => ({ slots: [], nextSequence: 1 });

// Stable membership belongs to the retained Home presentation. The progression
// receipt remembers admitted capacity across document lifetimes, not fish UIDs.
export function reconcileZenInvitationSlotState(state, { journey, identity }) {
  if (journey.contract !== 'site_registration_journey_v1'
      || typeof identity !== 'string' || !identity) throw new Error('ZEN_INVITATION_SLOT_PROJECTION_INVALID');
  const target = journey.invitationCount;
  if (target === state.slots.length) return state;
  const slots = state.slots.slice(0, target);
  let nextSequence = state.nextSequence;
  while (slots.length < target) {
    const ordinal = journey.mode === 'unlimited' ? 5 : journey.protectedSiteCount + slots.length + 1;
    const initialEmptyGarden = journey.protectedSiteCount === 0 && nextSequence === 1;
    slots.push({ entityId: `zen_invitation_koi:${identity}:${nextSequence++}`,
      arrivalMode: initialEmptyGarden || ordinal <= journey.admittedInvitationCapacity ? 'resident' : 'bank' });
  }
  return { slots, nextSequence };
}

export function consumeZenInvitationSlot(state, { entityId }) {
  if (!state.slots.some(slot => slot.entityId === entityId)) throw new Error('ZEN_INVITATION_ASSIGNMENT_SLOT_MISSING');
  return { ...state, slots: state.slots.filter(slot => slot.entityId !== entityId) };
}
