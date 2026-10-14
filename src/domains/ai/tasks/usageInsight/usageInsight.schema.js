export const USAGE_INSIGHT_NARRATION_SCHEMA_ID = 'usageInsightNarration.v1';

export const USAGE_INSIGHT_NARRATION_RESPONSE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    title: {
      type: 'string',
      minLength: 4,
      maxLength: 90,
    },
    body: {
      type: 'string',
      minLength: 12,
      maxLength: 420,
    },
    suggestions: {
      type: 'array',
      maxItems: 3,
      items: {
        type: 'string',
        minLength: 8,
        maxLength: 180,
      },
    },
    confidence: {
      type: 'string',
      enum: ['low', 'medium', 'high'],
    },
  },
  required: ['title', 'body', 'suggestions', 'confidence'],
  additionalProperties: false,
});
