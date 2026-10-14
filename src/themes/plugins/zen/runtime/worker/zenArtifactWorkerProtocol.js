import { getZenArtifactMaterialKey } from '../../presentation/artifacts/engine/zenArtifactDescriptor.js';
import { requireZenKaresansuiHeightfieldRequest } from '../../presentation/artifacts/karesansui/zenKaresansuiHeightfieldContract.js';

import { ZEN_ARTIFACT_MESSAGE } from './zenArtifactWorkerMessages.js';
export { ZEN_ARTIFACT_MESSAGE } from './zenArtifactWorkerMessages.js';
const TYPES = new Set(Object.values(ZEN_ARTIFACT_MESSAGE));

export function requireZenArtifactMessage(message) {
  if (!message || !TYPES.has(message.type)) throw new Error('ZEN_ARTIFACT_WORKER_MESSAGE_INVALID');
  if (message.type !== ZEN_ARTIFACT_MESSAGE.DISPOSE && (!Number.isSafeInteger(message.requestId) || message.requestId < 1)) {
    throw new Error('ZEN_ARTIFACT_WORKER_REQUEST_ID_INVALID');
  }
  if (message.type === ZEN_ARTIFACT_MESSAGE.PREPARE) {
    getZenArtifactMaterialKey(message.descriptor);
    if (!message.options || !Number.isFinite(message.options.origin?.x) || !Number.isFinite(message.options.origin?.y)
      || typeof message.options.animate !== 'boolean') throw new Error('ZEN_ARTIFACT_WORKER_FRAME_INVALID');
  }
  if (message.type === ZEN_ARTIFACT_MESSAGE.GROUND) requireZenKaresansuiHeightfieldRequest(message.ground);
  if (message.type === ZEN_ARTIFACT_MESSAGE.RESULT && message.receipt?.status === 'ground_rendered'
    && (typeof message.receipt.key !== 'string' || !message.bitmap)) {
    throw new Error('ZEN_ARTIFACT_WORKER_GROUND_RESULT_INVALID');
  }
  if (message.type === ZEN_ARTIFACT_MESSAGE.DRAW && (!Number.isFinite(message.elapsedMs) || message.elapsedMs < 0 || message.elapsedMs > 250)) {
    throw new Error('ZEN_ARTIFACT_WORKER_CLOCK_INVALID');
  }
  if (message.type === ZEN_ARTIFACT_MESSAGE.RESULT && message.receipt?.status === 'drawn'
    && (!Number.isSafeInteger(message.receipt.frameCount) || message.receipt.frameCount < 1
      || !Number.isFinite(message.receipt.timeMs) || message.receipt.timeMs < 0)) {
    throw new Error('ZEN_ARTIFACT_WORKER_FRAME_PROGRESS_INVALID');
  }
  return message;
}

export function releaseZenArtifactMessage(message) {
  if (message?.type === ZEN_ARTIFACT_MESSAGE.RESULT) message.bitmap?.close();
  if (message?.type === ZEN_ARTIFACT_MESSAGE.MATERIALS) {
    for (const layer of message.layers) layer.bitmap.close();
  }
}
