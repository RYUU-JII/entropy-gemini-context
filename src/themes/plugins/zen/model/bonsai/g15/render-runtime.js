/**
 * G15.4 graph-to-scene runtime.
 *
 * This entry deliberately excludes graph generation, scheduling, inspection,
 * and mutation owners. Renderer workers receive an already materialized graph
 * and only need the deterministic presentation pipeline below.
 */
import './ontogenetic-growth-state.js';
import './nebari-presentation.js';
import './ink-ribbon-brush.js';
import './wood-presentation.js';
import './sakura-canopy-twig-volume.js';
import './sakura-terminal-lab-adapter.js';
import './sakura-flowering-presentation.js';
import './pixi-baking-partitioner.js';
import './scene-command-builder.js';
import './frontier-growth-renderer.js';

export const ZenBonsaiScene = globalThis.ZenBonsaiTypedDevelopmentalSchedulerScene;
export const ZenBonsaiCanvasExecutor =
    globalThis.ZenBonsaiTypedDevelopmentalSchedulerCanvasExecutor;
