import { useEffect, useState } from 'react';

const SUPPORT_SHORTCUT_CODE = 'KeyI';

export function useStorageSupportVisibility(isActive = true) {
  const [isStorageSupportVisible, setIsStorageSupportVisible] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setIsStorageSupportVisible(false);
      return undefined;
    }

    const handleKeydown = (event) => {
      if (!event.altKey || !event.shiftKey || event.code !== SUPPORT_SHORTCUT_CODE) return;
      event.preventDefault();
      setIsStorageSupportVisible((previous) => !previous);
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isActive]);

  return {
    isStorageSupportVisible,
    setIsStorageSupportVisible,
  };
}

export default useStorageSupportVisibility;
