import React from 'react';
import { StandardSiteRegistryPanel } from '@/themes/core/widgets/shared/sites/index.js';

export default function MatrixRegistryPanel(props) {
  return <StandardSiteRegistryPanel {...props} world="matrix" />;
}
