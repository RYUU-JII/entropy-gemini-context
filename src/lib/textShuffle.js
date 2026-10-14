const MAX_SHUFFLE_DISTANCE = 5;
const DISTANCE_DISTRIBUTION_SIZE = MAX_SHUFFLE_DISTANCE + 1;

function requireDistanceDistribution(value) {
  if (
    !Array.isArray(value)
    || value.length !== DISTANCE_DISTRIBUTION_SIZE
    || value.some((weight) => !Number.isFinite(weight) || weight < 0)
  ) {
    throw new Error('TEXT_SHUFFLE_DISTANCE_DISTRIBUTION_INVALID');
  }
  const total = value.reduce((sum, weight) => sum + weight, 0);
  if (Math.abs(total - 100) > 1e-7) {
    throw new Error('TEXT_SHUFFLE_DISTANCE_DISTRIBUTION_INVALID');
  }
  return value;
}

export function scaleShuffleDistanceDistribution(value, intensity) {
  const distribution = requireDistanceDistribution(value);
  const normalizedIntensity = Number(intensity);
  if (!Number.isFinite(normalizedIntensity) || normalizedIntensity < 0 || normalizedIntensity > 1) {
    throw new Error('TEXT_SHUFFLE_DISTANCE_INTENSITY_INVALID');
  }
  const scaled = distribution.map((weight, distance) => (
    distance === 0 ? 0 : weight * normalizedIntensity
  ));
  scaled[0] = 100 - scaled.slice(1).reduce((sum, weight) => sum + weight, 0);
  return Object.freeze(scaled);
}

