export const EPS = 1e-6;

export const clamp01 = (value) => Math.min(1, Math.max(0, value));
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + ((b - a) * t);
export const safeDiv = (a, b, fallback = 0) => (Math.abs(b) > EPS ? a / b : fallback);
export const mean = (arr) => (arr.length ? arr.reduce((acc, cur) => acc + cur, 0) / arr.length : 0);
export const degToRad = (value) => (value * Math.PI) / 180;
export const stdDev = (arr) => {
    if (!arr.length) {
        return 0;
    }
    const m = mean(arr);
    return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
};
export const round = (value, digit = 4) => Number(Number.isFinite(value) ? value.toFixed(digit) : 0);

export const distanceSq = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};

export const distance = (a, b) => Math.sqrt(distanceSq(a, b));

export const normalizeAngleDelta = (value) => {
    let out = Number.isFinite(value) ? value : 0;
    while (out <= -Math.PI) out += Math.PI * 2;
    while (out > Math.PI) out -= Math.PI * 2;
    return out;
};

const orientation = (a, b, c) => (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);

const onSegment = (a, b, c) => (
    Math.min(a.x, c.x) - EPS <= b.x
    && b.x <= Math.max(a.x, c.x) + EPS
    && Math.min(a.y, c.y) - EPS <= b.y
    && b.y <= Math.max(a.y, c.y) + EPS
);

export const segmentsIntersect = (p1, p2, q1, q2) => {
    const minP1P2x = p1.x < p2.x ? p1.x : p2.x;
    const maxP1P2x = p1.x > p2.x ? p1.x : p2.x;
    const minQ1Q2x = q1.x < q2.x ? q1.x : q2.x;
    const maxQ1Q2x = q1.x > q2.x ? q1.x : q2.x;

    if (maxP1P2x < minQ1Q2x - EPS || maxQ1Q2x < minP1P2x - EPS) {
        return false;
    }

    const minP1P2y = p1.y < p2.y ? p1.y : p2.y;
    const maxP1P2y = p1.y > p2.y ? p1.y : p2.y;
    const minQ1Q2y = q1.y < q2.y ? q1.y : q2.y;
    const maxQ1Q2y = q1.y > q2.y ? q1.y : q2.y;

    if (maxP1P2y < minQ1Q2y - EPS || maxQ1Q2y < minP1P2y - EPS) {
        return false;
    }

    const o1 = orientation(p1, p2, q1);
    const o2 = orientation(p1, p2, q2);
    const o3 = orientation(q1, q2, p1);
    const o4 = orientation(q1, q2, p2);

    if (o1 * o2 < 0 && o3 * o4 < 0) {
        return true;
    }

    if (Math.abs(o1) < EPS && onSegment(p1, q1, p2)) return true;
    if (Math.abs(o2) < EPS && onSegment(p1, q2, p2)) return true;
    if (Math.abs(o3) < EPS && onSegment(q1, p1, q2)) return true;
    if (Math.abs(o4) < EPS && onSegment(q1, p2, q2)) return true;

    return false;
};

export const convexHull = (points) => {
    if (points.length < 3) {
        return points.slice();
    }

    const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

    const build = (list) => {
        const stack = [];
        list.forEach((point) => {
            while (stack.length >= 2) {
                const p1 = stack[stack.length - 2];
                const p2 = stack[stack.length - 1];
                const turn = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
                if (turn > 0) {
                    break;
                }
                stack.pop();
            }
            stack.push(point);
        });
        return stack;
    };

    const lower = build(sorted);
    const upper = build([...sorted].reverse());
    upper.pop();
    lower.pop();
    return lower.concat(upper);
};

export const polygonArea = (polygon) => {
    if (polygon.length < 3) {
        return 0;
    }
    let area = 0;
    for (let i = 0; i < polygon.length; i += 1) {
        const j = (i + 1) % polygon.length;
        area += polygon[i].x * polygon[j].y - polygon[j].x * polygon[i].y;
    }
    return Math.abs(area) * 0.5;
};

