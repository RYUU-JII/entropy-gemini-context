export const ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES = 12;

export const zenWaterSurfaceFieldFragmentShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform float uTime;
uniform vec2 uFieldResolution;
uniform vec4 uSurfaceFieldMap;
uniform float uAspect;
uniform vec2 uWindDir;
uniform float uGravityWaveEnergy;
uniform float uCapillaryWaveEnergy;
uniform float uDirectionalSpread;
uniform float uGustEnvelope;
uniform float uSpatialStability;
uniform float uDetailStability;
uniform float uTemporalStability;
uniform float uRainIntensity;
uniform vec2 uRainGrid;
uniform float uDisturbanceCount;
uniform vec4 uDisturbanceData[${ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES}];
uniform vec4 uDisturbanceMeta[${ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES}];

const float WS_PI = 3.14159265359;
const float WS_SLOPE_RANGE = 5.0;

vec2 ws_rotate(vec2 value, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(c * value.x - s * value.y, s * value.x + c * value.y);
}

vec2 ws_hash22(vec2 value) {
    vec3 p3 = fract(vec3(value.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xx + p3.yz) * p3.zy);
}

float ws_dispersion_omega(float waveNumber) {
    float gravityTerm = 0.34 * waveNumber;
    float capillaryTerm = 0.00042 * waveNumber * waveNumber * waveNumber;
    return sqrt(max(0.0001, gravityTerm + capillaryTerm)) * 0.63;
}

// travelRatio selects where this band sits between a standing wave and a
// progressive one. The authored basin response mixes incident and reflected
// components; it does not solve the pond's actual bank boundary conditions.
// A pure progressive band is
// sin(kx - wt); the standing form of the same band is sin(kx)cos(wt). The
// identity sin(kx - wt) = sin(kx)cos(wt) - cos(kx)sin(wt) means the two are
// one lerp apart on the second term alone, so a band can be tuned anywhere
// between them. Each band owns its phase scale so broad surface motion can
// settle without changing the shared rain/interaction clock.
vec4 ws_spectral_sample(
    vec2 p,
    vec2 wind,
    float angle,
    float frequency,
    float phase,
    float bend,
    float amplitude,
    float travelRatio,
    float phaseScale,
    vec2 metricTexelSquared
) {
    float spread = mix(0.72, 1.28, clamp(uDirectionalSpread, 0.0, 1.0));
    float speed = ws_dispersion_omega(frequency);
    float bandTime = uTime * phaseScale;
    float temporalTurnover = mix(1.0, 0.34, clamp(uTemporalStability, 0.0, 1.0));
    float turnoverA = sin(bandTime * speed * 0.137 + phase * 2.31);
    float turnoverB = sin(
        bandTime * (0.027 + frequency * 0.00009)
        - phase * 1.17
    );
    float capillaryTurn = smoothstep(24.0, 96.0, frequency);
    float directionTurn = turnoverB * 0.055 * temporalTurnover * capillaryTurn;
    // Signed: the sign is the propagation direction along the band axis, the
    // magnitude is how progressive the band is (0 = fully standing).
    float travel = clamp(travelRatio, -1.0, 1.0);
    vec2 direction = ws_rotate(wind, angle * spread + directionTurn);
    vec2 crossDirection = vec2(-direction.y, direction.x);
    // The curved wave front rides along with its own band: a standing band
    // whose front kept sliding would still read as a current.
    float sidePhase = dot(p, crossDirection) * frequency * 0.23
        - bandTime * speed * 0.19 * travel
        + phase * 1.73;
    float gustBend = bend * mix(0.86, 1.22, clamp(uGustEnvelope, 0.0, 1.0));
    float sideSine = sin(sidePhase);
    float sideCosine = cos(sidePhase);
    float curvedFront = sideSine * gustBend;
    float phaseTurnover = (turnoverA * 0.31 + turnoverB * 0.19) * temporalTurnover;
    // Space and time are separated so the two can be recombined by travel.
    // Everything that depends on p stays in spatialPhase, which keeps the
    // gradient and curvature chain below exactly as analytic as before.
    float spatialPhase = dot(p, direction) * frequency
        + phase
        + curvedFront
        + phaseTurnover;
    float temporalPhase = bandTime * speed;
    float spatialSine = sin(spatialPhase);
    float spatialCosine = cos(spatialPhase);
    float temporalSine = sin(temporalPhase);
    float temporalCosine = cos(temporalPhase);
    // carrierSine/carrierCosine keep their meaning: the shape function and its
    // first derivative with respect to spatialPhase. At travel = 1 they reduce
    // to sin(kx - wt) and cos(kx - wt) for this band's own phase scale.
    float carrierSine = spatialSine * temporalCosine
        - travel * spatialCosine * temporalSine;
    float carrierCosine = spatialCosine * temporalCosine
        + travel * spatialSine * temporalSine;
    float waveHeight = carrierSine * amplitude;
    vec2 sideGradient = crossDirection * frequency * 0.23;
    vec2 carrierGradient = direction * frequency
        + sideCosine * gustBend * sideGradient;
    vec2 carrierSecond = -sideSine
        * gustBend
        * sideGradient
        * sideGradient;
    // The second derivative of the shape function is its own negation for both
    // the standing and the progressive form, so this chain is unchanged.
    vec2 heightSecond = amplitude * (
        -carrierSine * carrierGradient * carrierGradient
        + carrierCosine * carrierSecond
    );
    float curvature = dot(heightSecond, metricTexelSquared) * 10.5;
    return vec4(waveHeight, carrierCosine * amplitude * carrierGradient, curvature);
}

