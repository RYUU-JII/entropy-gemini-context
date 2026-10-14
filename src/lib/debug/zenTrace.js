export const isZenTraceEnabled = () => false;

export const setZenTraceEnabled = () => false;

export const getZenTraceHistory = () => [];

export const clearZenTraceHistory = () => {};

export const emitZenTrace = () => null;

export const startZenTraceSpan = () => () => {};

export const dumpZenTraceHistory = () => '[]';

export const copyZenTraceHistory = async () => {
  throw new Error('ZEN_TRACE_DISABLED_IN_BUILD');
};

export const startZenTraceReload = () => false;
