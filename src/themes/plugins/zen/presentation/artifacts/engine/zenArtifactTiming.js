// CSS cubic-bezier(.42, 0, .58, 1), sampled once instead of solving per actor/frame.
const EASE = new Float32Array(1025);
for (let index = 0; index <= 1024; index += 1) {
  const target = index / 1024;
  let low = 0;
  let high = 1;
  for (let step = 0; step < 20; step += 1) {
    const u = (low + high) / 2;
    const x = 3 * (1 - u) ** 2 * u * 0.42 + 3 * (1 - u) * u * u * 0.58 + u ** 3;
    if (x < target) low = u;
    else high = u;
  }
  const u = (low + high) / 2;
  EASE[index] = 3 * (1 - u) * u * u + u ** 3;
}
EASE[0] = 0;
EASE[1024] = 1;

export function zenEaseInOut(t) {
  const position = Math.max(0, Math.min(1, t)) * 1024;
  const index = Math.min(1023, Math.floor(position));
  return EASE[index] + (EASE[index + 1] - EASE[index]) * (position - index);
}
