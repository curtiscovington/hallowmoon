import { useEffect, useRef, type ReactNode } from 'react';

interface SlotDetailsOverlayProps {
  labelledBy: string;
  describedBy?: string;
  onClose: () => void;
  children: ReactNode;
}

function useDisableBodyScroll() {
  useEffect(() => {
    if (typeof document === 'undefined') {
      return () => undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}

export function SlotDetailsOverlay({ labelledBy, describedBy, onClose, children }: SlotDetailsOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useDisableBodyScroll();

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="slot-details-overlay">
      <div className="slot-details-overlay__backdrop" aria-hidden="true" onClick={onClose} />
      <div
        className="slot-details-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        <button
          ref={closeButtonRef}
          type="button"
          className="slot-details-overlay__close"
          onClick={onClose}
          aria-label="Close slot details"
        >
          ×
        </button>
        <div className="slot-details-overlay__content">{children}</div>
      </div>
    </div>
  );
}
