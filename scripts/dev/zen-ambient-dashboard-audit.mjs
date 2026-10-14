#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

import {
  ExtensionChromiumHarness,
  evaluate,
} from '../e2e/extensionChromiumHarness.mjs';
import {
  stageEntropyQaArtifact,
} from '../e2e/qaProfileArtifactSlot.mjs';

const VIEWPORT = Object.freeze({ width: 1784, height: 849, deviceScaleFactor: 1 });
const CAPTURE_PLAN = Object.freeze([
  Object.freeze({ tab: 'main', times: Object.freeze(['06:30', '12:00', '18:50', '19:10', '19:30', '19:50', '21:00', '23:00']) }),
  Object.freeze({ tab: 'sites', times: Object.freeze(['12:00', '19:10', '23:00']) }),
  Object.freeze({ tab: 'schedule', times: Object.freeze(['12:00', '19:10', '23:00']) }),
  Object.freeze({ tab: 'settings', times: Object.freeze(['12:00', '19:10', '23:00']) }),
  Object.freeze({ tab: 'tools', times: Object.freeze(['12:00', '19:10', '23:00']) }),
]);

const sleep = (durationMs) => new Promise((resolve) => setTimeout(resolve, durationMs));

function readOption(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.slice(2).find((argument) => argument.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function requireAbsoluteOption(name) {
  const value = readOption(name);
  if (!value || !path.isAbsolute(value)) {
    throw new Error(`ZEN_AMBIENT_AUDIT_${name.toUpperCase()}_ABSOLUTE_PATH_REQUIRED`);
  }
  return path.normalize(value);
}

function toMinutes(time) {
  const match = /^(\d{2}):(\d{2})$/u.exec(time);
  if (!match) throw new Error(`ZEN_AMBIENT_AUDIT_TIME_INVALID:${time}`);
  return (Number(match[1]) * 60) + Number(match[2]);
}

function outputTimestamp() {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

async function waitForExpression(harness, page, expression, {
  timeoutMs = 30_000,
  errorCode = 'ZEN_AMBIENT_AUDIT_WAIT_TIMEOUT',
} = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await evaluate(harness.cdp, page.sessionId, expression, {
      awaitPromise: true,
      timeoutMs: 2_000,
    }).catch(() => null);
    if (lastValue) return lastValue;
    await sleep(100);
  }
  throw new Error(`${errorCode}:${JSON.stringify(lastValue)}`);
}

async function configurePage(harness, page) {
  await harness.cdp.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    mobile: false,
  }, page.sessionId);
  await harness.cdp.send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  }, page.sessionId);
}

async function waitForDashboard(harness, page, tab) {
  return waitForExpression(
    harness,
    page,
    `(() => {
      const frame = document.querySelector('.console-frame');
      const content = document.querySelector('.console-content');
      return document.readyState === 'complete'
        && frame?.dataset?.dashboardActiveTab === ${JSON.stringify(tab)}
        && content?.getBoundingClientRect().width > 900
        && (!document.fonts || document.fonts.status === 'loaded');
    })()`,
    { errorCode: `ZEN_AMBIENT_AUDIT_DASHBOARD_NOT_READY:${tab}` },
  );
}

async function setAppearanceTime(harness, page, time) {
  const minutes = toMinutes(time);
  const result = await evaluate(harness.cdp, page.sessionId, `(async () => {
    const control = document.querySelector('.zen-appearance-time-control');
    const input = control?.querySelector('input[type="range"]');
    const toggle = control?.querySelector('button');
    if (!control || !input || !toggle) return { error: 'control_missing' };
    if (input.disabled) {
      toggle.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter.call(input, ${JSON.stringify(String(minutes))});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { error: null, disabled: input.disabled, value: input.value };
  })()`, { timeoutMs: 5_000 });
  if (result?.error || result?.disabled || result?.value !== String(minutes)) {
    throw new Error(`ZEN_AMBIENT_AUDIT_TIME_CONTROL_FAILED:${time}:${JSON.stringify(result)}`);
  }
  await waitForExpression(
    harness,
    page,
    `(() => {
      const input = document.querySelector('.zen-appearance-time-control input[type="range"]');
      const label = document.querySelector('.zen-appearance-time-control > div:last-child');
      return input?.disabled === false
        && input?.value === ${JSON.stringify(String(minutes))}
        && label?.textContent?.trim() === ${JSON.stringify(time)};
    })()`,
    { errorCode: `ZEN_AMBIENT_AUDIT_TIME_NOT_COMMITTED:${time}` },
  );
  await sleep(1_850);
  await evaluate(harness.cdp, page.sessionId, 'new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
}

async function captureScreenshot(harness, page, filePath) {
  const result = await harness.cdp.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  }, page.sessionId, { timeoutMs: 20_000 });
  if (typeof result?.data !== 'string' || !result.data) {
    throw new Error(`ZEN_AMBIENT_AUDIT_SCREENSHOT_EMPTY:${filePath}`);
  }
  await fs.writeFile(filePath, Buffer.from(result.data, 'base64'));
}

