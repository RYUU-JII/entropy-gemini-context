import { startBackgroundAppKernel } from './runtime/BackgroundAppKernel.js';

export function startTrackingService() {
    return startBackgroundAppKernel();
}
