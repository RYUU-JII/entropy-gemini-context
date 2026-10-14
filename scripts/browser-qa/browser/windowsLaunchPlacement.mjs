import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL as NodeURL } from 'node:url';

import { resolveWindowsPowerShellPath } from './windowsPlatform.mjs';

export function readWindowsQaMonitorInventory({
  execFileSyncImpl = execFileSync,
  powershellPath = resolveWindowsPowerShellPath(),
} = {}) {
  const inventoryScript = fileURLToPath(new NodeURL('./windowsMonitorInventory.ps1', import.meta.url));
  let output;
  try {
    output = execFileSyncImpl(powershellPath, [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
      '-File', inventoryScript,
    ], { encoding: 'utf8', timeout: 10_000, maxBuffer: 64 * 1024, windowsHide: true });
  } catch (cause) {
    throw new Error('QA_WINDOWS_MONITOR_QUERY_FAILED', { cause });
  }
  try {
    return JSON.parse(output.replace(/^\uFEFF/u, ''));
  } catch (cause) {
    throw new Error('QA_WINDOWS_MONITOR_QUERY_RESPONSE_INVALID', { cause });
  }
}

function requireRect(rect) {
  if (!Array.isArray(rect) || rect.length !== 4 || rect.some((n) => !Number.isSafeInteger(n))
    || rect[2] < 1 || rect[3] < 1) throw new Error('QA_WINDOWS_MONITOR_RECT_INVALID');
  return rect;
}

function normalizeMonitors(raw) {
  if (!Array.isArray(raw) || raw.length < 1) throw new Error('QA_WINDOWS_MONITOR_INVENTORY_EMPTY');
  const names = new Set();
  const monitors = raw.map((monitor) => {
    if (!monitor || typeof monitor.deviceName !== 'string' || !monitor.deviceName
      || names.has(monitor.deviceName) || typeof monitor.primary !== 'boolean'
      || !Number.isFinite(monitor.scaleFactor) || monitor.scaleFactor < 0.5
      || monitor.scaleFactor > 12) throw new Error('QA_WINDOWS_MONITOR_INVENTORY_INVALID');
    names.add(monitor.deviceName);
    const bounds = requireRect(monitor.bounds);
    const workArea = requireRect(monitor.workArea);
    if (workArea[0] < bounds[0] || workArea[1] < bounds[1]
      || workArea[0] + workArea[2] > bounds[0] + bounds[2]
      || workArea[1] + workArea[3] > bounds[1] + bounds[3]) {
      throw new Error('QA_WINDOWS_MONITOR_WORK_AREA_INVALID');
    }
    return { ...monitor, bounds: [...bounds], workArea: [...workArea] };
  });
  if (monitors.filter((monitor) => monitor.primary).length !== 1
    || monitors.find((monitor) => monitor.primary).bounds.slice(0, 2).some((n) => n !== 0)) {
    throw new Error('QA_WINDOWS_MONITOR_PRIMARY_INVALID');
  }
  return monitors;
}

function touchingSide(parent, child) {
  const [px, py, pw, ph] = parent;
  const [cx, cy, cw, ch] = child;
  const left = Math.max(px, cx), top = Math.max(py, cy);
  const right = Math.min(px + pw, cx + cw), bottom = Math.min(py + ph, cy + ch);
  if (left === right && top === bottom) return py + ph === top ? 'bottom' : px === left ? 'left' : 'top';
  if (left === right && top <= bottom) return px === left ? 'left' : 'right';
  if (top === bottom && left <= right) return py === top ? 'top' : 'bottom';
  return null;
}