const PAGE_AUDIT_EXPRESSION = `(() => {
  const parseColor = (value) => {
    const hex = /^#([\\da-f]{6})$/iu.exec(String(value || '').trim());
    if (hex) {
      return {
        r: Number.parseInt(hex[1].slice(0, 2), 16),
        g: Number.parseInt(hex[1].slice(2, 4), 16),
        b: Number.parseInt(hex[1].slice(4, 6), 16),
        a: 1,
      };
    }
    const match = /rgba?\\(([^)]+)\\)/u.exec(String(value || ''));
    if (!match) return null;
    const channels = match[1].split(/[ ,/]+/u).filter(Boolean).map(Number);
    if (channels.length < 3 || channels.slice(0, 3).some((entry) => !Number.isFinite(entry))) return null;
    return { r: channels[0], g: channels[1], b: channels[2], a: Number.isFinite(channels[3]) ? channels[3] : 1 };
  };
  const composite = (foreground, background) => {
    const alpha = Math.max(0, Math.min(1, foreground.a));
    return {
      r: (foreground.r * alpha) + (background.r * (1 - alpha)),
      g: (foreground.g * alpha) + (background.g * (1 - alpha)),
      b: (foreground.b * alpha) + (background.b * (1 - alpha)),
      a: 1,
    };
  };
  const luminance = (color) => {
    const linear = [color.r, color.g, color.b].map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return (linear[0] * 0.2126) + (linear[1] * 0.7152) + (linear[2] * 0.0722);
  };
  const contrast = (left, right) => {
    const leftLuminance = luminance(left);
    const rightLuminance = luminance(right);
    return (Math.max(leftLuminance, rightLuminance) + 0.05) / (Math.min(leftLuminance, rightLuminance) + 0.05);
  };
  const bodyStyle = getComputedStyle(document.body);
  const variable = (name) => bodyStyle.getPropertyValue(name).trim();
  const semanticSurfaceNames = [
    '--zen-ambient-layer-l2-top',
    '--zen-ambient-layer-l2-bottom',
    '--zen-ambient-layer-l3-top',
    '--zen-ambient-layer-l3-bottom',
    '--zen-ambient-background',
    '--zen-ambient-surface',
    '--zen-ambient-surface-elevated',
    '--zen-ambient-surface-sunken',
    '--zen-ambient-surface-overlay',
  ];
  const semanticForegroundNames = [
    '--zen-ambient-text',
    '--zen-ambient-text-muted',
    '--zen-ambient-text-subtle',
    '--zen-ambient-primary',
  ];
  const semanticSurfaces = semanticSurfaceNames.map((name) => ({ name, value: variable(name), color: parseColor(variable(name)) }));
  const semanticContrast = semanticForegroundNames.map((name) => {
    const value = variable(name);
    const foreground = parseColor(value);
    const ratios = semanticSurfaces
      .filter((entry) => foreground && entry.color)
      .map((entry) => ({ surface: entry.name, ratio: contrast(foreground, entry.color) }));
    return {
      name,
      value,
      minimum: ratios.length ? Math.min(...ratios.map((entry) => entry.ratio)) : null,
      surface: ratios.sort((left, right) => left.ratio - right.ratio)[0]?.surface || null,
    };
  });
  const defaultBackground = parseColor(variable('--zen-ambient-background')) || { r: 255, g: 255, b: 255, a: 1 };
  const resolveBackground = (element) => {
    let current = element;
    while (current) {
      const style = getComputedStyle(current);
      const color = parseColor(style.backgroundColor);
      if (color && color.a > 0.04) return composite(color, defaultBackground);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
        const gradientColor = parseColor(style.backgroundImage);
        if (gradientColor) return composite(gradientColor, defaultBackground);
      }
      current = current.parentElement;
    }
    return defaultBackground;
  };
  const lowContrast = [];
  const candidates = [...document.querySelectorAll('body *')].filter((element) => {
    if (element.children.length > 0 && ![...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) return false;
    const text = element.textContent?.trim();
    if (!text || text.length > 140) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none';
  });
  for (const element of candidates.slice(0, 2400)) {
    const style = getComputedStyle(element);
    const foregroundSource = parseColor(style.color);
    if (!foregroundSource) continue;
    const background = resolveBackground(element);
    const effectiveForeground = composite({ ...foregroundSource, a: foregroundSource.a * Number(style.opacity || 1) }, background);
    const ratio = contrast(effectiveForeground, background);
    const fontSize = Number.parseFloat(style.fontSize) || 0;
    const fontWeight = Number.parseInt(style.fontWeight, 10) || 400;
    const threshold = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700) ? 3 : 4.5;
    if (ratio + 1e-6 >= threshold) continue;
    lowContrast.push({
      text: element.textContent.trim().replace(/\\s+/gu, ' ').slice(0, 100),
      tag: element.tagName.toLowerCase(),
      className: String(element.className || '').slice(0, 220),
      ratio: Number(ratio.toFixed(3)),
      threshold,
      fontSize,
      fontWeight,
      color: style.color,
      background,
      opacity: Number(style.opacity || 1),
    });
  }
  const surface = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return null;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return {
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      color: style.color,
      backgroundColor: style.backgroundColor,
      backgroundImage: style.backgroundImage,
      borderColor: style.borderColor,
    };
  };
  const cssVariableNames = [
    '--zen-ambient-daylight', '--zen-ambient-warmth', '--zen-ambient-twilight', '--zen-ambient-night-weight',
    '--zen-ambient-shell-top', '--zen-ambient-shell-bottom',
    '--zen-ambient-layer-l2-top', '--zen-ambient-layer-l2-bottom',
    '--zen-ambient-layer-l3-top', '--zen-ambient-layer-l3-bottom',
    '--zen-ambient-background', '--zen-ambient-surface', '--zen-ambient-surface-elevated',
    '--zen-ambient-surface-sunken', '--zen-ambient-surface-overlay',
    '--zen-ambient-text', '--zen-ambient-text-muted', '--zen-ambient-text-subtle', '--zen-ambient-primary',
    '--zen-ambient-border', '--zen-ambient-border-muted', '--zen-ambient-border-strong',
    '--color-background', '--color-surface', '--color-surface-elevated', '--color-surface-sunken',
    '--color-on-surface', '--color-on-surface-muted', '--color-on-surface-subtle',
    '--color-border', '--color-border-muted', '--color-border-strong',
  ];
  return {
    href: location.href,
    theme: document.documentElement.dataset.theme || null,
    phase: document.querySelector('.console-shell')?.dataset.zenAmbientPhase || null,
    activeTab: document.querySelector('.console-frame')?.dataset.dashboardActiveTab || null,
    viewport: { width: innerWidth, height: innerHeight, devicePixelRatio },
    fonts: {
      status: document.fonts?.status || 'unsupported',
      families: [...new Set(candidates.slice(0, 200).map((element) => getComputedStyle(element).fontFamily))],
    },
    variables: Object.fromEntries(cssVariableNames.map((name) => [name, variable(name)])),
    semanticContrast,
    surfaces: {
      shell: surface('.console-shell'),
      frame: surface('.console-frame'),
      sidebar: surface('.console-sidebar'),
      content: surface('.console-content'),
      timeControl: surface('.zen-appearance-time-control'),
    },
    fish: globalThis.__ZEN_POND_LAST_FIRST_FRAME_ACK__ || null,
    textSampleCount: candidates.length,
    lowContrast: lowContrast.sort((left, right) => left.ratio - right.ratio).slice(0, 80),
  };
})()`;

