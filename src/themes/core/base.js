import { buildThemeCSSVariables } from './utils.js';
import { isSupportedInteractionTransitionStyle } from './motion/interaction.js';

export class Theme {
    /**
     * @param {Object} config - The raw theme configuration object
     * @param {string} config.id - Unique theme identifier (e.g., 'entropy', 'camouflage')
     * @param {Object} config.meta - Metadata for UI display
     * @param {string} config.meta.name - Display name
     * @param {string} config.meta.description - Description
     * @param {Object} config.tokens - Visual design tokens
     * @param {Object} config.audio - Audio asset paths
     * @param {Object} config.behaviors - Component behavior configuration
     */
    constructor(config) {
        this.validate(config);

        this.id = config.id;
        this.meta = config.meta;
        this.tokens = config.tokens;
        this.audio = config.audio;
        this.behaviors = config.behaviors;
        this.slots = config.slots;
        this.customCSS = config.customCSS;
    }

    /**
     * Validates the configuration against the required schema.
     * Throws an error if critical fields are missing.
     * @param {Object} config 
     */
    validate(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Theme config must be an object');
        }
        if (!config.id) throw new Error("Theme must have an 'id'");
        if (!config.tokens) throw new Error(`Theme '${config.id}' missing 'tokens'`);

        if (!config.meta?.name) {
            console.warn(`[Theme: ${config.id}] Missing meta.name`);
        }
        if (!config.meta?.description) {
            console.warn(`[Theme: ${config.id}] Missing meta.description`);
        }

        const requireKeys = (object, keys, path, allowNull = false) => {
            if (!object) {
                throw new Error(`[Theme: ${config.id}] Missing ${path}`);
            }
            keys.forEach((key) => {
                const hasKey = Object.prototype.hasOwnProperty.call(object, key);
                const value = object[key];
                if (!hasKey || (!allowNull && (value === undefined || value === null || value === ''))) {
                    throw new Error(`[Theme: ${config.id}] Missing ${path}.${key}`);
                }
            });
        };

        requireKeys(config.tokens, ['colors', 'typography', 'shapes', 'effects'], 'tokens');
        requireKeys(config.tokens.colors, ['primary', 'accent', 'alert', 'text'], 'tokens.colors');
        requireKeys(config.tokens.typography, ['fontFamily', 'letterSpacing'], 'tokens.typography');
        requireKeys(config.tokens.shapes, ['borderRadius', 'borderStyle'], 'tokens.shapes');
        requireKeys(config.tokens.effects, ['blur', 'glow', 'scanline', 'noise'], 'tokens.effects');
        // requireKeys(config.audio, ['bgm', 'clickSound', 'alertSound', 'hoverSound'], 'audio', true); // Allowing loose audio for now
        requireKeys(config.behaviors, ['lensHoverAction', 'scrollPhysics', 'transitionStyle', 'transitionDuration', 'cursorStyle'], 'behaviors');
        if (!isSupportedInteractionTransitionStyle(config.behaviors.transitionStyle)) {
            throw new Error(`[Theme: ${config.id}] Unsupported behaviors.transitionStyle '${config.behaviors.transitionStyle}'`);
        }

    }

    /**
     * Generates CSS variables for the theme.
     * @returns {Object} Dictionary of CSS variables { '--var-name': 'value' }
     */
    toCSSVariables() {
        return buildThemeCSSVariables(this);
    }
}
