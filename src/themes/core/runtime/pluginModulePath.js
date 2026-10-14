export function resolveThemePluginModuleKey(themeId, modulePath) {
    if (typeof themeId !== 'string' || !themeId.trim()) return null;
    if (typeof modulePath !== 'string' || !modulePath.trim()) return null;

    const cleanThemeId = themeId.trim();
    const cleanPath = modulePath.trim();
    if (!cleanPath.startsWith('./')) {
        return null;
    }

    const relativePath = cleanPath.slice(2);
    if (!relativePath || relativePath.includes('..')) {
        return null;
    }

    return `../../plugins/${cleanThemeId}/${relativePath}`;
}