async function auditPage(harness, page) {
  return evaluate(harness.cdp, page.sessionId, PAGE_AUDIT_EXPRESSION, {
    timeoutMs: 20_000,
  });
}

async function main() {
  const chromePath = requireAbsoluteOption('chrome');
  const profileDir = requireAbsoluteOption('profile');
  const distDir = path.resolve(readOption('dist', 'dist'));
  const outputDir = path.resolve(readOption(
    'output',
    `.artifacts/zen-ambient-dashboard-audit-${outputTimestamp()}`,
  ));
  const headless = process.argv.includes('--headless');
  await fs.mkdir(outputDir, { recursive: true });
  const sourceBuild = JSON.parse(await fs.readFile(path.join(distDir, 'entropy-build-info.json'), 'utf8'));
  const staged = await stageEntropyQaArtifact({ profileDir, sourceDir: distDir });
  const harness = new ExtensionChromiumHarness({
    chromePath,
    distDir: staged.slotDir,
    rootDir: '/',
    headless,
    loadInPlace: true,
    qaProfileDir: profileDir,
    qaProfileDirectory: 'Default',
    trustedPagePath: 'entropy-e2e.html',
  });
  const consoleErrors = [];
  const reports = [];
  let page = null;
  let unsubscribeConsole = null;
  let unsubscribeException = null;
  try {
    await harness.start();
    unsubscribeConsole = harness.cdp.subscribe('Runtime.consoleAPICalled', (event) => {
      if (event.params?.type !== 'error') return;
      consoleErrors.push({
        type: 'console',
        text: (event.params.args || []).map((entry) => entry.value || entry.description || '').join(' '),
      });
    });
    unsubscribeException = harness.cdp.subscribe('Runtime.exceptionThrown', (event) => {
      consoleErrors.push({
        type: 'exception',
        text: event.params?.exceptionDetails?.exception?.description
          || event.params?.exceptionDetails?.text
          || 'Runtime.exceptionThrown',
      });
    });
    const dashboardUrl = (tab) => `chrome-extension://${harness.extensionId}/src/pages/dashboard.html?tab=${tab}`;
    page = await harness.openPage(dashboardUrl('main'), { active: true, timeoutMs: 45_000 });
    await configurePage(harness, page);

    for (const captureGroup of CAPTURE_PLAN) {
      if (captureGroup.tab !== 'main') {
        await harness.navigatePage(page, dashboardUrl(captureGroup.tab), { timeoutMs: 45_000 });
        await configurePage(harness, page);
      }
      await waitForDashboard(harness, page, captureGroup.tab);
      for (const time of captureGroup.times) {
        await setAppearanceTime(harness, page, time);
        if (captureGroup.tab === 'main') {
          await waitForExpression(
            harness,
            page,
            'globalThis.__ZEN_POND_LAST_FIRST_FRAME_ACK__?.fishCount === 6',
            { timeoutMs: 45_000, errorCode: 'ZEN_AMBIENT_AUDIT_SIX_KOI_NOT_READY' },
          );
        }
        const label = `${captureGroup.tab}-${time.replace(':', '')}`;
        const screenshotPath = path.join(outputDir, `${label}.png`);
        await captureScreenshot(harness, page, screenshotPath);
        reports.push({
          label,
          screenshotPath,
          ...(await auditPage(harness, page)),
        });
      }
    }

    const report = {
      schemaVersion: 1,
      outputDir,
      extensionId: harness.extensionId,
      executionMode: harness.chromeLaunchSpec?.executionMode || 'unknown',
      sourceBuild,
      stagedSlot: staged.slotDir,
      headed: !headless,
      capturePlan: CAPTURE_PLAN,
      consoleErrors,
      reports,
    };
    await fs.writeFile(path.join(outputDir, 'audit.json'), `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify({
      status: consoleErrors.length === 0 ? 'passed' : 'diagnostics',
      outputDir,
      extensionId: report.extensionId,
      buildId: sourceBuild.buildId,
      captures: reports.length,
      consoleErrors: consoleErrors.length,
      mainFishCount: reports.find((entry) => entry.activeTab === 'main')?.fish?.fishCount || null,
      lowContrastEntries: reports.reduce((sum, entry) => sum + entry.lowContrast.length, 0),
    }, null, 2)}\n`);
  } finally {
    unsubscribeConsole?.();
    unsubscribeException?.();
    if (page) await harness.closePage(page).catch(() => {});
    await harness.close();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