vec4 ws_ring_sample(
    vec2 q,
    float distanceToCenter,
    float radius,
    float width,
    float amplitude,
    float trailingWaveStrength,
    vec2 metricTexelSquared
) {
    float ringPhase = (distanceToCenter - radius) / width;
    float packetMix = clamp(trailingWaveStrength, 0.0, 1.0);
    float envelopeRate = mix(0.72, 0.46, packetMix);
    float ringFrequency = mix(WS_PI * 0.5, 2.28, packetMix);
    float envelopePhase = ringPhase + 0.5 * packetMix;
    float cutoff = mix(2.8, 3.7, packetMix);
    if (abs(envelopePhase) > cutoff) return vec4(0.0);
    float phaseSquared = envelopePhase * envelopePhase;
    float envelope = exp(-phaseSquared * envelopeRate);
    float cosine = cos(ringPhase * ringFrequency);
    float sine = sin(ringPhase * ringFrequency);
    float height = cosine * envelope * amplitude;
    float firstByPhase = envelope * amplitude * (
        -ringFrequency * sine
        - 2.0 * envelopeRate * envelopePhase * cosine
    );
    float secondByPhase = envelope * amplitude * (
        (
            4.0 * envelopeRate * envelopeRate * phaseSquared
            - 2.0 * envelopeRate
            - ringFrequency * ringFrequency
        ) * cosine
        + 4.0 * envelopeRate * envelopePhase * ringFrequency * sine
    );
    float firstByDistance = firstByPhase / width;
    float secondByDistance = secondByPhase / (width * width);
    vec2 radial = q / distanceToCenter;
    vec2 radialSquared = radial * radial;
    vec2 gradient = firstByDistance * radial;
    vec2 second = secondByDistance * radialSquared
        + firstByDistance * (vec2(1.0) - radialSquared) / distanceToCenter;
    float curvature = dot(second, metricTexelSquared) * 10.5;
    return vec4(height, gradient, curvature);
}

