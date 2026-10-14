function resolveThemeAwareTranslation(t, baseKey, themeId = '') {
  const normalizedThemeId = typeof themeId === 'string' ? themeId.trim() : '';
  if (normalizedThemeId) {
    const variantKey = `${baseKey}_${normalizedThemeId}`;
    const variantValue = t(variantKey);
    if (typeof variantValue === 'string' && variantValue !== variantKey) {
      return variantValue;
    }
  }

  const baseValue = t(baseKey);
  return typeof baseValue === 'string' && baseValue !== baseKey ? baseValue : '';
}

export function buildToolsArtifactDisplayCopy(shell, t) {
  const artifactTitle = shell?.artifactTitleKey
    ? resolveThemeAwareTranslation(t, shell.artifactTitleKey, shell?.themeId)
    : '';
  const manifestationTitle = shell?.manifestationKey
    ? resolveThemeAwareTranslation(t, `artifacts.${shell.manifestationKey}.title`, shell?.themeId)
    : '';
  const familySubtitleKey = shell?.artifactId ? `artifacts.${shell.artifactId}.subtitle` : '';
  const familySubtitleValue = familySubtitleKey
    ? resolveThemeAwareTranslation(t, familySubtitleKey, shell?.themeId)
    : '';
  const familySubtitle = familySubtitleValue && familySubtitleValue !== familySubtitleKey
    ? familySubtitleValue
    : '';
  const subtitle = manifestationTitle && manifestationTitle !== artifactTitle
    ? manifestationTitle
    : ((familySubtitle && familySubtitle !== artifactTitle) ? familySubtitle : '');

  return {
    title: artifactTitle || manifestationTitle,
    subtitle,
    description: shell?.artifactDescriptionKey
      ? resolveThemeAwareTranslation(t, shell.artifactDescriptionKey, shell?.themeId)
      : (
        shell?.manifestationKey
          ? resolveThemeAwareTranslation(t, `artifacts.${shell.manifestationKey}.desc`, shell?.themeId)
          : ''
      ),
  };
}
