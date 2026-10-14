import { BACKGROUNDS, TRANSITIONS } from '../appearance/index.js';

export const getThemeComponent = (type, id) => {
    if (!id) return null;

    switch (type) {
        case 'background':
            return BACKGROUNDS[id] || null;
        case 'transition':
            return TRANSITIONS[id] || null;
        default:
            console.warn(`[ThemeRegistry] Unknown component type: ${type}`);
            return null;
    }
};

export { BACKGROUNDS, TRANSITIONS };
