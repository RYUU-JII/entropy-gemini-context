const hashText = (text) => {
  let hash = 2166136261;
  for (const character of text) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/**
 * A stable body-copy projection. It never edits whitespace, links, numbers,
 * punctuation, or a word's first/last syllable. Callers retain the original text
 * for assistive technology and never apply this to controls or headings.
 */
export function projectFeedText(text, intensity, seed) {
  if (typeof text !== 'string') throw new TypeError('Projected text must be a string.');
  if (!Number.isFinite(intensity)) throw new TypeError('Text intensity must be finite.');
  if (typeof seed !== 'string' && !Number.isFinite(seed)) throw new TypeError('Text seed must be a string or finite number.');
  const amount = Math.min(1, Math.max(0, intensity));
  if (amount === 0) return text;

  return text.split(/(\s+)/u).map((token, index) => {
    // Keep an entire whitespace-delimited token containing URL/number intact.
    if (/[\d/@#]|https?:|www\./iu.test(token)) return token;
    const match = token.match(/^([“‘(\[]*)([가-힣]{4,})([.,!?…:;”’)\]]*)$/u);
    if (!match) return token;

    const hash = hashText(`${String(seed)}:${index}:${match[2]}`);
    // Maximum intensity uses a 35% deterministic sampling threshold.
    if ((hash % 10000) / 10000 >= amount * 0.35) return token;
    const syllables = Array.from(match[2]);
    const interiorIndex = 1 + ((hash >>> 8) % (syllables.length - 3));
    [syllables[interiorIndex], syllables[interiorIndex + 1]] = [syllables[interiorIndex + 1], syllables[interiorIndex]];
    return `${match[1]}${syllables.join('')}${match[3]}`;
  }).join('');
}
