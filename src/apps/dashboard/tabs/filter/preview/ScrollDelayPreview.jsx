import React, { useEffect, useRef } from 'react';
import {
  FROSTED_STONE_MATERIAL,
  advanceFrostedStoneMotion,
  applyFrostedStoneImpulse,
  createFrostedStoneMotionState,
  createFrostedStoneStepOutput,
  dissipateFrostedStoneMotion,
  hasFrostedStoneMotion,
  zeroFrostedStoneMomentumAxis,
} from '../../../../../domains/nudge/behavior/frostedStoneDynamics.js';
import {
  createScrollGestureOwnershipState,
  isScrollGestureAxisLeaseActive,
  resolveScrollGestureInput,
} from '../../../../../domains/nudge/behavior/scrollGestureOwnership.js';

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);
const MOTION_DELTA_EPSILON_PX = 0.02;

function normalizeDelay(value) {
  if (Number.isFinite(value)) return Math.max(0, value);
  const parsed = parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return setTimeout(() => callback(Date.now()), 16);
}

function cancelFrame(id) {
  if (id == null) return;
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(id);
  else clearTimeout(id);
}

export default function ScrollDelayPreview({
  delayMs = 0,
  scrollTop = null,
  onScroll,
  className = '',
  children,
  ...props
}) {
  const containerRef = useRef(null);
  const state = useRef({
    controllers: new Map(),
    gesture: createScrollGestureOwnershipState(),
  });

  const clearControllers = () => {
    state.current.controllers.forEach((controller) => {
      cancelFrame(controller.rafId);
    });
    state.current.controllers.clear();
    state.current.gesture = createScrollGestureOwnershipState();
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (Number.isFinite(scrollTop)) {
      if (Math.abs(container.scrollTop - scrollTop) > 1) {
        container.scrollTop = scrollTop;
      }
    }
  }, [scrollTop]);

  useEffect(() => {
    const container = containerRef.current;
    const delay = normalizeDelay(delayMs);
    if (!container || delay <= 0) {
      clearControllers();
      return;
    }

    const canScrollAxis = (el, axis, delta) => {
      if (!el || !(el instanceof Element)) return false;
      const style = getComputedStyle(el);
      const overflow = axis === 'y' ? style.overflowY : style.overflowX;
      if (!SCROLLABLE_OVERFLOW.has(overflow)) return false;

      if (axis === 'y') {
        if (el.scrollHeight <= el.clientHeight) return false;
        if (delta < 0 && el.scrollTop <= 0) return false;
        if (delta > 0 && el.scrollTop + el.clientHeight >= el.scrollHeight - 1) return false;
        return true;
      }

      if (el.scrollWidth <= el.clientWidth) return false;
      if (delta < 0 && el.scrollLeft <= 0) return false;
      if (delta > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) return false;
      return true;
    };

    const findOwnedScrollSurface = (startEl, axis) => {
      let el = startEl;
      while (el && el !== container) {
        if (canScrollAxis(el, axis, -1) || canScrollAxis(el, axis, 1)) return el;
        el = el.parentElement;
      }
      return canScrollAxis(container, axis, -1) || canScrollAxis(container, axis, 1)
        ? container
        : null;
    };

    const hasKineticEnergy = (controller) => hasFrostedStoneMotion(controller.motion);

    const getController = (target) => {
      let controller = state.current.controllers.get(target);
      if (controller) return controller;
      controller = {
        target,
        motion: createFrostedStoneMotionState(),
        stepOutput: createFrostedStoneStepOutput(),
        rafId: null,
        lastFrameAt: 0,
      };
      state.current.controllers.set(target, controller);
      return controller;
    };

    const removeController = (controller) => {
      if (!controller) return;
      cancelFrame(controller.rafId);
      for (const axis of ['x', 'y']) {
        const lease = state.current.gesture[axis];
        if (lease.target === controller.target) {
          lease.target = null;
          lease.lastInputAt = null;
        }
      }
      state.current.controllers.delete(controller.target);
    };

    const releaseControllerAxis = (controller, axis) => {
      if (!controller) return;
      zeroFrostedStoneMomentumAxis(controller.motion, axis);
      if (!hasKineticEnergy(controller)) removeController(controller);
    };

    const resolveGestureDeltas = (deltaX, deltaY, now) => {
      return resolveScrollGestureInput(state.current.gesture, deltaX, deltaY, now);
    };

    const resolveGestureTarget = (startEl, axis, delta, now) => {
      const lease = state.current.gesture[axis];
      const leaseActive = isScrollGestureAxisLeaseActive(
        state.current.gesture,
        axis,
        now,
        lease.target?.isConnected === true,
      );
      if (leaseActive) {
        const controller = state.current.controllers.get(lease.target);
        const momentum = axis === 'x'
          ? controller?.motion?.momentumX
          : controller?.motion?.momentumY;
        if (
          (momentum && Math.sign(momentum) !== Math.sign(delta))
          || canScrollAxis(lease.target, axis, delta)
        ) {
          lease.lastInputAt = now;
          return lease.target;
        }
        lease.lastInputAt = now;
        return lease.target;
      }
      const target = findOwnedScrollSurface(startEl, axis);
      lease.target = target;
      lease.lastInputAt = target ? now : null;
      return target;
    };

    const applyManagedDelta = (target, deltaX, deltaY) => {
      if (
        Math.abs(deltaX) <= MOTION_DELTA_EPSILON_PX
        && Math.abs(deltaY) <= MOTION_DELTA_EPSILON_PX
      ) {
        return { x: 0, y: 0 };
      }
      const beforeX = target.scrollLeft || 0;
      const beforeY = target.scrollTop || 0;
      target.scrollBy({
        left: deltaX,
        top: deltaY,
        behavior: 'instant',
      });
      return {
        x: (target.scrollLeft || 0) - beforeX,
        y: (target.scrollTop || 0) - beforeY,
      };
    };

    const stepController = (controller, now = Date.now()) => {
      if (!controller.target.isConnected) {
        state.current.controllers.delete(controller.target);
        return false;
      }
      const elapsedMs = controller.lastFrameAt
        ? Math.max(0, now - controller.lastFrameAt)
        : 0;
      const maxFrameMs = FROSTED_STONE_MATERIAL.maxFrameSeconds * 1000;
      const skippedMs = Math.max(0, elapsedMs - maxFrameMs);
      controller.lastFrameAt = now;
      if (skippedMs > 0) {
        dissipateFrostedStoneMotion(controller.motion, skippedMs / 1000);
        if (!hasKineticEnergy(controller)) return false;
      }
      const dtMs = Math.min(elapsedMs, maxFrameMs);
      if (dtMs <= 0) return hasKineticEnergy(controller);

      const step = advanceFrostedStoneMotion(
        controller.motion,
        dtMs / 1000,
        controller.stepOutput,
      );
      const stepX = step.deltaX;
      const stepY = step.deltaY;
      const applied = applyManagedDelta(controller.target, stepX, stepY);

      const xBlocked = Math.abs(stepX) > 0.5 && Math.abs(applied.x) < Math.abs(stepX) * 0.35;
      const yBlocked = Math.abs(stepY) > 0.5 && Math.abs(applied.y) < Math.abs(stepY) * 0.35;
      if (xBlocked) releaseControllerAxis(controller, 'x');
      if (yBlocked) releaseControllerAxis(controller, 'y');
      return hasKineticEnergy(controller);
    };

    const scheduleController = (controller) => {
      if (!hasKineticEnergy(controller) || controller.rafId !== null) return;
      controller.rafId = scheduleFrame(() => {
        controller.rafId = null;
        if (stepController(controller)) {
          scheduleController(controller);
        } else {
          state.current.controllers.delete(controller.target);
        }
      });
    };

    const applyPhysics = (target, deltaX, deltaY) => {
      if (!target) return;
      const controller = getController(target);
      const now = Date.now();
      stepController(controller, now);
      applyFrostedStoneImpulse(controller.motion, deltaX, deltaY);
      controller.lastFrameAt = now;
      scheduleController(controller);
    };

    const onWheel = (event) => {
      const targetElement = event.target && event.target.nodeType === 1 ? event.target : container;
      const deltaX = Number.isFinite(event.deltaX) ? event.deltaX : 0;
      const deltaY = Number.isFinite(event.deltaY) ? event.deltaY : 0;
      const now = Date.now();
      const gestureInput = resolveGestureDeltas(deltaX, deltaY, now);

      const horizontalTarget = gestureInput.deltaX
        ? resolveGestureTarget(targetElement, 'x', gestureInput.deltaX, now)
        : null;
      const verticalTarget = gestureInput.deltaY
        ? resolveGestureTarget(targetElement, 'y', gestureInput.deltaY, now)
        : null;

      if (!horizontalTarget && !verticalTarget) return;

      event.preventDefault();
      event.stopPropagation();

      if (horizontalTarget && horizontalTarget === verticalTarget) {
        applyPhysics(horizontalTarget, gestureInput.deltaX, gestureInput.deltaY);
      } else {
        if (horizontalTarget) applyPhysics(horizontalTarget, gestureInput.deltaX, 0);
        if (verticalTarget) applyPhysics(verticalTarget, 0, gestureInput.deltaY);
      }
    };

    container.addEventListener('wheel', onWheel, { passive: false, capture: true });
    const resetGesture = () => {
      state.current.gesture = createScrollGestureOwnershipState();
    };
    container.addEventListener('focusin', resetGesture, { capture: true, passive: true });
    container.addEventListener('pointerdown', resetGesture, { capture: true, passive: true });
    container.addEventListener('keydown', resetGesture, { capture: true });
    window.addEventListener('blur', resetGesture, { capture: true });
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') resetGesture();
    };
    document.addEventListener('visibilitychange', onVisibilityChange, { capture: true });

    return () => {
      container.removeEventListener('wheel', onWheel, { capture: true });
      container.removeEventListener('focusin', resetGesture, { capture: true });
      container.removeEventListener('pointerdown', resetGesture, { capture: true });
      container.removeEventListener('keydown', resetGesture, { capture: true });
      window.removeEventListener('blur', resetGesture, { capture: true });
      document.removeEventListener('visibilitychange', onVisibilityChange, { capture: true });
      clearControllers();
    };
  }, [delayMs]);

  const handleScroll = (event) => {
    if (onScroll) onScroll(event.currentTarget.scrollTop);
  };

  return (
    <div ref={containerRef} className={className} onScroll={handleScroll} {...props}>
      {children}
    </div>
  );
}
