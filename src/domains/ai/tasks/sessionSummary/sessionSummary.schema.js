export const SESSION_SUMMARY_NARRATION_SCHEMA_ID = 'sessionSummaryNarration.v1';

export const SESSION_SUMMARY_NARRATION_RESPONSE_SCHEMA = Object.freeze({
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
      maxLength: 360,
    },
    suggestions: {
      type: 'array',
      maxItems: 2,
      items: {
        type: 'string',
        minLength: 6,
        maxLength: 140,
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
