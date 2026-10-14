export const ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT = 5;
export const ZEN_BONSAI_FIRST_BLOOM_FULL_MASK = (1 << ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT) - 1;
export const ZEN_BONSAI_FIRST_BLOOM_DURATION_MS = 900;

export function requireZenBonsaiFirstBloomRegionId(value) {
  if (!Number.isInteger(value) || value < 0 || value >= ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT) {
    throw new Error('ZEN_BONSAI_FIRST_BLOOM_REGION_INVALID');
  }
  return value;
}

export function requireZenBonsaiFirstBloomMask(value) {
  if (!Number.isInteger(value) || value < 0 || value > ZEN_BONSAI_FIRST_BLOOM_FULL_MASK) {
    throw new Error('ZEN_BONSAI_FIRST_BLOOM_MASK_INVALID');
  }
  return value;
}

export function requireZenBonsaiFirstBloomProgress(value) {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT) {
    throw new Error('ZEN_BONSAI_FIRST_BLOOM_PROGRESS_INVALID');
  }
  for (let index = 0; index < ZEN_BONSAI_FIRST_BLOOM_REGION_COUNT; index += 1) {
    if (!Number.isFinite(value[index]) || value[index] < 0 || value[index] > 1) {
      throw new Error('ZEN_BONSAI_FIRST_BLOOM_PROGRESS_INVALID');
    }
  }
  return value;
}