vec4 ws_interaction_disturbances(vec2 uv, vec2 metricTexelSquared) {
    vec4 sample = vec4(0.0);
    vec2 metric = vec2(uAspect, 1.0);
    for (int index = 0; index < ${ZEN_WATER_SURFACE_FIELD_MAX_DISTURBANCES}; index += 1) {
        if (float(index) >= uDisturbanceCount) break;
        vec4 data = uDisturbanceData[index];
        vec4 meta = uDisturbanceMeta[index];
        vec2 q = (uv - data.xy) * metric;
        float trailingWaveStrength = clamp(meta.w, 0.0, 1.0);
        float minimumWidthTexels = mix(0.85, 1.5, trailingWaveStrength);
        float minimumWidth = minimumWidthTexels / max(uFieldResolution.y, 1.0);
        float width = max(meta.x, minimumWidth);
        float secondaryRadius = meta.y;
        float secondaryWidth = width * 1.18;
        float secondaryActive = step(0.0001, secondaryRadius) * step(0.0001, meta.z);
        float primaryTrailExtent = mix(2.8, 4.2, trailingWaveStrength);
        float primaryFrontExtent = mix(2.8, 3.2, trailingWaveStrength);
        float primaryInner = max(0.0, data.z - width * primaryTrailExtent);
        float primaryOuter = data.z + width * primaryFrontExtent;
        float secondaryInner = max(0.0, secondaryRadius - secondaryWidth * 2.8);
        float secondaryOuter = secondaryRadius + secondaryWidth * 2.8;
        float innerRadius = mix(
            primaryInner,
            min(primaryInner, secondaryInner),
            secondaryActive
        );
        float outerRadius = mix(
            primaryOuter,
            max(primaryOuter, secondaryOuter),
            secondaryActive
        );
        float distanceSquared = dot(q, q);
        if (
            distanceSquared < innerRadius * innerRadius
            || distanceSquared > outerRadius * outerRadius
        ) continue;
        float distanceToCenter = max(sqrt(distanceSquared), 0.00001);
        sample += ws_ring_sample(
            q,
            distanceToCenter,
            data.z,
            width,
            data.w,
            trailingWaveStrength,
            metricTexelSquared
        );

        if (secondaryActive > 0.5) {
            sample += ws_ring_sample(
                q,
                distanceToCenter,
                secondaryRadius,
                secondaryWidth,
                meta.z,
                0.0,
                metricTexelSquared
            );
        }
    }
    return sample;
}

