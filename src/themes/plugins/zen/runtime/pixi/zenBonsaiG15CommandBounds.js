/**
 * Painted extent of one G15.4 scene command.
 *
 * The Pixi bake turns runs of commands into sprites, and a sprite needs a
 * rectangle to be baked into. Reading that rectangle off the command stream is
 * the only way to get it without painting first: the alternative — bake every
 * run at full canvas size and let the transparent margin sort itself out —
 * multiplies a hundred-odd runs by the whole surface and runs into hundreds of
 * megabytes of texture for a tree that occupies a fraction of it.
 *
 * Bounds are deliberately generous. A brush lays ink outside the geometry it
 * was given — the wet bleed rings, the band overlap, the antialiased edge — so
 * every stroke is padded past its centreline extent. Too large only wastes a
 * little texture; too small clips the mark and shows as a cut-off stroke.
 */

const BRUSH_PADDING_MINIMUM = 5;
// The wet halo reaches `BLEED_RINGS[0].spread` past the half width, and the
// band overlap and antialiasing add a little more on top of that.
const BRUSH_PADDING_RATIO = 0.7;
// Text only appears on debug overlays, where an over-wide box costs nothing
// and a clipped label would be misread as a rendering fault.
const TEXT_PADDING_X = 420;
const TEXT_PADDING_Y = 48;

const isFiniteNumber = (value) => Number.isFinite(Number(value));

const createEmptyBox = () => ({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
});

const includePoint = (box, x, y, padding = 0) => {
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return;
    const numericX = Number(x);
    const numericY = Number(y);
    if (numericX - padding < box.minX) box.minX = numericX - padding;
    if (numericY - padding < box.minY) box.minY = numericY - padding;
    if (numericX + padding > box.maxX) box.maxX = numericX + padding;
    if (numericY + padding > box.maxY) box.maxY = numericY + padding;
};

const includePolygon = (box, points, padding = 0) => {
    if (!Array.isArray(points)) return;
    points.forEach((point) => includePoint(box, point?.x, point?.y, padding));
};

/**
 * Grows `box` to cover everything one command paints.
 *
 * Unknown command types deliberately throw rather than contributing nothing: a
 * command that paints outside the box it declared is invisible in the bake and
 * would be diagnosed as a missing branch rather than a missing bounds rule.
 */
export const growZenBonsaiG15CommandBounds = (box, command) => {
    switch (command?.type) {
        case 'fillRect': {
            const x = Number(command.x) || 0;
            const y = Number(command.y) || 0;
            includePoint(box, x, y);
            includePoint(box, x + (Number(command.width) || 0), y + (Number(command.height) || 0));
            return box;
        }
        case 'polygon': {
            const strokePadding = (Number(command.lineWidth) || 0) * 0.5 + 1;
            includePolygon(box, command.points, strokePadding);
            return box;
        }
        case 'line': {
            const strokePadding = (Number(command.lineWidth) || 0) * 0.5 + 1;
            includePolygon(box, command.points, strokePadding);
            return box;
        }
        case 'circle': {
            const radius = (Number(command.r) || 0)
                + ((Number(command.lineWidth) || 0) * 0.5) + 1;
            includePoint(box, command.x, command.y, radius);
            return box;
        }
        case 'inkRibbon': {
            if (!Array.isArray(command.points)) return box;
            command.points.forEach((point) => {
                const halfWidth = Math.max(0, Number(point?.w) || 0);
                const padding = Math.max(
                    BRUSH_PADDING_MINIMUM,
                    halfWidth * (1 + BRUSH_PADDING_RATIO),
                );
                includePoint(box, point?.x, point?.y, padding);
            });
            return box;
        }
        case 'inkWash': {
            const radiusX = Math.max(0, Number(command.rx) || 0);
            const radiusY = Math.max(0, Number(command.ry) || 0);
            const x = Number(command.x) || 0;
            const y = Number(command.y) || 0;
            includePoint(box, x - radiusX, y - radiusY, 1);
            includePoint(box, x + radiusX, y + radiusY, 1);
            return box;
        }
        case 'projectedSakuraBlossom': {
            // The sprite is drawn centred and rotated, so its own diagonal is
            // the reach.
            const reach = (Math.max(0, Number(command.drawSize) || 0) * Math.SQRT1_2) + 2;
            includePoint(box, command.x, command.y, reach);
            return box;
        }
        case 'text': {
            includePoint(box, Number(command.x) || 0, Number(command.y) || 0);
            box.minX -= TEXT_PADDING_X;
            box.maxX += TEXT_PADDING_X;
            box.minY -= TEXT_PADDING_Y;
            box.maxY += TEXT_PADDING_Y;
            return box;
        }
        default:
            throw new Error(
                `ZEN_BONSAI_G15_PIXI_COMMAND_BOUNDS_UNSUPPORTED:${command?.type || 'missing'}`,
            );
    }
};

/**
 * Integer pixel rectangle covering a run of commands, or null when the run
 * paints nothing measurable.
 */
export const resolveZenBonsaiG15CommandRunBounds = (commands, {
    offsetX = 0,
    offsetY = 0,
    clip = null,
} = {}) => {
    if (!Array.isArray(commands) || commands.length === 0) return null;
    const box = createEmptyBox();
    commands.forEach((command) => growZenBonsaiG15CommandBounds(box, command));
    if (!Number.isFinite(box.minX) || !Number.isFinite(box.maxX)) return null;

    let minX = Math.floor(box.minX + offsetX);
    let minY = Math.floor(box.minY + offsetY);
    let maxX = Math.ceil(box.maxX + offsetX);
    let maxY = Math.ceil(box.maxY + offsetY);

    if (clip) {
        minX = Math.max(minX, Math.floor(clip.x));
        minY = Math.max(minY, Math.floor(clip.y));
        maxX = Math.min(maxX, Math.ceil(clip.x + clip.width));
        maxY = Math.min(maxY, Math.ceil(clip.y + clip.height));
    }

    const width = maxX - minX;
    const height = maxY - minY;
    if (!(width > 0) || !(height > 0)) return null;
    return {
        x: minX, y: minY, width, height,
    };
};

export default resolveZenBonsaiG15CommandRunBounds;
