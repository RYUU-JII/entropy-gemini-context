import { assertCanonicalThemeId } from '../ids.js';
import {
  getBootShellActiveVariant,
  getBootShellModuleByVariant,
} from '../loaders/bootShells.js';
import { createDefaultBootShellElement } from './createDefaultBootShellElement.js';

function resolveBootLoaderVariant(themeId) {
  return getBootShellActiveVariant(themeId);
}

export function createThemeBootShellElement(
  themeId,
  options = {},
) {
  const resolvedThemeId = assertCanonicalThemeId(themeId, 'theme boot shell');
  const variant = resolveBootLoaderVariant(resolvedThemeId);
  const shellModule = getBootShellModuleByVariant(variant, resolvedThemeId);

  if (typeof shellModule?.createBootShellElement === 'function') {
    return shellModule.createBootShellElement({
      ...options,
      themeId: resolvedThemeId,
      variant,
    });
  }

  if (shellModule) {
    throw new Error(
      `[ThemeBootShell] Theme '${resolvedThemeId}' boot shell variant '${variant}' must export createBootShellElement().`,
    );
  }

  return createDefaultBootShellElement(resolvedThemeId, options);
}

export default createThemeBootShellElement;
