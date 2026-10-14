import { useState, useCallback, useEffect } from 'react';

/**
 * Dashboard State Controller
 * Manages tab switching and deep-link tab parameters.
 */
export function useDashboardController(initialTab = 'main', initialParams = null) {
    const [activeTabId, setActiveTabId] = useState(initialTab);

    // Sync state with prop changes (e.g. from Router)
    useEffect(() => {
        setActiveTabId(initialTab);
    }, [initialTab]);

    // State for Tab Parameters (Deep Linking)
    const [activeTabParams, setActiveTabParams] = useState(initialParams);

    useEffect(() => {
        setActiveTabParams(initialParams || null);
    }, [initialParams]);

    // Handler: Tab Change Request
    const handleTabChange = useCallback((targetTabId, params = null) => {
        // Set parameters for the new tab
        setActiveTabParams(params);
        if (targetTabId === activeTabId) return;
        setActiveTabId(targetTabId);
    }, [activeTabId]);

    return {
        activeTabId,
        activeTabParams,
        handleTabChange,
    };
}
