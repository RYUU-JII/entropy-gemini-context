/**
 * CLSE Detection Module - Entry Point
 * 
 * Aggregates all detection components for the Cognitive Load Sensing Engine.
 */

export { BaselineManager } from './BaselineManager.js';
export { LoadSpikeDetector } from './LoadSpikeDetector.js';
export { SustainedLoadDetector } from './SustainedLoadDetector.js';
export { LoopDetector } from './LoopDetector.js';
export {
    scoreScrollAggression,
    scoreNavAggression,
    scoreTabAggression,
    scoreMediaAggression,
    scoreCLSEBucketAggression,
} from './BehaviorAggressionScorer.js';
