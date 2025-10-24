import { useEffect } from 'react';

export function useDisableBodyScroll(active = true): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') {
      return () => undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);
}
