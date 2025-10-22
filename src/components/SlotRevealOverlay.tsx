import { useEffect, useId, useRef, useState } from 'react';
import type { Slot } from '../state/types';
import { SLOT_TYPE_INFO } from '../constants/slotTypeInfo';

interface SlotRevealOverlayProps {
  slot: Slot;
  onClose: () => void;
}

function usePrefersReducedMotion() {
  const prefersRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return () => undefined;
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersRef.current = mediaQuery.matches;

    const handleChange = (event: MediaQueryListEvent) => {
      prefersRef.current = event.matches;
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  return prefersRef;
}

export function SlotRevealOverlay({ slot, onClose }: SlotRevealOverlayProps) {
  const [stage, setStage] = useState<'intro' | 'outro'>('intro');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const closeCalledRef = useRef(false);
  const prefersReducedMotionRef = usePrefersReducedMotion();
  const titleId = useId();
  const descriptionId = useId();
  const acknowledgeButtonRef = useRef<HTMLButtonElement | null>(null);

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

  useEffect(() => {
    closeCalledRef.current = false;
    setStage((current) => (current === 'intro' ? current : 'intro'));

    const cardElement = cardRef.current;
    if (cardElement) {
      cardElement.style.removeProperty('--slot-reveal-translate-x');
      cardElement.style.removeProperty('--slot-reveal-translate-y');
      cardElement.style.removeProperty('--slot-reveal-scale-x');
      cardElement.style.removeProperty('--slot-reveal-scale-y');
    }
  }, [slot.id]);

  useEffect(() => {
    acknowledgeButtonRef.current?.focus();
  }, [slot.id]);

  useEffect(() => {
    if (stage !== 'outro') {
      return () => undefined;
    }

    const cardElement = cardRef.current;
    if (!cardElement) {
      if (!closeCalledRef.current) {
        closeCalledRef.current = true;
        onClose();
      }
      return () => undefined;
    }

    const handleComplete = () => {
      if (closeCalledRef.current) {
        return;
      }
      closeCalledRef.current = true;
      onClose();
    };

    cardElement.addEventListener('transitionend', handleComplete);
    const fallbackTimeout = window.setTimeout(handleComplete, 420);

    return () => {
      cardElement.removeEventListener('transitionend', handleComplete);
      window.clearTimeout(fallbackTimeout);
    };
  }, [onClose, stage]);

  const handleAcknowledge = () => {
    if (stage !== 'intro') {
      return;
    }

    setStage('outro');

    if (prefersReducedMotionRef.current) {
      return;
    }

    const cardElement = cardRef.current;
    const targetElement = document.querySelector<HTMLElement>(`[data-slot-id="${slot.id}"]`);

    if (!cardElement || !targetElement) {
      return;
    }

    const cardRect = cardElement.getBoundingClientRect();
    const targetRect = targetElement.getBoundingClientRect();

    const translateX = targetRect.left + targetRect.width / 2 - (cardRect.left + cardRect.width / 2);
    const translateY = targetRect.top + targetRect.height / 2 - (cardRect.top + cardRect.height / 2);
    const scaleX = targetRect.width / cardRect.width;
    const scaleY = targetRect.height / cardRect.height;

    cardElement.style.setProperty('--slot-reveal-translate-x', `${translateX}px`);
    cardElement.style.setProperty('--slot-reveal-translate-y', `${translateY}px`);
    cardElement.style.setProperty('--slot-reveal-scale-x', `${scaleX}`);
    cardElement.style.setProperty('--slot-reveal-scale-y', `${scaleY}`);
  };

  const slotTypeInfo = SLOT_TYPE_INFO[slot.type];

  return (
    <div className={`slot-reveal${stage === 'outro' ? ' slot-reveal--closing' : ''}`}> 
      <div className="slot-reveal__backdrop" aria-hidden="true" />
      <div
        className="slot-reveal__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div
          ref={cardRef}
          className={`slot-reveal__card${stage === 'outro' ? ' slot-reveal__card--outro' : ''}`}
        >
          <span aria-hidden="true" className="slot-reveal__halo" />
          <span aria-hidden="true" className="slot-reveal__spark-ring" />
          <span className="slot-reveal__type">
            <span className="slot-reveal__type-icon" aria-hidden="true">
              {slotTypeInfo.icon}
            </span>
            <span className="slot-reveal__type-label">{slotTypeInfo.label}</span>
          </span>
          <h2 id={titleId} className="slot-reveal__name">
            {slot.name}
          </h2>
          <p id={descriptionId} className="slot-reveal__description">
            {slot.description}
          </p>
          <button
            ref={acknowledgeButtonRef}
            type="button"
            className="slot-reveal__button"
            onClick={handleAcknowledge}
          >
            Anchor this location
          </button>
        </div>
      </div>
    </div>
  );
}
