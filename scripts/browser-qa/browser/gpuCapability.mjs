const KNOWN_HARDWARE_VENDOR_IDS = new Set([
  0x1002,
  0x1010,
  0x106b,
  0x10de,
  0x13b5,
  0x5143,
  0x8086,
]);

const SOFTWARE_RENDERER_EVIDENCE_PATTERN = /(?:swiftshader|llvmpipe|softpipe|lavapipe|swrast|software\s+(?:raster|render)|microsoft\s+basic\s+render\s+driver|\bwarp\b)/iu;
const HARDWARE_RENDERER_EVIDENCE_PATTERN = /(?:\bnvidia\b|\bamd\b|\bradeon\b|ati\s+technologies|\bintel\b|\bapple\b|\bqualcomm\b|\badreno\b|\bmali\b|\bpowervr\b|imagination\s+technologies)/iu;

function projectDevice(device) {
  return Object.freeze({
    vendorId: device?.vendorId !== null
      && device?.vendorId !== undefined
      && Number.isFinite(Number(device.vendorId))
      ? Number(device.vendorId)
      : null,
    deviceId: device?.deviceId !== null
      && device?.deviceId !== undefined
      && Number.isFinite(Number(device.deviceId))
      ? Number(device.deviceId)
      : null,
    vendorString: typeof device?.vendorString === 'string' ? device.vendorString : null,
    deviceString: typeof device?.deviceString === 'string' ? device.deviceString : null,
    driverVendor: typeof device?.driverVendor === 'string' ? device.driverVendor : null,
    driverVersion: typeof device?.driverVersion === 'string' ? device.driverVersion : null,
  });
}

export function projectQaBrowserGpuCapability(raw) {
  const devices = Object.freeze(
    (Array.isArray(raw?.gpu?.devices) ? raw.gpu.devices : [])
      .slice(0, 4)
      .map(projectDevice),
  );
  const auxAttributes = raw?.gpu?.auxAttributes && typeof raw.gpu.auxAttributes === 'object'
    ? raw.gpu.auxAttributes
    : {};
  const glRenderer = typeof auxAttributes.glRenderer === 'string'
    ? auxAttributes.glRenderer
    : null;
  const glVendor = typeof auxAttributes.glVendor === 'string'
    ? auxAttributes.glVendor
    : null;
  const activeRendererEvidence = [glRenderer, glVendor].filter(Boolean).join(' ');
  const deviceEvidence = devices.flatMap((device) => [
    device.vendorString,
    device.deviceString,
    device.driverVendor,
  ]).filter(Boolean).join(' ');
  const featureStatus = Object.freeze(
    raw?.gpu?.featureStatus && typeof raw.gpu.featureStatus === 'object'
      ? Object.fromEntries(Object.entries(raw.gpu.featureStatus)
        .filter(([, value]) => typeof value === 'string'))
      : {},
  );
  const explicitWebglIneligibility = Object.entries(featureStatus)
    .some(([name, status]) => (
      /^webgl(?:2)?$/iu.test(name)
      && /(?:disabled|unavailable|software)/iu.test(status)
    ));
  const activeSoftwareEvidence = SOFTWARE_RENDERER_EVIDENCE_PATTERN
    .test(activeRendererEvidence);
  const activeHardwareEvidence = HARDWARE_RENDERER_EVIDENCE_PATTERN
    .test(activeRendererEvidence);
  const deviceSoftwareEvidence = SOFTWARE_RENDERER_EVIDENCE_PATTERN
    .test(deviceEvidence);
  const deviceHardwareEvidence = HARDWARE_RENDERER_EVIDENCE_PATTERN
    .test(deviceEvidence)
    || devices.some((device) => (
      KNOWN_HARDWARE_VENDOR_IDS.has(device.vendorId)
      && Number.isInteger(device.deviceId)
      && device.deviceId > 0
    ));

  // Installed/advertised devices prove availability only. Admission to a
  // physical-GPU run requires evidence from the renderer Chrome is actively
  // using, so a dormant NVIDIA device cannot turn SwiftShader into hardware.
  const activeRendererClass = activeSoftwareEvidence
    ? 'software'
    : activeHardwareEvidence && !explicitWebglIneligibility
      ? 'hardware'
      : 'unclassified';
  const hardwareAvailability = activeHardwareEvidence || deviceHardwareEvidence
    ? 'available'
    : activeSoftwareEvidence || deviceSoftwareEvidence
      ? 'not_detected'
      : 'unclassified';
  const hardwareActive = activeRendererClass === 'hardware'
    ? true
    : activeRendererClass === 'software'
      ? false
      : null;
  const hardwareAvailable = hardwareAvailability === 'available'
    ? true
    : hardwareAvailability === 'not_detected'
      ? false
      : null;

  return Object.freeze({
    status: 'classified',
    devices,
    glRenderer,
    glVendor,
    displayType: typeof auxAttributes.displayType === 'string'
      ? auxAttributes.displayType
      : null,
    activeRendererClass,
    activeRendererEvidenceSource: activeRendererClass === 'unclassified'
      ? 'unclassified'
      : 'active_renderer',
    hardwareActive,
    hardwareAvailability,
    hardwareAvailable,
    // Compatibility names now describe active evidence only. They never fall
    // back to the device inventory.
    rendererEvidenceClass: activeRendererClass,
    rendererEvidenceSource: activeRendererClass === 'unclassified'
      ? 'unclassified'
      : 'active_renderer',
    softwareRendererDetected: activeRendererClass === 'software'
      ? true
      : activeRendererClass === 'hardware'
        ? false
        : null,
    featureStatus,
  });
}

export function assertQaBrowserGpuRequirement(capability, renderingRequirement) {
  if (renderingRequirement !== 'physical_gpu_required') return capability;
  if (capability?.activeRendererClass !== 'hardware') {
    const evidenceClass = capability?.activeRendererClass
      || capability?.rendererEvidenceClass
      || capability?.status
      || 'missing';
    const error = new Error(`QA_BROWSER_PHYSICAL_GPU_REQUIRED:${evidenceClass}`);
    error.code = 'QA_BROWSER_PHYSICAL_GPU_REQUIRED';
    error.capability = capability || null;
    throw error;
  }
  return capability;
}

export async function probeQaBrowserGpuCapability(cdp, {
  renderingRequirement = 'headless_ok',
} = {}) {
  let capability;
  try {
    capability = projectQaBrowserGpuCapability(
      await cdp.send('SystemInfo.getInfo'),
    );
  } catch (error) {
    capability = Object.freeze({
      status: 'unavailable',
      activeRendererClass: 'unclassified',
      activeRendererEvidenceSource: 'unavailable',
      hardwareActive: null,
      hardwareAvailability: 'unclassified',
      hardwareAvailable: null,
      rendererEvidenceClass: 'unclassified',
      rendererEvidenceSource: 'unavailable',
      softwareRendererDetected: null,
      error: error?.message || String(error),
    });
  }
  return assertQaBrowserGpuRequirement(capability, renderingRequirement);
}