vec4 ws_rain_cell_sample(
    vec2 uv,
    vec2 gridOffset,
    float layerSeed,
    float cycleRate,
    float radiusScale,
    vec2 cellMetricScale,
    float cellMetric,
    float rain,
    float density,
    float baseWidth
) {
    vec2 gridPosition = uv * uRainGrid + gridOffset;
    vec2 cell = floor(gridPosition);
    vec2 localPosition = fract(gridPosition);
    vec2 temporalHash = ws_hash22(cell + vec2(109.7 + layerSeed, 151.3));
    float phaseHash = temporalHash.x;
    float cellRateScale = mix(0.95, 1.05, temporalHash.y);
    float cyclePosition = uTime * cycleRate * cellRateScale + phaseHash;
    float cycleIndex = floor(cyclePosition);
    float epochAge = fract(cyclePosition);
    vec2 positionHash = ws_hash22(
        cell
        + vec2(17.3 + layerSeed, 41.7)
        + cycleIndex * vec2(0.71, 1.13)
    );
    float mass01 = fract(
        dot(positionHash, vec2(0.6131, 0.7973))
        + temporalHash.y * 0.1931
    );
    float eventPhase = fract(
        dot(positionHash.yx, vec2(0.5697, 0.3371))
        + temporalHash.x * 0.1733
    );
    float birthOffset = mix(0.008, 0.038, eventPhase);
    float requestedLifetime = mix(0.78, 0.98, mass01);
    float lifetimeFraction = min(requestedLifetime, 0.995 - birthOffset);
    float age = (epochAge - birthOffset) / lifetimeFraction;
    if (age < 0.0 || age >= 1.0) return vec4(0.0);

    vec2 center = vec2(0.28) + positionHash * 0.44;
    vec2 q = (localPosition - center) * cellMetricScale;
    float densityHash = fract(
        dot(positionHash, vec2(0.7549, 0.5697))
        + temporalHash.y * 0.337
    );
    float active = smoothstep(densityHash - 0.12, densityHash + 0.02, density);

    float birth = smoothstep(0.0, 0.04, age);
    float progressiveDecayRate = mix(0.58, 0.34, mass01);
    float decayTerm = progressiveDecayRate * age;
    float progressiveDecay = (
        1.0
        - decayTerm
        + 0.5 * decayTerm * decayTerm
    );
    float terminalFade = 1.0 - smoothstep(0.8, 1.0, age);
    float earlyCompensation = mix(
        1.16,
        1.04,
        smoothstep(0.0, 0.42, age)
    );
    float energyEnvelope = (
        birth
        * progressiveDecay
        * terminalFade
        * earlyCompensation
    );
    float radiusMassScale = mix(0.88, 1.15, mass01);
    float oneMinusAge = 1.0 - age;
    float travelShape = (
        mix(0.036, -0.012, mass01)
        + mix(0.24, 0.981, mass01) * oneMinusAge
    );
    float travel = clamp(
        age + age * oneMinusAge * travelShape,
        0.0,
        1.0
    );
    float radius = cellMetric
        * mix(0.021, 0.18 * radiusMassScale, travel)
        * radiusScale;
    float widthDiffusion = mix(0.96, 1.16, age);
    float width = baseWidth
        * widthDiffusion
        * mix(0.95, 1.05, eventPhase);
    float distanceSquared = dot(q, q);
    float innerRadius = max(0.0, radius - width);
    float outerRadius = radius + width;
    if (
        active <= 0.0001
        || energyEnvelope <= 0.0001
        || distanceSquared < innerRadius * innerRadius
        || distanceSquared > outerRadius * outerRadius
    ) return vec4(0.0);

    float distanceToCenter = max(sqrt(distanceSquared), 0.00001);
    float ringPhase = (distanceToCenter - radius) / width;
    float envelope = max(0.0, 1.0 - ringPhase * ringPhase);
    float amplitudeMassScale = mix(0.9, 1.22, mass01);
    float impactJitter = mix(0.94, 1.06, eventPhase);
    float amplitude = (
        active
        * energyEnvelope
        * (0.0045 + rain * 0.0065)
        * amplitudeMassScale
        * impactJitter
    );
    float height = envelope * envelope * amplitude;
    float firstByDistance = (
        -4.0
        * ringPhase
        * envelope
        * amplitude
        / width
    );
    vec2 gradient = firstByDistance * (q / distanceToCenter);
    return vec4(height, gradient, 0.0);
}

vec4 ws_rain_ripples(vec2 uv) {
    if (uRainIntensity <= 0.015) return vec4(0.0);
    float rain = clamp(uRainIntensity, 0.0, 1.0);
    float rainPresence = smoothstep(0.025, 0.12, rain);
    float density = mix(0.55, 1.0, sqrt(rain)) * rainPresence;
    vec2 cellMetricScale = vec2(
        uAspect / max(uRainGrid.x, 1.0),
        1.0 / max(uRainGrid.y, 1.0)
    );
    float cellMetric = min(cellMetricScale.x, cellMetricScale.y);
    float baseWidth = max(
        cellMetric * mix(0.013, 0.019, rain),
        1.15 / max(uFieldResolution.y, 1.0)
    );
    vec4 sample = vec4(0.0);
    sample += ws_rain_cell_sample(
        uv,
        vec2(0.37, 0.61),
        11.0,
        0.86,
        0.95,
        cellMetricScale,
        cellMetric,
        rain,
        density,
        baseWidth
    );
    sample += ws_rain_cell_sample(
        uv,
        vec2(0.83, 0.19),
        29.0,
        1.075,
        1.06,
        cellMetricScale,
        cellMetric,
        rain,
        density,
        baseWidth
    );
    return sample;
}

