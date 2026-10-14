export const AI_TASK_PROTOCOL_VERSION = 1;

export const AI_TONES = Object.freeze({
  CALM: 'calm',
  CLINICAL: 'clinical',
  DIRECT: 'direct',
});

const AI_TONE_SET = new Set(Object.values(AI_TONES));
const AI_TASK_REQUEST_FIELDS = Object.freeze([
  'protocolVersion',
  'taskId',
  'locale',
  'tone',
  'source',
  'input',
  'policy',
  'outputSchemaId',
]);

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const canonicalKeys = [...expectedKeys].sort();
  return actualKeys.length === canonicalKeys.length
    && actualKeys.every((key, index) => key === canonicalKeys[index]);
}

function normalizeLocale(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!/^[a-z]{2}(-[a-z0-9]{2,8})?$/.test(normalized)) {
    throw new Error('AI_TASK_REQUEST_LOCALE_INVALID');
  }
  return normalized;
}

function normalizeTone(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!AI_TONE_SET.has(normalized)) {
    throw new Error('AI_TASK_REQUEST_TONE_INVALID');
  }
  return normalized;
}

function clonePlainObject(value, fieldName) {
  if (!isPlainObject(value)) {
    throw new Error(`AI_TASK_REQUEST_OBJECT_INVALID:${fieldName}`);
  }
  return { ...value };
}

export function createAiTaskRequest({
  taskId,
  locale = 'en',
  tone = AI_TONES.CALM,
  source = {},
  input = {},
  policy = {},
  outputSchemaId,
} = {}) {
  if (typeof taskId !== 'string' || !taskId.trim()) {
    throw new Error('AI task request requires a taskId.');
  }
  if (typeof outputSchemaId !== 'string' || !outputSchemaId.trim()) {
    throw new Error('AI task request requires an outputSchemaId.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('AI task request input must be a plain object.');
  }

  return Object.freeze({
    protocolVersion: AI_TASK_PROTOCOL_VERSION,
    taskId: taskId.trim(),
    locale: normalizeLocale(locale),
    tone: normalizeTone(tone),
    source: Object.freeze(clonePlainObject(source, 'source')),
    input: Object.freeze(clonePlainObject(input, 'input')),
    policy: Object.freeze(clonePlainObject(policy, 'policy')),
    outputSchemaId: outputSchemaId.trim(),
  });
}

export function validateAiTaskRequest(request) {
  if (!isPlainObject(request)) {
    return { ok: false, code: 'request_not_object' };
  }
  if (!hasExactKeys(request, AI_TASK_REQUEST_FIELDS)) {
    return { ok: false, code: 'request_shape_invalid' };
  }
  if (request.protocolVersion !== AI_TASK_PROTOCOL_VERSION) {
    return { ok: false, code: 'protocol_version_mismatch' };
  }
  if (typeof request.taskId !== 'string' || !request.taskId.trim()) {
    return { ok: false, code: 'task_id_missing' };
  }
  if (request.taskId.trim() !== request.taskId) {
    return { ok: false, code: 'task_id_noncanonical' };
  }
  try {
    if (normalizeLocale(request.locale) !== request.locale) {
      return { ok: false, code: 'locale_noncanonical' };
    }
  } catch (_) {
    return { ok: false, code: 'locale_invalid' };
  }
  if (!AI_TONE_SET.has(request.tone)) {
    return { ok: false, code: 'tone_invalid' };
  }
  if (!isPlainObject(request.source)) {
    return { ok: false, code: 'source_not_object' };
  }
  if (!isPlainObject(request.input)) {
    return { ok: false, code: 'input_not_object' };
  }
  if (!isPlainObject(request.policy)) {
    return { ok: false, code: 'policy_not_object' };
  }
  if (typeof request.outputSchemaId !== 'string' || !request.outputSchemaId.trim()) {
    return { ok: false, code: 'output_schema_missing' };
  }
  if (request.outputSchemaId.trim() !== request.outputSchemaId) {
    return { ok: false, code: 'output_schema_noncanonical' };
  }
  return { ok: true, code: 'ok' };
}
