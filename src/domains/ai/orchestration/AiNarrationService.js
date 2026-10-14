import {
  createAiTaskErrorResult,
  createAiTaskOkResult,
  createAiTaskUnavailableResult,
  createAiPreparationErrorResult,
  createAiPreparationOkResult,
  createAiPreparationUnavailableResult,
  isAiProviderReadyForGeneration,
  isAiProviderUsableForPreparation,
  validateAiTaskRequest,
} from '../contracts/index.js';
import { parseAndValidateAiJsonResult } from './AiResultValidator.js';

function normalizeProviderResult(result) {
  if (typeof result === 'string') return { text: result, metadata: {} };
  if (result && typeof result === 'object') {
    return {
      text: typeof result.text === 'string' ? result.text : '',
      metadata: result.metadata && typeof result.metadata === 'object' ? result.metadata : {},
    };
  }
  return { text: '', metadata: {} };
}

function resolveAiErrorCode(error, fallback) {
  if (typeof error?.code === 'string' && error.code.trim()) {
    return error.code.trim();
  }
  if (typeof error?.name === 'string' && error.name.trim() && error.name !== 'Error') {
    return error.name.trim();
  }
  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message.trim();
  }
  return fallback;
}

export function createAiNarrationService({
  taskRegistry,
  provider,
  now = () => Date.now(),
} = {}) {
  if (!taskRegistry || typeof taskRegistry.get !== 'function') {
    throw new Error('AiNarrationService requires a task registry.');
  }
  if (!provider || typeof provider.availability !== 'function' || typeof provider.generate !== 'function') {
    throw new Error('AiNarrationService requires an AI provider.');
  }

  async function getCapabilityForTask(taskId, request = null) {
    const task = taskRegistry.get(taskId);
    if (!task) {
      return {
        providerId: provider.id || '',
        state: 'error',
        reasonCode: 'task_not_registered',
        details: { taskId },
        canCreateSession: false,
        requiresUserActivation: false,
      };
    }
    const providerOptions = typeof task.getProviderOptions === 'function'
      ? task.getProviderOptions(request)
      : {};
    return provider.availability(providerOptions);
  }

  async function generate(request, options = {}) {
    const requestValidation = validateAiTaskRequest(request);
    if (!requestValidation.ok) {
      return createAiTaskErrorResult({
        request,
        providerId: provider.id,
        errorCode: requestValidation.code,
        message: 'AI task request failed validation.',
      });
    }

    const task = taskRegistry.get(request.taskId);
    if (!task) {
      return createAiTaskErrorResult({
        request,
        providerId: provider.id,
        errorCode: 'task_not_registered',
        message: `No AI task is registered for '${request.taskId}'.`,
      });
    }

    const providerOptions = typeof task.getProviderOptions === 'function'
      ? task.getProviderOptions(request)
      : {};
    const availability = await provider.availability(providerOptions);
    if (!isAiProviderReadyForGeneration(availability)) {
      return createAiTaskUnavailableResult({
        request,
        providerId: provider.id,
        availability,
      });
    }

    try {
      const prompt = task.buildPrompt(request);
      const providerResult = normalizeProviderResult(await provider.generate({
        prompt,
        responseSchema: task.responseSchema,
        providerOptions,
        signal: options?.signal || null,
        monitor: options?.monitor || null,
      }));
      const parsed = parseAndValidateAiJsonResult(providerResult.text, task.responseSchema);
      if (!parsed.ok) {
        return createAiTaskErrorResult({
          request,
          providerId: provider.id,
          errorCode: parsed.code,
          message: 'AI provider returned output that did not satisfy the task schema.',
          details: { errors: parsed.errors },
        });
      }
      return createAiTaskOkResult({
        request,
        output: parsed.value,
        providerId: provider.id,
        generatedAt: now(),
        metadata: providerResult.metadata,
      });
    } catch (error) {
      return createAiTaskErrorResult({
        request,
        providerId: provider.id,
        errorCode: resolveAiErrorCode(error, 'ai_generation_failed'),
        message: error?.message || 'AI generation failed.',
      });
    }
  }

  async function prepare(taskId, options = {}) {
    const task = taskRegistry.get(taskId);
    if (!task) {
      return createAiPreparationErrorResult({
        taskId,
        providerId: provider.id,
        errorCode: 'task_not_registered',
        message: `No AI task is registered for '${taskId}'.`,
      });
    }
    if (typeof provider.prepare !== 'function') {
      return createAiPreparationErrorResult({
        taskId,
        providerId: provider.id,
        errorCode: 'provider_prepare_unavailable',
        message: 'AI provider does not expose a model preparation operation.',
      });
    }

    const providerOptionsContext = options?.request && typeof options.request === 'object'
      ? options.request
      : { locale: options?.locale || 'en' };
    const providerOptions = typeof task.getProviderOptions === 'function'
      ? task.getProviderOptions(providerOptionsContext)
      : {};
    const availability = await provider.availability(providerOptions);
    if (!isAiProviderUsableForPreparation(availability)) {
      return createAiPreparationUnavailableResult({
        taskId,
        providerId: provider.id,
        availability,
      });
    }

    try {
      const providerResult = await provider.prepare({
        providerOptions,
        signal: options?.signal || null,
        monitor: options?.monitor || null,
      });
      return createAiPreparationOkResult({
        taskId,
        providerId: provider.id,
        preparedAt: now(),
        metadata: providerResult?.metadata || {},
      });
    } catch (error) {
      return createAiPreparationErrorResult({
        taskId,
        providerId: provider.id,
        errorCode: resolveAiErrorCode(error, 'ai_preparation_failed'),
        message: error?.message || 'AI model preparation failed.',
      });
    }
  }

  return Object.freeze({
    getCapabilityForTask,
    prepare,
    generate,
  });
}
