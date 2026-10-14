const requireProfileGeneration = (value) => {
  if (
    typeof value !== 'string'
    || !value.trim()
    || value.trim() !== value
  ) {
    throw new Error('ZEN_THEME_PROFILE_GENERATION_REQUIRED');
  }
  return value;
};

const createClosedLeaseError = (cause = null) => {
  if (cause instanceof Error) return cause;
  return new Error('ZEN_THEME_PROFILE_GENERATION_LEASE_CLOSED');
};

export const requireZenThemeProfileGenerationLease = (lease) => {
  if (
    !lease
    || typeof lease.requireCurrent !== 'function'
    || typeof lease.close !== 'function'
    || !lease.ready
    || typeof lease.ready.then !== 'function'
  ) {
    throw new Error('ZEN_THEME_PROFILE_GENERATION_LEASE_REQUIRED');
  }
  return lease;
};

export const createPinnedZenThemeProfileGenerationLease = ({
  profileGeneration,
} = {}) => {
  const pinnedProfileGeneration = requireProfileGeneration(profileGeneration);
  let closed = false;
  let closeError = null;
  const ready = Promise.resolve(pinnedProfileGeneration);

  return Object.freeze({
    ready,
    async requireCurrent() {
      if (closed) throw createClosedLeaseError(closeError);
      return pinnedProfileGeneration;
    },
    close(error = null) {
      const reused = closed;
      closed = true;
      closeError ||= error instanceof Error ? error : null;
      return Object.freeze({ closed: true, reused });
    },
  });
};

export { requireProfileGeneration as requireZenThemeProfileGeneration };