// Chromium lays out mixed-DPI displays from the primary monitor's adjoining
// edges, rather than dividing each monitor's absolute origin by its own DPI.
// Keep this conversion aligned with ui/display/win/scaling_util.cc.
function chromiumDipLayout(monitors) {
  const layouts = new Map(monitors.map((m) => {
    const [x, y, width, height] = m.bounds, scale = m.scaleFactor;
    return [m.deviceName, [Math.floor(x / scale), Math.floor(y / scale),
      Math.ceil((x + width) / scale) - Math.floor(x / scale),
      Math.ceil((y + height) / scale) - Math.floor(y / scale)]];
  }));
  const remaining = monitors.filter((m) => !m.primary);
  const parents = [monitors.find((m) => m.primary)];
  while (parents.length) {
    const parent = parents.pop(), p = layouts.get(parent.deviceName);
    for (let index = 0; index < remaining.length;) {
      const child = remaining[index], side = touchingSide(parent.bounds, child.bounds);
      if (!side) { index += 1; continue; }
      const c = layouts.get(child.deviceName), vertical = side === 'left' || side === 'right';
      const axis = vertical ? 1 : 0, length = axis + 2;
      const parentLength = parent.bounds[length];
      const begin = child.bounds[axis] - parent.bounds[axis];
      const end = begin + child.bounds[length];
      let offset, endReference = false;
      if (end === parentLength && begin !== 0) { offset = 0; endReference = true; }
      else if (begin >= 0 && begin <= parentLength) offset = Math.floor(begin / parent.scaleFactor);
      else if (end >= 0 && end <= parentLength) {
        offset = Math.floor((parentLength - end) / parent.scaleFactor); endReference = true;
      } else offset = Math.floor(begin / child.scaleFactor);
      if (endReference) offset = p[length] - c[length] - offset;
      c[axis] = p[axis] + offset;
      if (side === 'left') c[0] = p[0] - c[2];
      if (side === 'right') c[0] = p[0] + p[2];
      if (side === 'top') c[1] = p[1] - c[3];
      if (side === 'bottom') c[1] = p[1] + p[3];
      remaining.splice(index, 1); parents.push(child);
    }
  }
  if (remaining.length) throw new Error('QA_WINDOWS_MONITOR_LAYOUT_DISCONNECTED');
  return layouts;
}

export function resolveWindowsQaLaunchPlacement({
  args,
  platform,
  headless,
  monitorInventory = readWindowsQaMonitorInventory,
} = {}) {
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string')) {
    throw new Error('QA_WINDOWS_LAUNCH_ARGUMENTS_INVALID');
  }
  const unchanged = (status) => Object.freeze({ args: Object.freeze([...args]),
    receipt: Object.freeze({ policy: 'secondary_preferred', status }) });
  if (headless === true || args.some((arg) => arg === '--headless' || arg.startsWith('--headless='))) {
    return unchanged('headless_not_applicable');
  }
  if (platform !== 'windows') return unchanged('platform_not_applicable');
  if (args.some((arg) => arg === '--window-position' || arg.startsWith('--window-position='))) {
    return unchanged('explicit_position_preserved');
  }
  const monitors = normalizeMonitors(monitorInventory());
  if (monitors.length === 1) return Object.freeze({ ...unchanged('single_monitor_unchanged'),
    receipt: Object.freeze({ policy: 'secondary_preferred', status: 'single_monitor_unchanged', monitorCount: 1 }) });
  const selected = monitors.filter((m) => !m.primary).sort((a, b) => (
    a.bounds[0] - b.bounds[0] || a.bounds[1] - b.bounds[1]
    || (a.deviceName < b.deviceName ? -1 : a.deviceName > b.deviceName ? 1 : 0)
  ))[0];
  const forcedScaleArg = args.find((arg) => arg.startsWith('--force-device-scale-factor='));
  const forcedScale = forcedScaleArg ? Number(forcedScaleArg.split('=')[1]) : null;
  if (forcedScaleArg && (!Number.isFinite(forcedScale) || forcedScale <= 0)) {
    throw new Error('QA_WINDOWS_LAUNCH_SCALE_FACTOR_INVALID');
  }
  const effectiveMonitors = forcedScaleArg ? monitors.map((m) => ({ ...m, scaleFactor: forcedScale })) : monitors;
  const layout = chromiumDipLayout(effectiveMonitors), dipBounds = layout.get(selected.deviceName);
  const scale = forcedScaleArg ? forcedScale : selected.scaleFactor;
  const position = [0, 1].map((axis) => dipBounds[axis]
    + Math.ceil((selected.workArea[axis] - selected.bounds[axis]) / scale)
    + Math.min(24, Math.floor(selected.workArea[axis + 2] / scale / 4)));
  return Object.freeze({
    args: Object.freeze([...args, `--window-position=${position.join(',')}`]),
    receipt: Object.freeze({ policy: 'secondary_preferred', status: 'secondary_selected',
      monitorCount: monitors.length, deviceName: selected.deviceName,
      bounds: Object.freeze(selected.bounds), workArea: Object.freeze(selected.workArea),
      scaleFactor: scale, dipPosition: Object.freeze(position) }),
  });
}
