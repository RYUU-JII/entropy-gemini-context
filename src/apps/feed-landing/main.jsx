import React from 'react';
import { createRoot } from 'react-dom/client';
import FeedLandingApp from './FeedLandingApp.jsx';

const root = document.getElementById('root');
if (!root) throw new Error('FEED_LANDING_ROOT_REQUIRED');
createRoot(root).render(<React.StrictMode><FeedLandingApp /></React.StrictMode>);
