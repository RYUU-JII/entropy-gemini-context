import { ZEN_RAIN_STREAK_CAPACITY, ZEN_RAIN_LINE_WIDTH_CSS,
    compileZenRainStreakLayout, createZenRainGeometryState,
    sampleZenRainStreakGeometry, clipZenRainStreakGeometry } from './zenRainStreakGeometry.js';
import { resolveZenHomeSkyPlane } from '../../model/bonsai/rendering/zenHomeFrameSeamGeometry.js';

const WIND_RESPONSE_SECONDS = 0.35;
const WEATHER_FIELDS = ['enabled', 'rainIntensity', 'cloudCover', 'windIntensity', 'windDirection', 'daylight'];
const DAY_COLORS = [[82, 109, 122], [226, 234, 238]];
const NIGHT_COLORS = [[156, 183, 205], [186, 206, 225]];
const smoothstep = value => value * value * (3 - 2 * value);
const requireWeather = input => {
    if (typeof input.enabled !== 'boolean'
        || !['rainIntensity', 'cloudCover', 'windIntensity', 'windDirection', 'daylight'].every(key => Number.isFinite(input[key]))
        || ['rainIntensity', 'cloudCover', 'daylight'].some(key => input[key] < 0 || input[key] > 1)
        || input.windIntensity < 0 || input.windIntensity > 1.6) throw Error('ZEN_RAIN_WEATHER_INVALID');
};
const sameLayout = (layout, input) => layout && layout.width === input.width && layout.height === input.height
    && layout.seed === input.seed && Array.isArray(input.skyPlane) && input.skyPlane.length === 4
    && layout.skyPlane.every((point, index) => point.x === input.skyPlane[index]?.x && point.y === input.skyPlane[index]?.y);

// Both explicit backends consume this projection. Device geometry stays owned
// by Home; only the rain's width/speed calibration is expressed in CSS pixels.
export function resolveZenBonsaiRainPresentation(geometry, pixelWidth, pixelHeight) {
    return { geometry, rearPlane: geometry?.support === 'frame-seam' ? resolveZenHomeSkyPlane(geometry) : null,
        backdropViewport: geometry ? geometry.sceneViewport : { x: 0, y: 0, width: pixelWidth, height: pixelHeight } };
}

export function resolveZenBonsaiRainInputs({ presentation, seed, options, pixelWidth, pixelHeight, pixelRatio }) {
    if (![pixelWidth, pixelHeight, pixelRatio].every(Number.isFinite)
        || pixelWidth <= 0 || pixelHeight <= 0 || pixelRatio <= 0) throw Error('ZEN_RAIN_PROJECTION_SIZE_INVALID');
    const { geometry, rearPlane, backdropViewport } = presentation;
    let plane;
    if (geometry?.support === 'frame-seam') {
        if (!Array.isArray(rearPlane) || rearPlane.length !== 4 || !Number.isFinite(geometry.topPlaneRearY)) {
            throw Error('ZEN_RAIN_HOME_SKY_REQUIRED');
        }
        // The back texture also contains the soil. Stop at its rear edge rather
        // than painting rain over that already-opaque material after the bake.
        const bottom = options.skipPot === true ? pixelHeight : geometry.topPlaneRearY;
        const left = rearPlane[0].x + (rearPlane[3].x - rearPlane[0].x) * bottom / pixelHeight;
        plane = [rearPlane[0], rearPlane[1], { x: pixelWidth, y: bottom }, { x: left, y: bottom }];
    } else {
        const viewport = geometry ? backdropViewport : { x: 0, y: 0, width: pixelWidth, height: pixelHeight };
        const bottom = geometry && options.skipPot !== true ? geometry.topPlaneRearY : viewport.y + viewport.height;
        plane = [{ x: viewport.x, y: viewport.y }, { x: viewport.x + viewport.width, y: viewport.y },
            { x: viewport.x + viewport.width, y: bottom }, { x: viewport.x, y: bottom }];
    }
    const enabled = options.renderBackdrop !== false && options.renderMode !== 'trunk_sandbox';
    const env = options.environmentState;
    if (enabled && (!env || typeof env !== 'object')) throw Error('ZEN_RAIN_ENVIRONMENT_REQUIRED');
    return { width: pixelWidth / pixelRatio, height: pixelHeight / pixelRatio,
        skyPlane: plane.map(point => ({ x: point.x / pixelRatio, y: point.y / pixelRatio })),
        seed, enabled,
        rainIntensity: enabled ? env.rainIntensity : 0, cloudCover: enabled ? env.cloudCover : 0,
        windIntensity: enabled ? env.windIntensity : 0, windDirection: enabled ? env.windDirection : 0,
        daylight: enabled ? env.daylight : 1 };
}

