import { useEffect, useLayoutEffect, useRef } from 'react';

function readInlineStyle(style, key) {
  return key.startsWith('--') ? style.getPropertyValue(key) : style[key];
}

function writeInlineStyle(style, key, value) {
  if (key.startsWith('--')) {
    style.setProperty(key, value ?? '');
    return;
  }
  style[key] = value ?? '';
}

export default function BodyStyle({ classList = [], classToggles = {}, styles = {} }) {
  const originalRef = useRef({ classes: new Map(), styles: new Map() });
  const scrollLockRef = useRef({
    locked: false,
    scrollY: 0,
    position: '',
    top: '',
    left: '',
    right: '',
    width: '',
  });

  useLayoutEffect(() => {
    const body = document.body;
    if (!body) return;

    const original = originalRef.current;
    const lockState = scrollLockRef.current;
    const shouldLock = styles?.overflow === 'hidden';

    if (shouldLock && !lockState.locked) {
      const scrollY =
        window.scrollY ??
        document.documentElement?.scrollTop ??
        body.scrollTop ??
        0;

      lockState.locked = true;
      lockState.scrollY = Number.isFinite(scrollY) ? scrollY : 0;
      lockState.position = body.style.position;
      lockState.top = body.style.top;
      lockState.left = body.style.left;
      lockState.right = body.style.right;
      lockState.width = body.style.width;

      body.style.position = 'fixed';
      body.style.top = `-${lockState.scrollY}px`;
      body.style.left = '0';
      body.style.right = '0';
      body.style.width = '100%';
    } else if (!shouldLock && lockState.locked) {
      body.style.position = lockState.position ?? '';
      body.style.top = lockState.top ?? '';
      body.style.left = lockState.left ?? '';
      body.style.right = lockState.right ?? '';
      body.style.width = lockState.width ?? '';

      const y = lockState.scrollY || 0;
      lockState.locked = false;
      lockState.scrollY = 0;
      lockState.position = '';
      lockState.top = '';
      lockState.left = '';
      lockState.right = '';
      lockState.width = '';

      window.scrollTo(0, y);
    }

    classList.forEach((cls) => {
      if (!cls) return;
      if (!original.classes.has(cls)) {
        original.classes.set(cls, body.classList.contains(cls));
      }
      body.classList.add(cls);
    });

    Object.entries(classToggles || {}).forEach(([cls, enabled]) => {
      if (!cls) return;
      if (!original.classes.has(cls)) {
        original.classes.set(cls, body.classList.contains(cls));
      }
      body.classList.toggle(cls, !!enabled);
    });

    Object.entries(styles || {}).forEach(([key, value]) => {
      if (!key) return;
      if (!original.styles.has(key)) {
        original.styles.set(key, readInlineStyle(body.style, key));
      }
      writeInlineStyle(body.style, key, value);
    });
  }, [classList, classToggles, styles]);

  useEffect(
    () => () => {
      const body = document.body;
      if (!body) return;
      const original = originalRef.current;
      const lockState = scrollLockRef.current;
      if (lockState.locked) {
        body.style.position = lockState.position ?? '';
        body.style.top = lockState.top ?? '';
        body.style.left = lockState.left ?? '';
        body.style.right = lockState.right ?? '';
        body.style.width = lockState.width ?? '';
        window.scrollTo(0, lockState.scrollY || 0);
      }
      original.classes.forEach((hadClass, cls) => {
        if (hadClass) {
          body.classList.add(cls);
        } else {
          body.classList.remove(cls);
        }
      });
      original.styles.forEach((value, key) => {
        writeInlineStyle(body.style, key, value);
      });
    },
    []
  );

  return null;
}
