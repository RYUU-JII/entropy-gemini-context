function typeOfJsonValue(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (Number.isInteger(value)) return 'integer';
  return typeof value;
}

function isAllowedType(actualType, expectedType) {
  if (Array.isArray(expectedType)) return expectedType.includes(actualType);
  if (expectedType === 'number') return actualType === 'number' || actualType === 'integer';
  return actualType === expectedType;
}

function formatPath(path) {
  return path || '$';
}

function validateObject(value, schema, path, errors) {
  const properties = schema.properties && typeof schema.properties === 'object'
    ? schema.properties
    : {};
  const required = Array.isArray(schema.required) ? schema.required : [];

  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) {
      errors.push(`${formatPath(path)}.${key} is required`);
    }
  }

  for (const [key, childValue] of Object.entries(value)) {
    const childSchema = properties[key];
    if (!childSchema) {
      if (schema.additionalProperties === false) {
        errors.push(`${formatPath(path)}.${key} is not allowed`);
      }
      continue;
    }
    validateJsonValue(childValue, childSchema, `${formatPath(path)}.${key}`, errors);
  }
}

function validateArray(value, schema, path, errors) {
  if (Number.isFinite(Number(schema.maxItems)) && value.length > Number(schema.maxItems)) {
    errors.push(`${formatPath(path)} exceeds maxItems ${schema.maxItems}`);
  }
  if (Number.isFinite(Number(schema.minItems)) && value.length < Number(schema.minItems)) {
    errors.push(`${formatPath(path)} is below minItems ${schema.minItems}`);
  }
  if (!schema.items) return;
  value.forEach((item, index) => {
    validateJsonValue(item, schema.items, `${formatPath(path)}[${index}]`, errors);
  });
}

function validateString(value, schema, path, errors) {
  if (Number.isFinite(Number(schema.minLength)) && value.length < Number(schema.minLength)) {
    errors.push(`${formatPath(path)} is below minLength ${schema.minLength}`);
  }
  if (Number.isFinite(Number(schema.maxLength)) && value.length > Number(schema.maxLength)) {
    errors.push(`${formatPath(path)} exceeds maxLength ${schema.maxLength}`);
  }
  if (typeof schema.pattern === 'string') {
    const matcher = new RegExp(schema.pattern);
    if (!matcher.test(value)) {
      errors.push(`${formatPath(path)} does not match pattern`);
    }
  }
}

function validateNumber(value, schema, path, errors) {
  if (Number.isFinite(Number(schema.minimum)) && value < Number(schema.minimum)) {
    errors.push(`${formatPath(path)} is below minimum ${schema.minimum}`);
  }
  if (Number.isFinite(Number(schema.maximum)) && value > Number(schema.maximum)) {
    errors.push(`${formatPath(path)} exceeds maximum ${schema.maximum}`);
  }
}

export function validateJsonValue(value, schema, path = '$', errors = []) {
  if (!schema || typeof schema !== 'object') {
    errors.push(`${formatPath(path)} has no schema`);
    return errors;
  }

  if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) {
    errors.push(`${formatPath(path)} must equal schema const`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${formatPath(path)} is not in enum`);
  }

  const actualType = typeOfJsonValue(value);
  if (schema.type && !isAllowedType(actualType, schema.type)) {
    errors.push(`${formatPath(path)} expected ${schema.type}, got ${actualType}`);
    return errors;
  }

  if (actualType === 'object') validateObject(value, schema, path, errors);
  if (actualType === 'array') validateArray(value, schema, path, errors);
  if (actualType === 'string') validateString(value, schema, path, errors);
  if (actualType === 'number' || actualType === 'integer') validateNumber(value, schema, path, errors);

  return errors;
}

export function validateJsonSchemaResult(value, schema) {
  const errors = validateJsonValue(value, schema, '$', []);
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, errors: [] };
}

export function parseAndValidateAiJsonResult(text, schema) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ''));
  } catch (error) {
    return {
      ok: false,
      code: 'json_parse_failed',
      errors: [error?.message || 'Failed to parse model output as JSON.'],
      value: null,
    };
  }

  const validation = validateJsonSchemaResult(parsed, schema);
  if (!validation.ok) {
    return {
      ok: false,
      code: 'schema_validation_failed',
      errors: validation.errors,
      value: parsed,
    };
  }

  return {
    ok: true,
    code: 'ok',
    errors: [],
    value: parsed,
  };
}