vec4 ws_surface_sample(vec2 uv) {
    vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
    vec2 wind = uWindDir;
    vec2 metricTexel = vec2(
        uAspect / max(uFieldResolution.x, 1.0),
        1.0 / max(uFieldResolution.y, 1.0)
    );
    vec2 metricTexelSquared = metricTexel * metricTexel;
    float spatialScale = mix(1.12, 0.88, clamp(uSpatialStability, 0.0, 1.0));
    float detailEnergy = mix(1.0, 0.54, clamp(uDetailStability, 0.0, 1.0));
    float gravityEnergy = mix(0.5, 1.34, clamp(uGravityWaveEnergy, 0.0, 1.0));
    float capillaryEnergy = mix(0.34, 1.42, clamp(uCapillaryWaveEnergy, 0.0, 1.0));

    // Broad bands partly stand and run on slower, distinct phases. Opposing
    // signs alone cancel an aggregate direction but leave fast moving crests.
    // Broad amplitudes retain the prior expected single-band height variance:
    // Anew = Aold * sqrt((1 + rold^2) / (1 + rnew^2)). Finite interference
    // remains free to vary; this is not a constant frame-energy constraint.
    vec4 sample = vec4(0.0);
    sample += ws_spectral_sample(p, wind, 0.16, 8.5 * spatialScale, 0.37, 0.72, 0.122622081 * gravityEnergy, 0.45, 0.40, metricTexelSquared);
    sample += ws_spectral_sample(p, wind, -0.61, 13.2 * spatialScale, 2.11, 0.86, 0.083281314 * gravityEnergy, -0.50, 0.46, metricTexelSquared);
    sample += ws_spectral_sample(p, wind, 0.93, 20.4 * spatialScale, 4.73, 0.94, 0.053783317 * gravityEnergy, -0.55, 0.54, metricTexelSquared);
    // Split the coherent middle ridge into three incommensurate crossings.
    // Their unbent, independent-phase height and slope variances match the
    // former 30.8 band, including each signed travel magnitude. This adds two
    // analytic evaluations to the low-resolution field, not optical samples.
    sample += ws_spectral_sample(p, wind, -1.58, 25.7 * spatialScale, 1.29, 1.04, 0.0177904910 * capillaryEnergy, 0.86, 0.78, metricTexelSquared);
    sample += ws_spectral_sample(p, wind, 0.49, 31.9 * spatialScale, 3.97, 1.04, 0.0176730732 * capillaryEnergy, -0.79, 0.78, metricTexelSquared);
    sample += ws_spectral_sample(p, wind, 2.21, 39.2 * spatialScale, 5.61, 1.04, 0.0117132689 * capillaryEnergy, 0.73, 0.78, metricTexelSquared);
    // Keep the capillary slope energy of the original three bands while moving
    // it to denser, non-commensurate crossings. This improves glint turnover
    // without adding another spectral evaluation or a full-resolution sample.
    // Capillary ripples are short-lived enough to stay progressive: they read as
    // surface texture rather than as a current.
    sample += ws_spectral_sample(p, wind, 1.71, 53.8 * spatialScale, 5.47, 1.13, 0.0127 * capillaryEnergy * detailEnergy, 0.92, 1.0, metricTexelSquared);
    sample += ws_spectral_sample(p, wind, -2.18, 82.1 * spatialScale, 3.38, 1.2, 0.00665 * capillaryEnergy * detailEnergy, -0.96, 1.0, metricTexelSquared);
    sample += ws_spectral_sample(p, wind, 2.63, 126.7 * spatialScale, 0.83, 1.27, 0.00332 * capillaryEnergy * detailEnergy, 1.0, 1.0, metricTexelSquared);
    sample += ws_rain_ripples(uv);
    sample += ws_interaction_disturbances(uv, metricTexelSquared);
    return sample;
}

void main(void) {
    vec2 uv = (vTextureCoord - uSurfaceFieldMap.zw) / uSurfaceFieldMap.xy;
    vec4 sample = ws_surface_sample(uv);
    vec2 slope = sample.yz;
    float curvature = sample.w;
    vec2 encodedSlope = clamp(0.5 + 0.5 * (slope / WS_SLOPE_RANGE), vec2(0.0), vec2(1.0));
    float encodedHeight = clamp(0.5 + sample.x * 1.18, 0.0, 1.0);
    float encodedCurvature = clamp(0.5 + curvature * 0.5, 0.0, 1.0);
    gl_FragColor = vec4(encodedSlope, encodedHeight, encodedCurvature);
}
`;
