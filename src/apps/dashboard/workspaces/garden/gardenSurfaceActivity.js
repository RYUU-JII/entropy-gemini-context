// Activity is independent from the retained canvas/channel lifetime. The
// existing Home Worker session remains the sole physical execution owner.
export function resolveGardenSurfaceActivity({
  workspaceActive,
  pondPresented,
  bonsaiPresented,
} = {}) {
  for (const [name, value] of Object.entries({ workspaceActive, pondPresented, bonsaiPresented })) {
    if (typeof value !== 'boolean') {
      throw new Error(`GARDEN_SURFACE_ACTIVITY_BOOLEAN_REQUIRED:${name}`);
    }
  }
  const pondActive = workspaceActive && pondPresented;
  const bonsaiActive = workspaceActive && bonsaiPresented;
  return Object.freeze({
    workspaceActive,
    pondActive,
    bonsaiActive,
    compositeActive: pondActive && bonsaiActive,
  });
}
