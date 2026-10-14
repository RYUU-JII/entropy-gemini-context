import { createBackgroundKernelActionHandler } from './backgroundKernelActionHandlerFactory.js';

export function createBackgroundKernelActionMessageBindings(dependencies = {}) {
  return createBackgroundKernelActionHandler(dependencies);
}
