/**
 * CLSE Collectors - Entry Point
 * 
 * Aggregates all event collectors for the Cognitive Load Sensing Engine.
 * Collectors gather browser events and feed them into the 10-second ring buffer.
 */

import { TabCollector } from './TabCollector.js';
import { NavCollector } from './NavCollector.js';
import { ScrollCollector } from './ScrollCollector.js';
import { ContentCollector } from './ContentCollector.js';
import { MediaCollector } from './MediaCollector.js';
import { ActivityCollector } from './ActivityCollector.js';

export { TabCollector } from './TabCollector.js';
export { NavCollector } from './NavCollector.js';
export { ScrollCollector } from './ScrollCollector.js';
export { ContentCollector } from './ContentCollector.js';
export { MediaCollector } from './MediaCollector.js';
export { ActivityCollector } from './ActivityCollector.js';

/**
 * Initialize all collectors with a shared bucket reference
 * @param {Object} ringBuffer - Reference to the 10-second ring buffer
 * @param {Object} options - Optional configuration
 * @param {Function} options.onNavigation - Callback for navigation events (for loop detection)
 * @returns {Object} - Object containing all collector instances
 */
export function initializeCollectors(ringBuffer, options = {}) {
    const browserPort = options.browserPort;
    const profileMutationRuntimeAdmission = options.profileMutationRuntimeAdmission;
    const onRuntimeMutationCommitted = options.onRuntimeMutationCommitted;
    const collectors = {
        tab: new TabCollector(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted }),
        nav: new NavCollector(ringBuffer, {
            browserPort,
            onNavigation: options.onNavigation,
            profileMutationRuntimeAdmission,
            onRuntimeMutationCommitted,
        }),
        scroll: new ScrollCollector(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted }),
        content: new ContentCollector(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted }),
        media: new MediaCollector(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted }),
        activity: new ActivityCollector(ringBuffer, { browserPort, profileMutationRuntimeAdmission, onRuntimeMutationCommitted }),
    };

    return {
        collectors,
        startAll: () => Promise.all(Object.values(collectors).map((collector) => (
            Promise.resolve(collector.start?.())
        ))),
        stopAll: () => Promise.all(Object.values(collectors).map((collector) => (
            Promise.resolve(collector.stop?.())
        ))),
    };
}
