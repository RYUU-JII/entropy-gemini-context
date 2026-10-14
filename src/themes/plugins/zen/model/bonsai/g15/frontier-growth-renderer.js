/** Canvas2D executor for G15.4 typed developmental scene commands. */
import { paintProjectedSakuraBlossom } from './ZenBonsaiG15TerminalMorphology.js';

(function installRecursiveAxisRenderer(scope) {
    'use strict';

    const CONTRACT_ID = 'g15_4_typed_developmental_scheduler_canvas_executor_v1';

    function sceneOwner() {
        const owner = scope.ZenBonsaiTypedDevelopmentalSchedulerScene;
        if (!owner || typeof owner.buildSceneCommands !== 'function') {
            throw new Error(
                '[G15.4_RENDERER] ZenBonsaiTypedDevelopmentalSchedulerScene must be loaded before rendering.',
            );
        }
        return owner;
    }

    function executeFillRect(context, command) {
        context.fillStyle = command.fill;
        context.fillRect(command.x, command.y, command.width, command.height);
    }

    function tracePoints(context, points, closePath) {
        if (!points?.length) return false;
        context.beginPath();
        context.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
        if (closePath) context.closePath();
        return true;
    }

    function applyStroke(context, command) {
        if (!command.stroke || !Number.isFinite(Number(command.lineWidth))) return;
        context.strokeStyle = command.stroke;
        context.lineWidth = Number(command.lineWidth);
        context.lineCap = command.lineCap || 'butt';
        context.lineJoin = command.lineJoin || 'round';
        if (Array.isArray(command.dash) && typeof context.setLineDash === 'function') {
            context.setLineDash(command.dash);
        }
        context.stroke();
    }

    function executePolygon(context, command) {
        if (!tracePoints(context, command.points, true)) return;
        if (command.fill) {
            context.fillStyle = command.fill;
            context.fill();
        }
        applyStroke(context, command);
    }

    function executeCircle(context, command) {
        context.beginPath();
        context.arc(command.x, command.y, command.r, 0, Math.PI * 2);
        if (command.fill) {
            context.fillStyle = command.fill;
            context.fill();
        }
        applyStroke(context, command);
    }

    function inkRibbonOwner() {
        const owner = scope.ZenBonsaiInkRibbonBrush;
        if (!owner || typeof owner.paintInkRibbon !== 'function') {
            throw new Error(
                '[G15.4_RENDERER] ZenBonsaiInkRibbonBrush must be loaded before rendering ink ribbons.',
            );
        }
        return owner;
    }

    // The brush is the style; the command is only the stroke.
    let activeBrushStyle = 'ink';
    let activeCanopyWashScale = 1;

    function executeInkRibbon(context, command) {
        inkRibbonOwner().paintInkRibbon(context, command, activeBrushStyle);
    }

    function executeInkWash(context, command) {
        inkRibbonOwner().paintInkWash(context, command, activeCanopyWashScale);
    }

    function executeLine(context, command) {
        if (!tracePoints(context, command.points, false)) return;
        applyStroke(context, command);
    }

    function executeText(context, command) {
        context.fillStyle = command.fill;
        context.font = command.font || '10px sans-serif';
        context.textAlign = command.align || 'left';
        context.textBaseline = command.baseline || 'alphabetic';
        if (Number.isFinite(Number(command.maxWidth))) {
            context.fillText(command.text, command.x, command.y, command.maxWidth);
        } else {
            context.fillText(command.text, command.x, command.y);
        }
    }

    const PROJECTED_BLOSSOM_ATLAS_SIZE = 96;
    const PROJECTED_BLOSSOM_LOGICAL_SIZE = 64;
    const projectedBlossomSprites = new Map();

    function createAtlasCanvas() {
        if (scope.document?.createElement) {
            const canvas = scope.document.createElement('canvas');
            canvas.width = PROJECTED_BLOSSOM_ATLAS_SIZE;
            canvas.height = PROJECTED_BLOSSOM_ATLAS_SIZE;
            return canvas;
        }
        if (typeof scope.OffscreenCanvas === 'function') {
            return new scope.OffscreenCanvas(
                PROJECTED_BLOSSOM_ATLAS_SIZE,
                PROJECTED_BLOSSOM_ATLAS_SIZE,
            );
        }
        throw new Error('[G15.4_RENDERER] Projected blossom atlas canvas is unavailable.');
    }

    function resolveProjectedBlossomSprite(command) {
        const key = `${command.color}:${command.atlasId}`;
        if (projectedBlossomSprites.has(key)) return projectedBlossomSprites.get(key);
        const canvas = createAtlasCanvas();
        const context = canvas.getContext?.('2d');
        if (!context) {
            projectedBlossomSprites.set(key, canvas);
            return canvas;
        }
        const assetScale = PROJECTED_BLOSSOM_ATLAS_SIZE / PROJECTED_BLOSSOM_LOGICAL_SIZE;
        context.translate(
            PROJECTED_BLOSSOM_ATLAS_SIZE * 0.5,
            PROJECTED_BLOSSOM_ATLAS_SIZE * 0.5,
        );
        context.scale(assetScale, assetScale);
        paintProjectedSakuraBlossom(context, {
            color: command.color,
            blossom: command.blossom,
            removeDotSpecks: true,
        });
        projectedBlossomSprites.set(key, canvas);
        return canvas;
    }

    function executeProjectedSakuraBlossom(context, command) {
        const sprite = resolveProjectedBlossomSprite(command);
        const drawSize = Number(command.drawSize);
        if (!(drawSize > 0)) {
            throw new TypeError('[G15.4_RENDERER] Projected blossom drawSize must be positive.');
        }
        context.translate(Number(command.x), Number(command.y));
        context.rotate(Number(command.screenRoll) || 0);
        context.scale(command.mirrorX ? -1 : 1, 1);
        context.globalAlpha *= Number.isFinite(Number(command.alpha))
            ? Number(command.alpha)
            : 1;
        context.imageSmoothingEnabled = true;
        if ('imageSmoothingQuality' in context) context.imageSmoothingQuality = 'high';
        context.drawImage(sprite, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
    }

    const EXECUTORS = Object.freeze({
        fillRect: executeFillRect,
        polygon: executePolygon,
        circle: executeCircle,
        line: executeLine,
        inkRibbon: executeInkRibbon,
        inkWash: executeInkWash,
        text: executeText,
        projectedSakuraBlossom: executeProjectedSakuraBlossom,
    });

    /**
     * Applies the scene's light to one command's colours.
     *
     * The command stream carries neutral ink values so the plan stays
     * light-independent and cacheable; the caller supplies `mapColor` to paint
     * those values in the world's current light. Without a map the stream is
     * drawn exactly as authored.
     */
    function tintedCommand(command, mapColor, mapAccentColor, mapMassColor) {
        if (typeof mapColor !== 'function') return command;
        // Blossoms carry the composition's accent and take a lighter touch, so
        // they get their own map rather than the wood's.
        if (command.color) {
            const accent = (mapAccentColor || mapColor)(command.color);
            return accent === command.color ? command : { ...command, color: accent };
        }
        // The canopy wash carries the accent hue but not the accent's fight for
        // legibility against the sky — it is an implied mass, not a subject.
        if (command.mass === true && mapMassColor) {
            const fill = command.fill ? mapMassColor(command.fill) : command.fill;
            return fill === command.fill ? command : { ...command, fill };
        }
        // Marks that carry the composition's chroma opt into the lighter map
        // so the accent survives the light instead of being greyed with the wood.
        const paint = (command.accent === true && mapAccentColor) ? mapAccentColor : mapColor;
        const fill = command.fill ? paint(command.fill) : command.fill;
        const stroke = command.stroke ? paint(command.stroke) : command.stroke;
        if (fill === command.fill && stroke === command.stroke) return command;
        return { ...command, fill, stroke };
    }

    function executeCommands(context, scene, options = {}) {
        if (!context || !scene || !Array.isArray(scene.commands)) {
            throw new TypeError('[G15.4_RENDERER] context and scene.commands are required.');
        }
        const mapColor = typeof options.mapColor === 'function' ? options.mapColor : null;
        const mapAccentColor = typeof options.mapAccentColor === 'function'
            ? options.mapAccentColor
            : null;
        const mapMassColor = typeof options.mapMassColor === 'function'
            ? options.mapMassColor
            : null;
        const transformFor = typeof options.motion?.transformFor === 'function'
            ? options.motion.transformFor
            : null;
        activeBrushStyle = typeof options.brushStyle === 'string' ? options.brushStyle : 'ink';
        activeCanopyWashScale = Number.isFinite(Number(options.canopyWashScale))
            ? Number(options.canopyWashScale)
            : 1;
        scene.commands.forEach((rawCommand) => {
            const execute = EXECUTORS[rawCommand.type];
            if (!execute) {
                throw new Error(`[G15.4_RENDERER] Unsupported scene command: ${rawCommand.type}`);
            }
            context.save();
            // Marks tagged with a rig part turn with it. Everything else — the
            // nebari, the soil contact, the pot — belongs to the ground and
            // stays put.
            const motion = transformFor ? transformFor(rawCommand.rig) : null;
            if (motion) {
                // One rigid world transform, already composed down the rig chain.
                // Rotating about this mark's own pivot here would drop every
                // ancestor's motion and leave the branch turning about a joint
                // that has itself moved.
                context.transform(
                    motion.cos,
                    motion.sin,
                    -motion.sin,
                    motion.cos,
                    motion.tx,
                    motion.ty,
                );
            }
            // Brush/atlas owners apply their own alpha. Primitive organ marks
            // need the same envelope here, once, inside this saved context.
            if (['fillRect', 'polygon', 'circle', 'line', 'text'].includes(rawCommand.type)
                && rawCommand.alpha !== undefined) {
                if (!Number.isFinite(rawCommand.alpha) || rawCommand.alpha < 0 || rawCommand.alpha > 1) {
                    throw new Error('[G15.4_RENDERER] Primitive alpha must be from 0 to 1.');
                }
                context.globalAlpha *= rawCommand.alpha;
            }
            execute(context, tintedCommand(rawCommand, mapColor, mapAccentColor, mapMassColor));
            context.restore();
        });
        return scene;
    }

    function resolveCanvasSize(canvas, options) {
        const rect = typeof canvas.getBoundingClientRect === 'function'
            ? canvas.getBoundingClientRect()
            : null;
        return {
            width: Math.max(64, Math.round(Number(
                options.width
                    ?? rect?.width
                    ?? canvas.clientWidth
                    ?? canvas.width
                    ?? 900,
            ))),
            height: Math.max(64, Math.round(Number(
                options.height
                    ?? rect?.height
                    ?? canvas.clientHeight
                    ?? canvas.height
                    ?? 900,
            ))),
        };
    }

    function prepareCanvas(canvas, width, height, options) {
        const pixelRatio = Math.max(1, Math.min(3, Number(
            options.pixelRatio ?? scope.devicePixelRatio ?? 1,
        ) || 1));
        const pixelWidth = Math.round(width * pixelRatio);
        const pixelHeight = Math.round(height * pixelRatio);
        if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
        if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('[G15.4_RENDERER] Canvas 2D context unavailable.');
        }
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, width, height);
        return context;
    }

    function render(canvas, graph, options = {}) {
        if (!canvas || !graph) {
            throw new TypeError('[G15.4_RENDERER] canvas and graph are required.');
        }
        const size = resolveCanvasSize(canvas, options);
        const owner = sceneOwner();
        const scene = owner.buildSceneCommands(graph, {
            ...options,
            width: size.width,
            height: size.height,
        });
        const context = prepareCanvas(canvas, size.width, size.height, options);
        executeCommands(context, scene);
        return Object.freeze({
            ...scene,
            scene,
            description: scene.description,
        });
    }

    scope.ZenBonsaiTypedDevelopmentalSchedulerRenderer = Object.freeze({
        contractId: CONTRACT_ID,
        get modes() {
            return sceneOwner().modes;
        },
        render,
        executeCommands,
        describeEvent(event) {
            return sceneOwner().describeEvent(event);
        },
    });
    scope.ZenBonsaiTypedDevelopmentalSchedulerCanvasExecutor =
        scope.ZenBonsaiTypedDevelopmentalSchedulerRenderer;
}(globalThis));
