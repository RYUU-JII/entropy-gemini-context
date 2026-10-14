// Shared Fresnel and GGX optics helpers used after a surface normal has been selected.
export const pixiWaterSurfaceOpticsShader = `
vec3 fresnelSchlick(float cosTheta, vec3 F0) {
    return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
}

float D_GGX(float NoH, float a) {
    float a2 = a * a;
    float d = (NoH * NoH) * (a2 - 1.0) + 1.0;
    return a2 / (PI * d * d);
}

float G_SchlickGGX(float NoV, float k) {
    return NoV / (NoV * (1.0 - k) + k);
}

float G_Smith(float NoV, float NoL, float k) {
    return G_SchlickGGX(NoV, k) * G_SchlickGGX(NoL, k);
}
`;
