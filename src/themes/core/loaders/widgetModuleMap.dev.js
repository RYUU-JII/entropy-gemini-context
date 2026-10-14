export const THEME_PLUGIN_WIDGET_MODULES = import.meta.glob([
    '../../plugins/*/widgets/main/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/core/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/filter/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/signals/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/signals/*/index.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/signals/*/app/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/sites/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/tools/*.{js,jsx,ts,tsx}',
    '../../plugins/*/widgets/tools/*/*.{js,jsx,ts,tsx}',
]);
