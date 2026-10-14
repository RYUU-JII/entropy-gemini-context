export function createFirstSiteRegistrationFeedback(result) {
  if (result?.ok !== true || typeof result.domain !== 'string' || !result.domain) {
    throw new Error('FIRST_SITE_REGISTRATION_FEEDBACK_RECEIPT_INVALID');
  }
  return Object.freeze({ domain: result.domain,
    protectionApplied: result.propagation?.status === 'succeeded' });
}
