export {
  SPIKE_PROTOCOL_VERSION,
  SPIKE_REASON_CODE,
  SPIKE_SIGNAL_SOURCE,
  SPIKE_SIGNAL_TYPE,
  normalizeSpikeSignal,
  normalizeSpikeSignals,
} from './SpikeSignalSchema.js';

export {
  SPIKE_PROTOCOL_MODE,
  SPIKE_PROTOCOL_SUGGESTION,
  buildSpikeProtocolSnapshot,
  createNoSpikeProtocolSnapshot,
} from './SpikeProtocolEngine.js';
