import { BaseTexture, Texture } from './zenPondPixiRuntime.js';

// Geometry is replayed into this context before material/AO is composited.
// It deliberately does not derive a silhouette from a finished sprite's alpha.
export const createZenGeometryMaskContext = (context) => new Proxy(context, {
    get(target, name) {
        if (name === 'zenGeometryMask') return true;
        if (name === 'drawImage') return () => { throw new Error('ZEN_DECOR_MASK_RASTER_COPY_FORBIDDEN'); };
        if (name === 'stroke') return () => {};
        const value = target[name];
        return typeof value === 'function' ? value.bind(target) : value;
    },
    set(target, name, value) {
        if (name === 'fillStyle' || name === 'strokeStyle') target[name] = '#ffffff';
        else if (name === 'globalAlpha') target[name] = 1;
        else if (name === 'globalCompositeOperation') target[name] = 'source-over';
        else if (name === 'shadowBlur') target[name] = 0;
        else if (name === 'filter') target[name] = 'none';
        else if (name === 'shadowColor') target[name] = 'transparent';
        else target[name] = value;
        return true;
    },
});

export const createZenDecorGeometryCanvas = ({ width, height, draw }) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('ZEN_DECOR_MASK_CONTEXT_REQUIRED');
    const mask = createZenGeometryMaskContext(context);
    mask.fillStyle = '#ffffff';
    mask.translate(width * 0.5, height * 0.5);
    draw(mask);
    context.resetTransform();
    return canvas;
};

export const createZenDecorGeometryMask = ({ ownedTextures, width, height, draw }) => {
    const canvas = createZenDecorGeometryCanvas({ width, height, draw });
    const texture = new Texture(new BaseTexture(canvas));
    ownedTextures.add(texture);
    return texture;
};
