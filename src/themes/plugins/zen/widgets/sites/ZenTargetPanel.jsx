import React from 'react';
import { SiteDecisionWorkspace } from '@/themes/core/widgets/shared/sites/index.js';
import ZenSiteUsageReading from './ZenSiteUsageReading.jsx';
import './zenSiteIntel.css';

// Zen owns the ledger reading inside the shared site workspace and error boundary.
export default function ZenTargetPanel(props) {
  return <SiteDecisionWorkspace {...props} variant="zen" layout="essential" readingComponent={ZenSiteUsageReading} />;
}
