const normalizeMessageType = (value) => (
  typeof value === 'string' ? value : ''
);

export const createZenPondWorkerCommandRouter = ({
  handlers = {},
  onUnknownType = null,
} = {}) => {
  const table = new Map();
  const types = Object.keys(handlers);
  for (let i = 0; i < types.length; i += 1) {
    const type = types[i];
    const handler = handlers[type];
    if (typeof handler === 'function') {
      table.set(type, handler);
    }
  }

  const run = async ({ type, id = null, payload = null, event = null } = {}) => {
    const resolvedType = normalizeMessageType(type);
    const handler = table.get(resolvedType);
    if (!handler) {
      if (typeof onUnknownType === 'function') {
        await onUnknownType({
          type: resolvedType,
          id,
          payload,
          event,
        });
      }
      return false;
    }

    await handler({
      type: resolvedType,
      id,
      payload,
      event,
    });
    return true;
  };

  return Object.freeze({
    run,
    has: (type) => table.has(normalizeMessageType(type)),
  });
};
