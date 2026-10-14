import { MESSAGE_ACTIONS } from '../../../src/platform/messaging/messageTypes.js';

// Optional capture input; normal captures retain their existing language policy.
export async function commitDashboardCaptureLocale(sendMessage, locale) {
  if (locale !== 'en' && locale !== 'ko') throw new Error('QA_DASHBOARD_CAPTURE_LOCALE_INVALID');
  const response = await sendMessage({
    action: MESSAGE_ACTIONS.SET_SETTINGS,
    items: { app_language: locale },
  });
  if (response?.success !== true || response.committedItems?.app_language !== locale) {
    throw new Error('QA_DASHBOARD_CAPTURE_LOCALE_COMMIT_FAILED');
  }
  return Object.freeze({ locale });
}
