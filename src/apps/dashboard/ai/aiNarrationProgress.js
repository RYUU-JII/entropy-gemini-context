export const EMPTY_AI_DOWNLOAD_PROGRESS = Object.freeze({
  loaded: 0,
  total: 0,
  ratio: 0,
});

export function resolveAiDownloadProgress(event) {
  const loaded = Number(event?.loaded);
  const total = Number(event?.total);

  if (Number.isFinite(loaded) && Number.isFinite(total) && total > 0) {
    return {
      loaded,
      total,
      ratio: Math.max(0, Math.min(1, loaded / total)),
    };
  }

  if (Number.isFinite(loaded) && loaded >= 0 && loaded <= 1) {
    return {
      loaded,
      total: 1,
      ratio: loaded,
    };
  }

  return EMPTY_AI_DOWNLOAD_PROGRESS;
}
