import enCommon from './locales/en/common.js';
import enDashboard from './locales/en/dashboard.js';
import enFilter from './locales/en/filter.js';
import enSites from './locales/en/sites.js';
import enMain from './locales/en/main.js';
import enSettings from './locales/en/settings.js';
import enTools from './locales/en/tools.js';
import enTheme from './locales/en/theme.js';
import enSchedule from './locales/en/schedule.js';

import koCommon from './locales/ko/common.js';
import koDashboard from './locales/ko/dashboard.js';
import koFilter from './locales/ko/filter.js';
import koSites from './locales/ko/sites.js';
import koMain from './locales/ko/main.js';
import koSettings from './locales/ko/settings.js';
import koTools from './locales/ko/tools.js';
import koTheme from './locales/ko/theme.js';
import koSchedule from './locales/ko/schedule.js';
import enGuidance from './locales/en/guidance.js';
import koGuidance from './locales/ko/guidance.js';

export const I18N_RESOURCES = Object.freeze({
    en: Object.freeze({
        common: enCommon,
        dashboard: enDashboard,
        filter: enFilter,
        sites: enSites,
        main: enMain,
        settings: enSettings,
        tools: enTools,
        theme: enTheme,
        schedule: enSchedule,
        guidance: enGuidance,
    }),
    ko: Object.freeze({
        common: koCommon,
        dashboard: koDashboard,
        filter: koFilter,
        sites: koSites,
        main: koMain,
        settings: koSettings,
        tools: koTools,
        theme: koTheme,
        schedule: koSchedule,
        guidance: koGuidance,
    }),
});