export function createSeededRandom(seedStr) {
  let seed = 0;
  const seedSource = String(seedStr || '');
  for (let i = 0; i < seedSource.length; i++) {
    seed = (seed * 31 + seedSource.charCodeAt(i)) >>> 0;
  }

  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function splitTokenShell(token) {
  const source = String(token || '');
  const match = source.match(/^([([{'"“‘]*)(.*?)([\])}'"”’.,!?;:…]*)$/u);
  if (!match) return { leading: '', core: source, trailing: '' };
  return {
    leading: match[1] || '',
    core: match[2] || '',
    trailing: match[3] || '',
  };
}

function hasLetter(value) {
  return /[A-Za-z가-힣]/.test(String(value || ''));
}

function endsSentence(value) {
  return /[.!?。！？]$/.test(String(value || '').trim());
}

function createEmptyShuffleSegment() {
  return {
    wordSlots: [],
    words: [],
  };
}

function collectShuffleSegments(parts, { protectInformationalTokens = true } = {}) {
  const segments = [];
  let currentSegment = createEmptyShuffleSegment();
  let previousCore = '';
  let wordIndex = 0;
  let totalMovableWords = 0;

  const flushSegment = () => {
    if (currentSegment.wordSlots.length > 0) segments.push(currentSegment);
    currentSegment = createEmptyShuffleSegment();
  };

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (!part) continue;
    if (/^\s+$/.test(part)) continue;

    const shell = splitTokenShell(part);
    const core = shell.core;
    const protectedToken = protectInformationalTokens
      ? shouldProtectShuffleToken(part, { wordIndex, previousCore })
      : false;
    wordIndex += 1;
    previousCore = core || part;

    if (!protectedToken && core.length >= 2) {
      currentSegment.wordSlots.push({
        partIndex: i,
        wordIndex,
        leading: shell.leading,
        trailing: shell.trailing,
      });
      currentSegment.words.push(core);
      totalMovableWords += 1;
    }

    if (endsSentence(part)) flushSegment();
  }

  flushSegment();

  return {
    segments,
    totalWords: wordIndex,
    totalMovableWords,
  };
}

export function shouldProtectShuffleToken(token, context = {}) {
  const source = String(token || '').trim();
  if (!source) return true;

  const { core } = splitTokenShell(source);
  if (!core || !hasLetter(core)) return true;
  if (/\d/.test(core)) return true;
  if (/[$€£¥₩¢₹]|원|달러|usd|krw|eur|jpy/i.test(source)) return true;
  if (/^(?:https?:\/\/|www\.|mailto:)/i.test(core)) return true;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(core)) return true;
  if (/^[@#][\w.-]+$/.test(core)) return true;
  if (/^(?:[A-Z]\.){2,}$/.test(core)) return true;
  if (/^[A-Z]{2,8}s?$/.test(core)) return true;
  if (/[a-z][A-Z]/.test(core)) return true;

  const wordIndex = Number(context.wordIndex);
  const previousCore = String(context.previousCore || '');
  if (
    Number.isFinite(wordIndex) &&
    wordIndex > 0 &&
    !endsSentence(previousCore) &&
    /^[A-Z][a-z][A-Za-z'-]*$/.test(core)
  ) {
    return true;
  }

  return false;
}

function shuffleInPlace(items, random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
}

function resolveMovedWordCount(wordCount, distanceDistribution, random) {
  const movableRate = 1 - (distanceDistribution[0] / 100);
  if (wordCount < 2 || movableRate <= 0) return 0;
  const maxEvenCount = wordCount - (wordCount % 2);
  if (maxEvenCount < 2) return 0;
  const expected = Math.min(maxEvenCount, Math.max(2, wordCount * movableRate));
  const lower = Math.max(2, Math.min(maxEvenCount, Math.floor(expected / 2) * 2));
  const upper = Math.min(maxEvenCount, lower + 2);
  if (upper === lower) return lower;
  return random() < ((expected - lower) / (upper - lower)) ? upper : lower;
}

function samplePositiveDistance(distanceDistribution, random) {
  const positiveTotal = distanceDistribution
    .slice(1)
    .reduce((sum, weight) => sum + weight, 0);
  if (positiveTotal <= 0) return 0;
  let cursor = random() * positiveTotal;
  for (let distance = 1; distance <= MAX_SHUFFLE_DISTANCE; distance += 1) {
    cursor -= distanceDistribution[distance];
    if (cursor < 0) return distance;
  }
  return MAX_SHUFFLE_DISTANCE;
}

function buildPairQueues(wordSlots, random) {
  const indexByWordPosition = new Map(
    wordSlots.map((slot, index) => [slot.wordIndex, index]),
  );
  const queues = Array.from({ length: DISTANCE_DISTRIBUTION_SIZE }, () => []);
  for (let leftIndex = 0; leftIndex < wordSlots.length; leftIndex += 1) {
    const leftPosition = wordSlots[leftIndex].wordIndex;
    for (let distance = 1; distance <= MAX_SHUFFLE_DISTANCE; distance += 1) {
      const rightIndex = indexByWordPosition.get(leftPosition + distance);
      if (Number.isInteger(rightIndex)) queues[distance].push([leftIndex, rightIndex]);
    }
  }
  queues.slice(1).forEach((queue) => shuffleInPlace(queue, random));
  return queues;
}

function takeAvailablePair(queues, cursors, used, desiredDistance) {
  const distances = [desiredDistance];
  for (let offset = 1; offset <= MAX_SHUFFLE_DISTANCE; offset += 1) {
    if (desiredDistance - offset >= 1) distances.push(desiredDistance - offset);
    if (desiredDistance + offset <= MAX_SHUFFLE_DISTANCE) distances.push(desiredDistance + offset);
  }
  for (const distance of distances) {
    const queue = queues[distance];
    while (cursors[distance] < queue.length) {
      const pair = queue[cursors[distance]];
      cursors[distance] += 1;
      if (!used.has(pair[0]) && !used.has(pair[1])) return pair;
    }
  }
  return null;
}

function shuffleSegmentWordsByDistribution(words, wordSlots, {
  distanceDistribution,
  random,
} = {}) {
  const n = words.length;
  if (n < 2) return words.slice();

  const movedWordCount = resolveMovedWordCount(n, distanceDistribution, random);
  if (movedWordCount <= 0) return words.slice();
  const queues = buildPairQueues(wordSlots, random);
  const cursors = new Array(DISTANCE_DISTRIBUTION_SIZE).fill(0);
  const used = new Set();
  const outWords = words.slice();
  const pairCount = movedWordCount / 2;

  for (let pairIndex = 0; pairIndex < pairCount; pairIndex += 1) {
    const desiredDistance = samplePositiveDistance(distanceDistribution, random);
    const pair = takeAvailablePair(queues, cursors, used, desiredDistance);
    if (!pair) break;
    const [leftIndex, rightIndex] = pair;
    [outWords[leftIndex], outWords[rightIndex]] = [outWords[rightIndex], outWords[leftIndex]];
    used.add(leftIndex);
    used.add(rightIndex);
  }
  return outWords;
}

export function shuffleWordInternals(word, {
  intensity = 0.5,
  random = Math.random,
  protectInformationalTokens = true,
  context = {},
} = {}) {
  const source = String(word || '');
  if (!source) return source;

  const { leading, core, trailing } = splitTokenShell(source);
  if (!core || core.length <= 3) return source;
  if (protectInformationalTokens && shouldProtectShuffleToken(core, context)) return source;

  const chars = Array.from(core);
  const len = chars.length;
  if (len <= 3) return source;

  const rawIntensity = Number(intensity);
  const normalizedIntensity = Math.max(0, Math.min(1, Number.isFinite(rawIntensity) ? rawIntensity : 0.5));
  if (normalizedIntensity <= 0) return source;

  // 단어마다 과도하게 깨지지 않도록 확률적 적용 (강도 비례)
  if (random() > Math.min(1, 0.35 + normalizedIntensity * 0.65)) return source;

  if (len === 4) {
    // 4글자: 중간 1번과 2번 글자 스왑 (예: '알고리즘' -> '알리고즘', '인공지능' -> '인지공능')
    const temp = chars[1];
    chars[1] = chars[2];
    chars[2] = temp;
  } else if (normalizedIntensity <= 0.7) {
    // 5글자 이상 & 중간 강도 이하: 중간 영역 [1, len - 2] 내에서 인접한 1쌍 스왑
    const innerLen = len - 2;
    const startIdx = 1 + Math.floor(random() * (innerLen - 1));
    const temp = chars[startIdx];
    chars[startIdx] = chars[startIdx + 1];
    chars[startIdx + 1] = temp;
  } else {
    // 5글자 이상 & 높은 강도: 중간 영역 [1, len - 2] 내에서 복수 스왑
    const innerEnd = len - 2;
    const swapCount = Math.min(innerEnd, Math.max(1, Math.round(innerEnd * normalizedIntensity * 0.6)));
    for (let s = 0; s < swapCount; s += 1) {
      const a = 1 + Math.floor(random() * innerEnd);
      const b = 1 + Math.floor(random() * innerEnd);
      if (a !== b) {
        const temp = chars[a];
        chars[a] = chars[b];
        chars[b] = temp;
      }
    }
  }

  return `${leading}${chars.join('')}${trailing}`;
}

export function shuffleWords(text, {
  distanceDistribution = null,
  wordOrder = null,
  innerWord = null,
  random = Math.random,
  protectInformationalTokens = false,
  maxMovableWords = 220,
} = {}) {
  const original = String(text || '');

  // wordOrder 결정: 별도 지정이 없으면 기존 distanceDistribution 인자 사용
  const effectiveWordOrder = wordOrder ?? (
    distanceDistribution ? { enabled: true, distanceDistribution } : null
  );
  const wordOrderEnabled = Boolean(effectiveWordOrder?.enabled && effectiveWordOrder?.distanceDistribution);
  const distribution = wordOrderEnabled
    ? requireDistanceDistribution(effectiveWordOrder.distanceDistribution)
    : (distanceDistribution ? requireDistanceDistribution(distanceDistribution) : null);

  // innerWord 결정
  const innerWordEnabled = Boolean(innerWord?.enabled && (innerWord.intensity ?? 0) > 0);
  const innerIntensity = innerWord?.intensity ?? 0.5;

  // 둘 다 효과가 없으면 원본 반환
  const wordOrderHasDisplacement = wordOrderEnabled && distribution && distribution.slice(1).some((w) => w > 0);
  if (!wordOrderHasDisplacement && !innerWordEnabled) return original;

  const parts = original.split(/(\s+)/);
  const {
    segments,
    totalWords,
    totalMovableWords,
  } = collectShuffleSegments(parts, { protectInformationalTokens });

  const maxWords = Number(maxMovableWords);
  if (totalWords < 3 && !innerWordEnabled) return original;
  if (totalMovableWords <= 0) return original;
  if (Number.isFinite(maxWords) && maxWords > 0 && totalMovableWords > maxWords) return original;

  segments.forEach((segment) => {
    // 1단계: 단어 간 순서 셔플
    let processedWords = segment.words;
    if (wordOrderHasDisplacement && segment.words.length >= 2) {
      processedWords = shuffleSegmentWordsByDistribution(segment.words, segment.wordSlots, {
        distanceDistribution: distribution,
        random,
      });
    }

    // 2단계: 단어 내부 글자 셔플 (Typoglycemia)
    if (innerWordEnabled) {
      processedWords = processedWords.map((word, wIdx) => {
        const slot = segment.wordSlots[wIdx];
        return shuffleWordInternals(word, {
          intensity: innerIntensity,
          random,
          protectInformationalTokens,
          context: { wordIndex: slot?.wordIndex },
        });
      });
    }

    for (let i = 0; i < segment.wordSlots.length; i += 1) {
      const slot = segment.wordSlots[i];
      parts[slot.partIndex] = `${slot.leading}${processedWords[i] ?? ''}${slot.trailing}`;
    }
  });

  return parts.join('');
}
