import { ROOM478_GARDEN_FURIN } from './room478Garden.js';

const ROOM478_REQUIRED_SELECTORS = Object.freeze({
  departureWhisper: '[data-room478-departure-whisper]',
  ensoMoonCore: '[data-room478-enso-moon-core]',
  ensoStage: '[data-room478-enso-stage]',
  ensoStroke: '[data-room478-enso-stroke]',
  exitButton: '[data-room478-exit]',
  groundingHint: '[data-room478-grounding-hint]',
  garden: '[data-room478-garden]',
  gardenStage: '[data-room478-garden-stage]',
  gardenImage: '[data-room478-garden-image]',
  gardenWater: '[data-room478-garden-water]',
  gardenReflection: '[data-room478-garden-reflection]',
  gardenFurin: '[data-room478-garden-furin]',
  gardenFurinImage: '[data-room478-garden-furin-image]',
  gardenError: '[data-room478-garden-error]',
  orbitDots: '[data-room478-orbit-dots]',
  phaseWhisper: '[data-room478-phase]',
  repeatButton: '[data-room478-repeat]',
  stardust: '[data-room478-stardust]',
  status: '[data-room478-status]',
});

function escapeRoom478Text(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function createRoom478Markup(copy) {
  if (!copy || typeof copy !== 'object') {
    throw new Error('room_478_copy_contract_missing');
  }
  const breathingLabel = escapeRoom478Text(copy.breathingLabel);
  const returnLabel = escapeRoom478Text(copy.return);
  if (typeof copy.repeat !== 'string') throw new Error('room_478_repeat_copy_missing');
  const repeatLabel = escapeRoom478Text(copy.repeat);
  const groundingHint = escapeRoom478Text(copy.groundingHint || '');
  const departureNotice = escapeRoom478Text(copy.departureNotice || '');

  return `
    <main class="room-478" data-stage="arrival" data-phase="arrival" data-room478-garden-paused="true" data-room478-root>
      <div class="room-478__world" aria-hidden="true">
        <div class="room-478__hybrid-garden" data-room478-garden>
          <div class="room-478__garden-stage" data-room478-garden-stage>
            <img class="room-478__garden-plate" data-room478-garden-image alt="" draggable="false" decoding="async">
            <div class="room-478__garden-water" data-room478-garden-water>
              <div class="room-478__garden-reflection" data-room478-garden-reflection></div>
            </div>
            <div class="room-478__garden-furin" data-room478-garden-furin>
              <img data-room478-garden-furin-image src="${ROOM478_GARDEN_FURIN.href}" alt="" draggable="false" decoding="async">
            </div>
          </div>
        </div>

        <div class="room-478__stardust" data-room478-stardust hidden>
          <i class="room-478__star room-478__star--1" style="--star-x: 14%; --star-y: 22%;"></i>
          <i class="room-478__star room-478__star--2" style="--star-x: 28%; --star-y: 68%;"></i>
          <i class="room-478__star room-478__star--3" style="--star-x: 35%; --star-y: 18%;"></i>
          <i class="room-478__star room-478__star--4" style="--star-x: 48%; --star-y: 78%;"></i>
          <i class="room-478__star room-478__star--5" style="--star-x: 62%; --star-y: 15%;"></i>
          <i class="room-478__star room-478__star--6" style="--star-x: 72%; --star-y: 62%;"></i>
          <i class="room-478__star room-478__star--7" style="--star-x: 82%; --star-y: 28%;"></i>
          <i class="room-478__star room-478__star--8" style="--star-x: 88%; --star-y: 74%;"></i>
          <i class="room-478__star room-478__star--9" style="--star-x: 20%; --star-y: 84%;"></i>
          <i class="room-478__star room-478__star--10" style="--star-x: 78%; --star-y: 86%;"></i>
          <i class="room-478__star room-478__star--11" style="--star-x: 42%; --star-y: 32%;"></i>
          <i class="room-478__star room-478__star--12" style="--star-x: 66%; --star-y: 38%;"></i>
        </div>


        <div class="room-478__glass-memory"></div>
        <div class="room-478__grain"></div>
        <div class="room-478__vignette"></div>
      </div>

      <button class="room-478__exit" data-room478-exit type="button">${returnLabel}</button>

      <p class="room-478__garden-error" data-room478-garden-error role="alert" hidden></p>

      <div class="room-478__enso-stage" data-room478-enso-stage aria-hidden="true">
        <div class="room-478__enso-halo"></div>
        <div class="room-478__enso-moon-core" data-room478-enso-moon-core></div>
        <svg class="room-478__enso-svg" viewBox="0 0 200 200" role="presentation">
          <circle class="room-478__enso-track" cx="100" cy="100" r="76.08" />
          <circle class="room-478__enso-stroke" data-room478-enso-stroke cx="100" cy="100" r="76.08" />
          <circle class="room-478__enso-resonance" cx="100" cy="100" r="76.08" />
        </svg>
        <div class="room-478__enso-vapor">
          <i></i><i></i><i></i><i></i>
        </div>
        <div class="room-478__orbit-dots" data-room478-orbit-dots aria-hidden="true">
          <span class="room-478__orbit-dot" data-room478-orbit-dot="1" data-dot-state="dormant"></span>
          <span class="room-478__orbit-dot" data-room478-orbit-dot="2" data-dot-state="dormant"></span>
          <span class="room-478__orbit-dot" data-room478-orbit-dot="3" data-dot-state="dormant"></span>
          <span class="room-478__orbit-dot" data-room478-orbit-dot="4" data-dot-state="dormant"></span>
        </div>
      </div>

      <div class="room-478__grounding-hint" data-room478-grounding-hint aria-hidden="true">
        <span class="room-478__key-badge">SPACE</span>
        <span class="room-478__grounding-text">${groundingHint}</span>
      </div>

      <div class="room-478__departure-whisper" data-room478-departure-whisper aria-hidden="true">
        <p class="room-478__departure-text">${departureNotice}</p>
      </div>

      <section class="room-478__breath" aria-label="${breathingLabel}">
        <div class="room-478__breath-line" aria-hidden="true"><i></i></div>
        <p class="room-478__phase" data-room478-phase aria-hidden="true"></p>
        <p class="room-478__status room-478__sr-only" data-room478-status aria-live="polite"></p>
        <button class="room-478__repeat" data-room478-repeat type="button" disabled hidden>${repeatLabel}</button>
      </section>
    </main>
  `;
}

export function mountRoom478Surface(container, copy) {
  if (!(container instanceof Element)) {
    throw new Error('room_478_mount_container_missing');
  }
  container.innerHTML = createRoom478Markup(copy);
  const root = container.querySelector('[data-room478-root]');
  if (!(root instanceof HTMLElement)) {
    throw new Error('room_478_surface_root_missing');
  }
  return root;
}

export function resolveRoom478Surface(root) {
  if (!(root instanceof HTMLElement) || !root.matches('[data-room478-root]')) {
    throw new Error('room_478_surface_root_invalid');
  }
  const surface = { root };
  Object.entries(ROOM478_REQUIRED_SELECTORS).forEach(([key, selector]) => {
    const element = root.querySelector(selector);
    if (!element) {
      throw new Error(`room_478_surface_ref_missing:${key}`);
    }
    surface[key] = element;
  });
  surface.orbitDotElements = Object.freeze(
    Array.from(root.querySelectorAll('[data-room478-orbit-dot]')),
  );
  return Object.freeze(surface);
}
