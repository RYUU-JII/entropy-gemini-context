import React from 'react';
import {
    Home,
    Settings,
    Calendar,
    Sun,
    SlidersHorizontal,
    Zap,
    ToolCase,
    ClipboardList,
    ScrollText,
    Clock,
    FlaskConical,
    Activity,
    Microscope,
    Eye,
    Sprout,
    MapPinned,
    CalendarClock,
    PackageOpen,
    Globe,
    Shield,
    ShieldOff,
    Construction
} from 'lucide-react';

/**
 * Dashboard Icon Components
 * 
 * Replaced custom SVGs with Lucide React icons for consistency and maintainability.
 * Wrappers are used to maintain the existing API and default styling.
 */

// Helper to wrap Lucide icons with default props if needed
// currently Lucide defaults are good, but we ensure classNames are passable.
function wrapIcon(Icon, displayName) {
    const WrappedIcon = ({ className = 'h-4 w-4', ...props }) => (
        <Icon className={className} strokeWidth={2} {...props} />
    );
    WrappedIcon.displayName = displayName;
    return WrappedIcon;
}

// Home (Panel)
export const HomeIcon = wrapIcon(Home, 'HomeIcon');

// Settings Gear (Rules)
export const GearIcon = wrapIcon(Settings, 'GearIcon');

// Calendar (Schedule)
export const CalendarIcon = wrapIcon(Calendar, 'CalendarIcon');

// Sun (Theme)
export const SunIcon = wrapIcon(Sun, 'SunIcon');

// Sliders (Filter Settings)
export const SlidersIcon = wrapIcon(SlidersHorizontal, 'SlidersIcon');

// Lightning/Bolt (Util)
export const LightningIcon = wrapIcon(Zap, 'LightningIcon');

// Tool Case (Utility Deck)
export const ToolCaseIcon = wrapIcon(ToolCase, 'ToolCaseIcon');

// Clipboard (Intake)
export const ClipboardIcon = wrapIcon(ClipboardList, 'ClipboardIcon');

// Scroll (Clinical Protocols)
export const ProtocolsIcon = wrapIcon(ScrollText, 'ProtocolsIcon');

// Clock (Rounds)
export const ClockIcon = wrapIcon(Clock, 'ClockIcon');

// Flask (Lab)
export const FlaskIcon = wrapIcon(FlaskConical, 'FlaskIcon');

// Pulse (Vitals)
export const PulseIcon = wrapIcon(Activity, 'PulseIcon');

// Microscope (Containment)
export const MicroscopeIcon = wrapIcon(Microscope, 'MicroscopeIcon');

// Eye (Observation)
export const EyeIcon = wrapIcon(Eye, 'EyeIcon');

// Sprout (Zen Garden)
export const SproutIcon = wrapIcon(Sprout, 'SproutIcon');

// Map Pin (Zen Markers)
export const MapPinnedIcon = wrapIcon(MapPinned, 'MapPinnedIcon');

// Calendar Clock (Zen Rhythm)
export const CalendarClockIcon = wrapIcon(CalendarClock, 'CalendarClockIcon');

// Open Package (Zen Implements)
export const PackageOpenIcon = wrapIcon(PackageOpen, 'PackageOpenIcon');

// Globe (Sites / Domains)
export const GlobeIcon = wrapIcon(Globe, 'GlobeIcon');

/*
 * Domain concept icons
 *
 * Each Entropy concept owns exactly one glyph, and feature code imports the
 * concept name from here instead of picking a lucide icon. Lucide stays the
 * direct source only for generic UI verbs (arrows, close, chevrons, ...).
 * The shield is reserved for site protection; check:ui-kit:concept-icons
 * rejects lucide Shield* imports anywhere else.
 */

// Concept aliases keep lucide's own props (size, strokeWidth, className).
function conceptIcon(Icon, displayName) {
    const ConceptIcon = (props) => <Icon {...props} />;
    ConceptIcon.displayName = displayName;
    return ConceptIcon;
}

// Custom glyphs are drawn on lucide's 24px grid and props so they sit beside lucide icons.
function ConceptGlyph({
    size = 24,
    strokeWidth = 2,
    className,
    children,
    ...props
}) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            {children}
        </svg>
    );
}

// Site protection: a site or span of time that Entropy guards.
export const SiteProtectionIcon = conceptIcon(Shield, 'SiteProtectionIcon');

// Protection release: lifting protection from a site.
export const ProtectionReleaseIcon = conceptIcon(ShieldOff, 'ProtectionReleaseIcon');

// Barrier artifact: a temporary barricade around fast, continuing exploration.
export const BarrierIcon = conceptIcon(Construction, 'BarrierIcon');

// Friction lane ("Add drag"): a block dragging over rough ground.
export function FrictionIcon(props) {
    return (
        <ConceptGlyph {...props}>
            <rect x="10" y="7" width="9" height="8" rx="1.5" />
            <path d="M2 15h20" />
            <path d="M6 15l-2 4" />
            <path d="M11 15l-2 4" />
            <path d="M16 15l-2 4" />
            <path d="M21 15l-2 4" />
            <path d="M3 9h4" />
            <path d="M4 12h3" />
        </ConceptGlyph>
    );
}

// Kekkai (Isolation session): a shimenawa rope with two shide marks the closed threshold.
export function KekkaiIcon(props) {
    return (
        <ConceptGlyph {...props}>
            <path d="M3 6.5c6 3 12 3 18 0" />
            <path d="M3 9c6 3 12 3 18 0" />
            <path d="M8.5 11v2.5l2 2-2 2 2 2" />
            <path d="M15.5 11v2.5l2 2-2 2 2 2" />
        </ConceptGlyph>
    );
}

// Icon Map (for dynamic lookup by tab ID)
export const TAB_ICONS = {
    main: HomeIcon,
    experiment: FlaskIcon,
    sites: GlobeIcon,
    schedule: CalendarClockIcon,
    filter: SlidersIcon,
    theme: SunIcon,
    settings: GearIcon,
    util: LightningIcon,
};

export function getIconByTabId(tabId) {
    return TAB_ICONS[tabId] || HomeIcon;
}
