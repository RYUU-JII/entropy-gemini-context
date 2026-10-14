import React, { useState, useEffect, useRef } from 'react';
import { SETTINGS_PREVIEW_PLATFORMS } from './constants.js';
import { ChevronDown, Lock } from 'lucide-react';
import { useAppTranslation } from '@/ui-kit/hooks/useAppTranslation.js';
import {
    getDashboardStateTransitionStyle,
    getInteractionMotionStyle,
} from '@/themes/core/motion/index.js';
import { resolveSettingsPreviewChromeVariant } from './settingsPreviewMockups.jsx';

const PREVIEW_TOP_INTERACTION_STYLE = getInteractionMotionStyle('stable');
const PREVIEW_SELECTOR_SHELL_STYLE = getDashboardStateTransitionStyle('filter.preview.selector-shell');
const PREVIEW_SELECTOR_CHEVRON_STYLE = getDashboardStateTransitionStyle('filter.preview.selector-chevron');
const PREVIEW_SELECTOR_MENU_STYLE = getDashboardStateTransitionStyle('filter.preview.selector-menu');
const PREVIEW_SELECTOR_OPTION_STYLE = getDashboardStateTransitionStyle('filter.preview.selector-option');

export default function PreviewMockupTop({ platformId, onPlatformChange, themeId }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const usesMinimalChrome = resolveSettingsPreviewChromeVariant(themeId) === 'minimal';
    const { t } = useAppTranslation('settings');
    const pt = (key) => t(key);

    const getPlatformLabel = (platform) => {
        return pt(platform?.labelKey);
    };

    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const currentPlatform = SETTINGS_PREVIEW_PLATFORMS.find((p) => p.id === platformId);
    const currentLabel = currentPlatform ? getPlatformLabel(currentPlatform) : platformId;

    return (
        <div className={`relative z-20 flex h-10 shrink-0 items-center justify-center border-b bg-surface px-4 ${usesMinimalChrome ? 'border-border/20' : 'border-border/30'}`} style={PREVIEW_TOP_INTERACTION_STYLE}>
            <div
                ref={dropdownRef}
                className={`relative flex h-7 w-full max-w-sm items-center gap-2 border px-3 ${usesMinimalChrome ? 'rounded-[2px] border-border/25 bg-background hover:border-border/40' : 'rounded-[8px] border-border/35 bg-surface-elevated/35 shadow-sm hover:border-accent/25'}`}
                style={PREVIEW_SELECTOR_SHELL_STYLE}
            >
                <Lock className={`h-3 w-3 ${usesMinimalChrome ? 'text-on-surface-muted/60' : 'text-success/70'}`} strokeWidth={2.5} />

                <div className="flex flex-1 items-center gap-1 overflow-hidden">
                    <span className="text-[10px] font-bold text-on-surface-muted select-none">
                        {pt('preview.chrome.protocol_prefix')}
                    </span>
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left text-[10px] font-black tracking-tight text-on-surface focus:outline-hidden"
                    >
                        <span className="truncate">{currentLabel}</span>
                        <ChevronDown
                            className={`h-3 w-3 shrink-0 text-on-surface-muted ${isOpen ? 'rotate-180' : ''}`}
                            style={PREVIEW_SELECTOR_CHEVRON_STYLE}
                        />
                    </button>
                    <span className="text-[10px] font-medium text-on-surface-muted select-none">
                        {pt('preview.chrome.domain_suffix')}
                    </span>
                </div>

                <div
                    className={[
                        `absolute left-0 right-0 top-[calc(100%+8px)] z-30 origin-top overflow-hidden border bg-surface p-1 ${usesMinimalChrome ? 'rounded-[2px] border-border/25 shadow-none' : 'rounded-[8px] border-border/35 shadow-lg'}`,
                        isOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
                    ].join(' ')}
                    style={PREVIEW_SELECTOR_MENU_STYLE}
                >
                    {!usesMinimalChrome ? (
                        <div className="mb-0.5 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-on-surface-muted">
                            {pt('preview.chrome.select_platform')}
                        </div>
                    ) : null}
                    {SETTINGS_PREVIEW_PLATFORMS.map((platform) => (
                        <button
                            key={platform.id}
                            type="button"
                            onClick={() => {
                                onPlatformChange(platform.id);
                                setIsOpen(false);
                            }}
                            className={[
                                `flex w-full items-center justify-between px-3 py-1.5 text-[10px] font-bold ${usesMinimalChrome ? 'rounded-[2px]' : 'rounded-[8px]'}`,
                                platform.id === platformId
                                    ? (usesMinimalChrome ? 'border border-border/35 bg-background text-on-surface' : 'border border-accent/25 bg-surface text-accent')
                                    : (usesMinimalChrome ? 'text-on-surface hover:bg-background' : 'text-on-surface hover:bg-surface hover:text-accent'),
                            ].join(' ')}
                            style={PREVIEW_SELECTOR_OPTION_STYLE}
                        >
                            <span>{getPlatformLabel(platform)}</span>
                            {platform.id === platformId && <div className={`h-1.5 w-1.5 rounded-full ${usesMinimalChrome ? 'bg-on-surface' : 'bg-accent'}`} />}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
