import {
  AUDIO_DULLING_DRY_RESOLUTION_PLAN,
  createAudioDullingResolutionPlan,
} from '../../domains/protection/audioDulling/audioDullingResolutionPlan.js';

function safeDisconnect(node) {
  try {
    node?.disconnect?.();
  } catch (_error) {
    // Disconnect is idempotent cleanup for a graph that may already be closed.
  }
}

function setAudioParamImmediately(param, value, now) {
  if (!param) return;
  param.cancelScheduledValues?.(now);
  param.setValueAtTime?.(value, now);
  if (typeof param.setValueAtTime !== 'function') {
    param.value = value;
  }
}

function rampAudioParam(param, value, {
  now,
  rampSeconds,
}) {
  if (!param) return;
  if (rampSeconds <= 0) {
    setAudioParamImmediately(param, value, now);
    return;
  }
  if (typeof param.cancelAndHoldAtTime === 'function') {
    param.cancelAndHoldAtTime(now);
  } else {
    const currentValue = Number(param.value);
    param.cancelScheduledValues?.(now);
    if (Number.isFinite(currentValue)) {
      param.setValueAtTime?.(currentValue, now);
    }
  }
  if (typeof param.linearRampToValueAtTime === 'function') {
    param.linearRampToValueAtTime(value, now + rampSeconds);
    return;
  }
  param.value = value;
}

function createBiquad(audioContext, type) {
  const node = audioContext.createBiquadFilter();
  node.type = type;
  return node;
}

function createSpatialResolutionStage(audioContext) {
  const splitter = audioContext.createChannelSplitter(2);
  const merger = audioContext.createChannelMerger(2);
  const leftDirect = audioContext.createGain();
  const leftCross = audioContext.createGain();
  const rightDirect = audioContext.createGain();
  const rightCross = audioContext.createGain();

  splitter.connect(leftDirect, 0);
  splitter.connect(rightCross, 0);
  splitter.connect(rightDirect, 1);
  splitter.connect(leftCross, 1);
  leftDirect.connect(merger, 0, 0);
  leftCross.connect(merger, 0, 0);
  rightDirect.connect(merger, 0, 1);
  rightCross.connect(merger, 0, 1);

  return Object.freeze({
    input: splitter,
    output: merger,
    nodes: Object.freeze([
      splitter,
      leftDirect,
      leftCross,
      rightDirect,
      rightCross,
      merger,
    ]),
    params: Object.freeze({
      direct: Object.freeze([leftDirect.gain, rightDirect.gain]),
      cross: Object.freeze([leftCross.gain, rightCross.gain]),
    }),
  });
}

function applyResolutionPlan(graph, plan, {
  rampMs = plan.rampMs,
} = {}) {
  const now = Number(graph.audioContext.currentTime) || 0;
  const rampSeconds = Math.max(0, Number(rampMs) || 0) / 1000;
  const rampOptions = { now, rampSeconds };
  const { params } = graph;

  rampAudioParam(params.highpassFrequency, plan.spectral.highpassHz, rampOptions);
  rampAudioParam(params.lowpassFrequency, plan.spectral.lowpassHz, rampOptions);
  rampAudioParam(params.highShelfFrequency, plan.spectral.highShelfFrequencyHz, rampOptions);
  rampAudioParam(params.highShelfGain, plan.spectral.highShelfGainDb, rampOptions);
  rampAudioParam(params.compressorThreshold, plan.dynamics.thresholdDb, rampOptions);
  rampAudioParam(params.compressorKnee, plan.dynamics.kneeDb, rampOptions);
  rampAudioParam(params.compressorRatio, plan.dynamics.ratio, rampOptions);
  rampAudioParam(params.compressorAttack, plan.dynamics.attackSeconds, rampOptions);
  rampAudioParam(params.compressorRelease, plan.dynamics.releaseSeconds, rampOptions);
  params.spatialDirect.forEach((param) => (
    rampAudioParam(param, plan.spatial.directChannelGain, rampOptions)
  ));
  params.spatialCross.forEach((param) => (
    rampAudioParam(param, plan.spatial.crossChannelGain, rampOptions)
  ));
  rampAudioParam(params.masterGain, plan.output.masterGain, rampOptions);
  graph.plan = plan;
  return plan;
}

export function createAudioDullingGraph({
  audioContext,
  source,
  config = null,
}) {
  if (!audioContext || !source) {
    throw new Error('AUDIO_DULLING_GRAPH_INPUT_REQUIRED');
  }
  const highpass = createBiquad(audioContext, 'highpass');
  const lowpass = createBiquad(audioContext, 'lowpass');
  const highShelf = createBiquad(audioContext, 'highshelf');
  const compressor = audioContext.createDynamicsCompressor();
  const spatial = createSpatialResolutionStage(audioContext);
  const master = audioContext.createGain();

  source.connect(highpass);
  highpass.connect(lowpass);
  lowpass.connect(highShelf);
  highShelf.connect(compressor);
  compressor.connect(spatial.input);
  spatial.output.connect(master);
  master.connect(audioContext.destination);

  const graph = {
    audioContext,
    source,
    nodes: [
      highpass,
      lowpass,
      highShelf,
      compressor,
      ...spatial.nodes,
      master,
    ],
    params: {
      highpassFrequency: highpass.frequency,
      lowpassFrequency: lowpass.frequency,
      highShelfFrequency: highShelf.frequency,
      highShelfGain: highShelf.gain,
      compressorThreshold: compressor.threshold,
      compressorKnee: compressor.knee,
      compressorRatio: compressor.ratio,
      compressorAttack: compressor.attack,
      compressorRelease: compressor.release,
      spatialDirect: spatial.params.direct,
      spatialCross: spatial.params.cross,
      masterGain: master.gain,
    },
    plan: AUDIO_DULLING_DRY_RESOLUTION_PLAN,
  };

  applyResolutionPlan(graph, AUDIO_DULLING_DRY_RESOLUTION_PLAN, { rampMs: 0 });
  applyResolutionPlan(graph, createAudioDullingResolutionPlan(config));
  return graph;
}

export function updateAudioDullingGraph(graph, config = null) {
  if (!graph || typeof graph !== 'object' || !graph.params) {
    throw new Error('AUDIO_DULLING_GRAPH_REQUIRED');
  }
  return applyResolutionPlan(graph, createAudioDullingResolutionPlan(config));
}

export function disposeAudioDullingGraph(graph = null) {
  if (!graph || typeof graph !== 'object') return;
  graph.nodes?.forEach(safeDisconnect);
}
