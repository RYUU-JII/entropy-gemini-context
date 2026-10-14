import { ensureNumber } from './number.js';

function formatDateYmd(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractDays(dateLike, days) {
  const date = new Date(dateLike);
  date.setDate(date.getDate() - (Number.isFinite(days) ? days : 0));
  return date;
}

export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}시간 ${String(minutes).padStart(2, '0')}분`;
  if (minutes > 0) return `${minutes}분 ${String(seconds).padStart(2, '0')}초`;
  return `${seconds}초`;
}

export function getLocalDateStr(ts = Date.now()) {
  return formatDateYmd(ts);
}

export function getTodayDateStr() {
  return formatDateYmd(Date.now());
}

export function getYesterdayDateStr() {
  return formatDateYmd(subtractDays(Date.now(), 1));
}

export function reconcileHourlyToTotal(hourly, totalMs) {
  const target = Math.max(0, ensureNumber(totalMs));
  const base = ensure24Array(hourly);
  const sum = base.reduce((acc, v) => acc + v, 0);

  if (sum === target) return base;

  if (sum <= 0) {
    // If total usage is 0 but we have a target, distribute evenly or fill first hour?
    // Usually invalid state if usage 0 but total > 0. 
    // Just return empty base or handle gracefully.
    // However, if sum is 0, we can't scale. 
    // Just dump all into first hour or distribute evenly? 
    // Let's just return base to be safe, logic implies usage distribution follows hours.
    return base;
  }

  const scale = target / sum;
  const scaled = base.map((v) => Math.floor(v * scale));
  const scaledSum = scaled.reduce((acc, v) => acc + v, 0);
  let rem = target - scaledSum;
  if (rem <= 0) return scaled;

  const frac = base
    .map((v, idx) => ({ idx, frac: v * scale - Math.floor(v * scale) }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < frac.length && rem > 0; i++, rem--) {
    scaled[frac[i].idx] += 1;
  }

  return scaled;
}

export function ensure24Array(val) {
  const out = Array(24).fill(0);

  if (Array.isArray(val)) {
    for (let i = 0; i < 24; i++) out[i] = Math.max(0, ensureNumber(val[i]));
    return out;
  }

  if (val && typeof val === 'object') {
    for (let i = 0; i < 24; i++) out[i] = Math.max(0, ensureNumber(val[i] ?? val[String(i)]));
    return out;
  }

  return out;
}

export const normalizeDateStr = (date) => {
  return formatDateYmd(date);
};
