import React from 'react';

import { useAppTranslation } from './hooks/useAppTranslation.js';
import {
  AppFeedbackProvider as BaseAppFeedbackProvider,
  useAppFeedback,
} from './feedback/AppFeedbackProvider.jsx';

export { useAppFeedback };
export { useAppFeedback as useToast };

export function AppFeedbackProvider(props) {
  useAppTranslation('common');
  return <BaseAppFeedbackProvider {...props} />;
}

export const ToastProvider = AppFeedbackProvider;
