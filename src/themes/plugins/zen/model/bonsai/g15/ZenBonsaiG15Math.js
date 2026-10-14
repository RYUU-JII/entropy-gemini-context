/** Pure numeric foundations shared by G15 generation and presentation. */
export const clamp = (value, minimum, maximum) => Math.max(
    minimum,
    Math.min(maximum, value),
);

export const rounded = (value, precision = 8) => {
    const power = 10 ** precision;
    const result = Math.round(value * power) / power;
    return Object.is(result, -0) ? 0 : result;
};
