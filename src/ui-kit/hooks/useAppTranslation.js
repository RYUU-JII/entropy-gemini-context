import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useResolvedThemeState } from '@/themes/core/react/useResolvedThemeState.js';

export function useAppTranslation(ns = 'common') {
    const translation = useTranslation(ns);
    const { t: baseT } = translation;
    const { themeId } = useResolvedThemeState();

    const t = useCallback(
        (key, options = {}) => {
            const safeOptions = options && typeof options === 'object' ? options : {};
            if (Object.prototype.hasOwnProperty.call(safeOptions, 'context')) {
                return baseT(key, safeOptions);
            }
            return baseT(key, {
                ...safeOptions,
                context: themeId,
            });
        },
        [baseT, themeId]
    );

    return {
        ...translation,
        t,
        themeId,
    };
}

export default useAppTranslation;