export const normalizeAroundTarget = (value, target, tolerance) => {
    if (tolerance <= EPS) {
        return value === target ? 1 : 0;
    }
    return clamp01(1 - Math.abs(value - target) / tolerance);
};

export const computeGridNegativeSpace = (points, minX, maxX, minY, maxY) => {
    if (points.length < 4) {
        return { ratio: 0.5, windows: 0 };
    }

    const cols = 20;
    const rows = 20;
    const width = Math.max(EPS, maxX - minX);
    const height = Math.max(EPS, maxY - minY);
    const grid = Array.from({ length: rows }, () => Array(cols).fill(0));

    points.forEach((p) => {
        const x = clamp01((p.x - minX) / width);
        const y = clamp01((p.y - minY) / height);
        const col = Math.min(cols - 1, Math.floor(x * cols));
        const row = Math.min(rows - 1, Math.floor(y * rows));
        grid[row][col] = 1;
    });

    let windows = 0;
    let emptyInterior = 0;
    for (let r = 1; r < rows - 1; r += 1) {
        for (let c = 1; c < cols - 1; c += 1) {
            if (grid[r][c] === 1) {
                continue;
            }
            emptyInterior += 1;
            const neighbors = [
                grid[r - 1][c],
                grid[r + 1][c],
                grid[r][c - 1],
                grid[r][c + 1],
                grid[r - 1][c - 1],
                grid[r - 1][c + 1],
                grid[r + 1][c - 1],
                grid[r + 1][c + 1],
            ];
            const occupiedAround = neighbors.reduce((acc, cur) => acc + cur, 0);
            if (occupiedAround >= 4) {
                windows += 1;
            }
        }
    }

    return {
        ratio: safeDiv(windows, Math.max(1, emptyInterior), 0),
        windows,
    };
};

export const computeSkeletonGrid = (points, minX, maxX, minY, maxY, size = 32) => {
    const grid = new Float32Array(size * size);
    if (points.length === 0) {
        return Array.from(grid);
    }

    const width = Math.max(EPS, maxX - minX);
    const height = Math.max(EPS, maxY - minY);

    const pad = 0.1;
    const pWidth = width * (1 + pad * 2);
    const pHeight = height * (1 + pad * 2);
    const pMinX = minX - width * pad;
    const pMinY = minY - height * pad;

    points.forEach((p) => {
        const nx = (p.x - pMinX) / pWidth;
        const ny = (p.y - pMinY) / pHeight;

        const col = Math.floor(nx * size);
        const row = Math.floor(ny * size);

        if (col >= 0 && col < size && row >= 0 && row < size) {
            grid[row * size + col] = 1;
        }
    });

    return Array.from(grid);
};

export const nearestNeighborDistance = (points, maxSamples = 180) => {
    if (points.length < 2) {
        return 0;
    }

    const sampleIndices = [];
    if (points.length > maxSamples) {
        const stride = points.length / maxSamples;
        for (let i = 0; i < maxSamples; i += 1) {
            sampleIndices.push(Math.min(points.length - 1, Math.floor(i * stride)));
        }
        if (sampleIndices[sampleIndices.length - 1] !== points.length - 1) {
            sampleIndices.push(points.length - 1);
        }
    } else {
        for (let i = 0; i < points.length; i += 1) {
            sampleIndices.push(i);
        }
    }

    const distances = [];
    for (let s = 0; s < sampleIndices.length; s += 1) {
        const index = sampleIndices[s];
        const point = points[index];
        let nearestSq = Infinity;
        for (let i = 0; i < points.length; i += 1) {
            if (i === index) {
                continue;
            }
            const dSq = distanceSq(point, points[i]);
            if (dSq < nearestSq) {
                nearestSq = dSq;
            }
        }
        distances.push(Number.isFinite(nearestSq) ? Math.sqrt(nearestSq) : 0);
    }

    return mean(distances);
};
