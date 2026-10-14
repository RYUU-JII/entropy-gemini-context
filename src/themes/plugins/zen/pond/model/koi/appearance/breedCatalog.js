import { PALETTES } from '../constants.js';
import { normalizeHexColor } from './colorMath.js';

const buildCatalogEntry = (palette, index) => {
    const body = normalizeHexColor(palette?.body);
    const pattern = normalizeHexColor(palette?.pattern);
    const secondary = normalizeHexColor(palette?.secondary);
    const accent = normalizeHexColor(palette?.accent) || pattern || body;
    const fin = normalizeHexColor(palette?.fin) || body;
    const tail = normalizeHexColor(palette?.tail) || fin;

    return Object.freeze({
        id: String(palette?.id || `palette_${index}`),
        index,
        name: String(palette?.name || `Palette ${index}`),
        group: String(palette?.group || ''),
        style: String(palette?.style || 'patches'),
        rarity: String(palette?.rarity || 'common'),
        palette,
        colors: Object.freeze({
            body,
            pattern,
            secondary: secondary || null,
            accent,
            fin,
            tail,
        }),
    });
};

const getKoiBreedCatalog = (palettePool = PALETTES.elegant) => {
    const pool = Array.isArray(palettePool) ? palettePool : [];
    return Object.freeze(
        pool
            .map((palette, index) => buildCatalogEntry(palette, index))
            .filter((entry) => !!entry.colors.body),
    );
};

export {
    getKoiBreedCatalog,
};
