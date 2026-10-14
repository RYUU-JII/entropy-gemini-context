// Minimal base declarations for the canonical yoonseul-only surface pipeline.
export const pixiWaterYoonseulOnlyBaseShader = `
precision highp float;

varying vec2 vTextureCoord;
uniform sampler2D uSampler;
uniform vec4 inputClamp;
uniform vec4 inputSize;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uFilterOrigin;
uniform vec2 uWorldResolution;
uniform float uWaterScale;
uniform float uIrregularity;
uniform vec2 uCurrentDir;
uniform float uFlowMix;
uniform float uFlowTransport;
uniform float uSpectralSpread;
uniform float uSpectralPeak;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uRefractionVisibility;
uniform float uSurfaceReflectionStrength;
uniform vec3 uSurfaceSheenColor;
uniform float uSurfaceSheenIntensity;
uniform float uSurfaceSheenClarity;
uniform float uSurfaceGoldLift;
uniform float uYoonseulIntensity;
uniform float uYoonseulSharpness;
uniform float uYoonseulPatchScale;
uniform float uYoonseulMotion;
uniform float uYoonseulOpacity;
uniform float uYoonseulTime;
uniform float uYoonseulFlickerAmount;
uniform float uYoonseulTemporalCoherence;
uniform float uYoonseulLowBand;
uniform float uYoonseulMicroBand;
uniform float uYoonseulGlintStability;
uniform float uYoonseulBeatDamping;
uniform float uYoonseulAlgorithmMode;
uniform float uYoonseulStability;
uniform float uYoonseulSpatialStability;
uniform float uYoonseulDetailStability;
uniform float uYoonseulTemporalStability;
uniform float uYoonseulSoftKnee;
uniform float uYoonseulEnabled;

const float PI = 3.14159265359;
`;
