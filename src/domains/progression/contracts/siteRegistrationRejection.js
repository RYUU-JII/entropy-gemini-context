export const SITE_REGISTRATION_LIMIT_ERROR_CODE = 'PROGRESSION_SITE_REGISTRATION_LIMIT_REACHED';

function isLimitRejection(source) {
  return source?.error === SITE_REGISTRATION_LIMIT_ERROR_CODE
    || source?.code === SITE_REGISTRATION_LIMIT_ERROR_CODE
    || source?.message === SITE_REGISTRATION_LIMIT_ERROR_CODE;
}

// Both the owner Error and the public failure response use this exact detail
// contract. UI never reconstructs a budget or an unlock date from a message.
export function requireSiteRegistrationRejectionDetails(source) {
  if (!isLimitRejection(source)) return null;
  const budget = source.siteRegistrationBudget;
  const day = source.qualifiedUseDayCount;
  const nextDay = source.nextIncreaseDay;
  if (!budget || typeof budget !== 'object' || Array.isArray(budget)
    || Object.keys(budget).length !== 2 || budget.mode !== 'limited'
    || !Number.isSafeInteger(budget.limit) || budget.limit < 1
    || !Number.isSafeInteger(day) || day < 0
    || !Number.isSafeInteger(nextDay) || nextDay <= day) {
    throw new Error('SITE_REGISTRATION_REJECTION_INVALID');
  }
  return Object.freeze({
    siteRegistrationBudget: Object.freeze({ mode: 'limited', limit: budget.limit }),
    qualifiedUseDayCount: day,
    nextIncreaseDay: nextDay,
  });
}

export function buildSiteRegistrationRejectionResponse(error) {
  if (!isLimitRejection(error)) return null;
  try {
    return { success: false, error: SITE_REGISTRATION_LIMIT_ERROR_CODE,
      ...requireSiteRegistrationRejectionDetails(error) };
  } catch (failure) {
    // The runtime handler's failure adapter must still complete its response.
    // Malformed owner data is a named contract failure, never inferred guidance.
    if (failure.message !== 'SITE_REGISTRATION_REJECTION_INVALID') throw failure;
    return { success: false, error: failure.message };
  }
}

export function createSiteRegistrationLimitError(details) {
  const error = new Error(SITE_REGISTRATION_LIMIT_ERROR_CODE);
  error.code = SITE_REGISTRATION_LIMIT_ERROR_CODE;
  Object.assign(error, requireSiteRegistrationRejectionDetails({ code: error.code, ...details }));
  return error;
}
