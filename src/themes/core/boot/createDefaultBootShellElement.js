import { DEFAULT_THEME_ID } from '../ids.js';
import {
  THEME_BOOT_SHELL_RENDERER_STATUS,
  attachThemeBootShellRendererReadyPromise,
} from './bootShellRendererContract.js';
import {
  THEME_BOOT_SCREEN_CSS,
  getThemeBootPresentation,
  getThemeBootStyleText,
} from './presentationCatalog.js';

function createElement(tagName, className = '', textContent = null) {
  const element = document.createElement(tagName);
  element.className = className;
  if (typeof textContent === 'string') {
    element.textContent = textContent;
  }
  return element;
}

function appendChildren(parent, children) {
  for (const child of children) {
    parent.appendChild(child);
  }
  return parent;
}

function afterInitialPaint(callback) {
  if (typeof window === 'undefined') {
    callback();
    return;
  }
  if (typeof window.requestAnimationFrame === 'function') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(callback);
    });
    return;
  }
  window.setTimeout(callback, 32);
}

export function createDefaultBootShellElement(
  themeId,
  {
    shellId = '',
    fadeMs = 420,
  } = {},
) {
  const presentation = getThemeBootPresentation(themeId, DEFAULT_THEME_ID);
  const shell = document.createElement('div');
  if (shellId) {
    shell.id = shellId;
  }
  shell.dataset.themeId = presentation.themeId;
  shell.className = `theme-boot-screen theme-boot-screen--${presentation.motif}`;
  shell.style.cssText = [
    getThemeBootStyleText(presentation),
    'opacity:1',
    `transition:opacity ${fadeMs}ms ease`,
  ].join(';');

  const style = document.createElement('style');
  style.setAttribute('data-boot-shell-styles', '1');
  style.textContent = THEME_BOOT_SCREEN_CSS;

  const core = createElement('div', 'theme-boot-screen__core');
  for (const suffix of ['a', 'b', 'c']) {
    core.appendChild(createElement('div', `theme-boot-screen__track theme-boot-screen__track--${suffix}`));
  }
  core.appendChild(createElement('div', 'theme-boot-screen__glyph', presentation.glyph));

  const dots = createElement('span', 'theme-boot-screen__dots');
  for (let index = 0; index < 3; index += 1) {
    dots.appendChild(createElement('span'));
  }

  const status = createElement('div', 'theme-boot-screen__status');
  status.appendChild(createElement('span', '', presentation.status));
  status.appendChild(dots);

  const stage = createElement('div', 'theme-boot-screen__stage');
  appendChildren(stage, [
    createElement('div', 'theme-boot-screen__eyebrow', presentation.eyebrow),
    core,
    createElement('div', 'theme-boot-screen__title', presentation.title),
    createElement('div', 'theme-boot-screen__subtitle', presentation.subtitle),
    status,
  ]);

  appendChildren(shell, [
    style,
    createElement('div', 'theme-boot-screen__backdrop'),
    createElement('div', 'theme-boot-screen__grain'),
    createElement('div', 'theme-boot-screen__scan'),
    stage,
  ]);

  document.body.appendChild(shell);
  attachThemeBootShellRendererReadyPromise(shell, new Promise((resolve) => {
    afterInitialPaint(() => {
      resolve({
        status: THEME_BOOT_SHELL_RENDERER_STATUS.FIRST_FRAME,
        degraded: false,
        source: 'default_static_boot_shell',
        themeId: presentation.themeId,
      });
    });
  }));
  return shell;
}

export default createDefaultBootShellElement;