export function createZenRainStreakRuntime() {
    const state = createZenRainGeometryState();
    const weather = { counts: [0, 0], totalCount: 0, colors: [[0, 0, 0], [0, 0, 0]], opacity: [0, 0],
        birthsPerActiveSecond: 0, nominalInFlight: 0 };
    const wind = { time: 0, offset: 0, velocity: 0, target: 0 };
    let layout = null, inputs = null, layoutRevision = 0, weatherRevision = 0, poseRevision = 0;
    let lastTime = null, sampledLayout = -1, sampledWeather = -1, disposed = false;
    const last = { activeTimeSec: null, admittedStreaks: 0, visibleStreaks: 0, reusedPose: false };
    const requireLive = () => { if (disposed) throw Error('ZEN_RAIN_RUNTIME_DISPOSED'); };
    const windAt = time => {
        const elapsed = time - wind.time, decay = Math.exp(-elapsed / WIND_RESPONSE_SECONDS);
        return { velocity: wind.target + (wind.velocity - wind.target) * decay,
            offset: wind.offset + wind.target * elapsed
                + (wind.velocity - wind.target) * WIND_RESPONSE_SECONDS * (1 - decay) };
    };
    function setInputs(input) {
        requireLive(); requireWeather(input);
        const previousCount = weather.totalCount;
        const changedLayout = !sameLayout(layout, input);
        if (changedLayout) { layout = compileZenRainStreakLayout(input); layoutRevision++; }
        const changedWeather = !inputs || WEATHER_FIELDS.some(key => input[key] !== inputs[key]);
        if (!changedLayout && !changedWeather) return false;
        if (changedWeather) {
            const target = Math.cos(input.windDirection) * input.windIntensity * 52;
            if (!inputs) wind.velocity = target;
            if (target !== wind.target) {
                const time = lastTime === null ? 0 : lastTime, current = windAt(time);
                wind.time = time; wind.offset = current.offset; wind.velocity = current.velocity; wind.target = target;
            }
            inputs = Object.fromEntries(WEATHER_FIELDS.map(key => [key, input[key]]));
            weatherRevision++;
            // Rain is already a canonical weather channel. Cloud cover must not
            // silently veto sunshowers or become another precipitation policy.
            weather.totalCount = input.enabled ? Math.round(ZEN_RAIN_STREAK_CAPACITY * input.rainIntensity) : 0;
            weather.counts[0] = Math.ceil(weather.totalCount / 2); weather.counts[1] = Math.floor(weather.totalCount / 2);
            const night = 1 - smoothstep(input.daylight);
            for (let channel = 0; channel < 3; channel++) {
                for (let bucket = 0; bucket < 2; bucket++) weather.colors[bucket][channel] = DAY_COLORS[bucket][channel]
                    + (NIGHT_COLORS[bucket][channel] - DAY_COLORS[bucket][channel]) * night;
            }
            weather.opacity[0] = 0.22 + input.rainIntensity * 0.04 + night * 0.10;
            weather.opacity[1] = 0.34 + input.rainIntensity * 0.15 - night * 0.05;
        }
        if (changedLayout || previousCount !== weather.totalCount) {
            weather.birthsPerActiveSecond = 0; weather.nominalInFlight = 0;
            for (let bucket = 0; bucket < 2; bucket++) for (let slot = 0; slot < weather.counts[bucket]; slot++) {
                const index = bucket * 8 + slot, flight = (layout.height + 40) / layout.constants[index * 4 + 2];
                weather.birthsPerActiveSecond += 1 / layout.cycleDurations[index];
                weather.nominalInFlight += flight / layout.cycleDurations[index];
            }
        }
        last.admittedStreaks = weather.totalCount;
        return true;
    }
    function sample(activeTimeSec) {
        requireLive();
        if (!layout || !inputs) throw Error('ZEN_RAIN_INPUTS_NOT_SET');
        if (!Number.isFinite(activeTimeSec) || activeTimeSec < 0 || (lastTime !== null && activeTimeSec < lastTime)) {
            throw Error('ZEN_RAIN_ACTIVE_TIME_INVALID');
        }
        last.reusedPose = activeTimeSec === lastTime && sampledLayout === layoutRevision && sampledWeather === weatherRevision;
        if (last.reusedPose) return false;
        const flow = windAt(activeTimeSec);
        sampleZenRainStreakGeometry(layout, weather.counts, activeTimeSec, flow.offset, flow.velocity, state);
        last.visibleStreaks = clipZenRainStreakGeometry(layout, weather.counts, state);
        last.activeTimeSec = activeTimeSec; lastTime = activeTimeSec;
        sampledLayout = layoutRevision; sampledWeather = weatherRevision; poseRevision++;
        return true;
    }
    function receipt() {
        return { contract: 'zen_rain_streaks_v1', disposed, layoutRevision, weatherRevision, poseRevision,
            maximumStreaks: ZEN_RAIN_STREAK_CAPACITY, lineWidthCss: ZEN_RAIN_LINE_WIDTH_CSS,
            birthsPerActiveSecond: weather.birthsPerActiveSecond, nominalInFlightBeforeSkyClip: weather.nominalInFlight,
            geometryNumericBufferBytes: disposed ? 0 : 528 + (layout === null ? 0 : 736), ...last };
    }
    function dispose() {
        if (disposed) return;
        disposed = true; layout = null; inputs = null; state.segments = null; state.visibility = null;
    }
    return { state, weather, setInputs, sample, receipt, dispose };
}
