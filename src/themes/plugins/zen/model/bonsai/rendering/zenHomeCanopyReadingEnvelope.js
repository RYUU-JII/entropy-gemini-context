import { resolveZenBonsaiPlumeCameraEnvelope } from '../plume/ZenBonsaiPlumeCameraEnvelope.js';
import { ZEN_PLUME_FLOWER_RADIUS_GAIN, ZEN_PLUME_SCAFFOLD_RADIUS_GAIN } from '../plume/ZenBonsaiPlumeCrownAppearance.js';
import { fitZenBonsaiPlumeHomeCamera, resolveZenBonsaiPlumeHomeOrientation } from '../plume/ZenBonsaiPlumeHomeFraming.js';
import { ZEN_PLUME_MAXIMUM_SWAY_ANGLE_RAD } from '../plume/live/motion.js';
import { resolveZenHomeFrameSeamProfile } from './zenHomeFrameSeamGeometry.js';
import { normalizeZenHomeGardenBedLayoutFrame } from './zenHomeGardenBedProjectionContract.js';

const CONTRACT = 'zen-home-canopy-reading-envelope-v2';
const BAND_COUNT = 64;

export function requireZenHomeCanopyReadingEnvelope(value) {
  if (!value || value.contract !== CONTRACT || typeof value.layoutSignature !== 'string'
    || !value.layoutSignature || !Number.isFinite(value.minimumXRatio)
    || value.minimumXRatio < 0 || value.minimumXRatio >= 1
    || !Array.isArray(value.bands) || value.bands.length !== BAND_COUNT
    || !value.bands.every(item => item === null || (Number.isFinite(item) && item >= 0 && item < 1))
    || !value.bands.some(item => item !== null)
    || Math.min(...value.bands.filter(item => item !== null)) !== value.minimumXRatio) {
    throw Error('ZEN_HOME_CANOPY_READING_ENVELOPE_INVALID');
  }
  return value;
}

// Evaluate the same rooted Home camera in continuous CSS coordinates. Raster
// DPR/quality, current organ visibility and live weather cannot move this line.
export function resolveZenHomeCanopyReadingEnvelope({ cameraSnapshots, layoutFrame }) {
  const frame = normalizeZenHomeGardenBedLayoutFrame(layoutFrame);
  if (frame.support !== 'frame-seam') throw Error('ZEN_HOME_CANOPY_READING_SUPPORT_INVALID');
  const scene = frame.sceneViewport, seam = resolveZenHomeFrameSeamProfile(frame);
  const width = scene.x + scene.width, height = scene.height;
  const { bounds } = resolveZenBonsaiPlumeCameraEnvelope(cameraSnapshots, { includePot: false });
  const root = { x: 0, y: 0, z: 0 };
  const orientation = resolveZenBonsaiPlumeHomeOrientation(cameraSnapshots, bounds, root);
  const orientedBounds = orientation.horizontalSign === 1 ? bounds
    : { ...bounds, minX: -bounds.maxX, maxX: -bounds.minX, structuralX: -bounds.structuralX };
  const camera = fitZenBonsaiPlumeHomeCamera(orientedBounds, width, height, {
    includePot: false, orientation,
    cameraAnchor: {
      world: root,
      framingViewport: { x: scene.x, y: 0, width: scene.width, height },
      plantingSeam: {
        left: { x: seam.left.x, y: seam.left.y - scene.y },
        right: { x: seam.right.x, y: seam.right.y - scene.y },
        buriedDepth: seam.buriedDepth, preferredRootX: seam.plantingAnchor.x,
      },
    },
  });
  const maximumAngle = ZEN_PLUME_MAXIMUM_SWAY_ANGLE_RAD;
  const bands = Array(BAND_COUNT).fill(null);
  const include = points => {
    let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
    for (const [worldX, worldY] of points) {
      const x = worldX * orientation.horizontalSign * camera.scale, y = -worldY * camera.scale;
      const angles = [-maximumAngle, 0, maximumAngle];
      // Include both X and Y stationary points over the complete wind arc.
      for (const base of [Math.atan2(-y, x), Math.atan2(x, y)]) {
        for (let turn = -2; turn <= 2; turn++) {
          const angle = base + turn * Math.PI;
          if (Math.abs(angle) <= maximumAngle) angles.push(angle);
        }
      }
      for (const angle of angles) {
        const px = camera.x + x * Math.cos(angle) - y * Math.sin(angle);
        const py = camera.y + x * Math.sin(angle) + y * Math.cos(angle);
        left = Math.min(left, px); right = Math.max(right, px);
        top = Math.min(top, py); bottom = Math.max(bottom, py);
      }
    }
    if (right < 0 || left >= width || bottom < 0 || top >= height) return;
    const first = Math.max(0, Math.floor(top / height * BAND_COUNT));
    const last = Math.min(BAND_COUNT - 1, Math.floor(bottom / height * BAND_COUNT));
    for (let index = first; index <= last; index++) {
      const ratio = Math.max(0, left) / width;
      bands[index] = bands[index] === null ? ratio : Math.min(bands[index], ratio);
    }
  };
  const box = (points, reserve) => {
    const xs = points.map(point => point[0]), ys = points.map(point => point[1]);
    const l = Math.min(...xs) - reserve, r = Math.max(...xs) + reserve;
    const b = Math.min(...ys) - reserve, t = Math.max(...ys) + reserve;
    include([[l, b], [l, t], [r, b], [r, t]]);
  };
  for (const snapshot of cameraSnapshots) {
    if (!Array.isArray(snapshot.woodSegments)) throw Error('ZEN_HOME_CANOPY_READING_WOOD_REQUIRED');
    const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
    for (const segment of snapshot.woodSegments) {
      const start = nodes.get(segment.parentNodeId), end = nodes.get(segment.childNodeId);
      if (!start || !end) throw Error('ZEN_HOME_CANOPY_READING_WOOD_INVALID');
      box([start.p, end.p], Math.max(start.radius, end.radius) * ZEN_PLUME_SCAFFOLD_RADIUS_GAIN + 9);
    }
    for (const flower of snapshot.flowers) {
      box([flower.position], flower.radius * (1 + flower.cup) * ZEN_PLUME_FLOWER_RADIUS_GAIN.max + 9);
      box([flower.pedicel.start, flower.pedicel.end], 9);
    }
    for (const tip of snapshot.livingTips) box([tip.p], tip.radius * 4 + 9);
  }
  return Object.freeze(requireZenHomeCanopyReadingEnvelope({
    contract: CONTRACT,
    layoutSignature: JSON.stringify(frame),
    // The renderer clips tree paint to this viewport. Transparent allocation
    // is never itself an exclusion region.
    minimumXRatio: Math.min(...bands.filter(value => value !== null)),
    bands: Object.freeze(bands),
  }));
}
