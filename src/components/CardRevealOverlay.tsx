import { useEffect, useId, useRef, useState } from 'react';
import type { CardInstance } from '../state/types';

interface CardRevealOverlayProps {
  card: CardInstance;
  onClose: () => void;
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

export function CardRevealOverlay({ card, onClose }: CardRevealOverlayProps) {
  const [stage, setStage] = useState<'intro' | 'outro'>('intro');
  const cardRef = useRef<HTMLDivElement | null>(null);
  const acknowledgeButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeCalledRef = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useDisableBodyScroll();

  useEffect(() => {
    acknowledgeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    if (stage !== 'outro') {
      return () => undefined;
    }

    const element = cardRef.current;
    if (!element) {
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

    element.addEventListener('transitionend', handleComplete);
    const timeout = window.setTimeout(handleComplete, 420);

    return () => {
      element.removeEventListener('transitionend', handleComplete);
      window.clearTimeout(timeout);
    };
  }, [onClose, stage]);

  const permanenceLabel = card.permanent ? 'Permanent' : 'Fleeting';
  const lifetimeLabel = !card.permanent && card.remainingTurns !== null ? `${card.remainingTurns} cycles` : null;

  const handleAcknowledge = () => {
    if (stage !== 'intro') {
      return;
    }
    setStage('outro');
  };

  return (
    <div className={`card-reveal${stage === 'outro' ? ' card-reveal--closing' : ''}`}>
      <div className="card-reveal__backdrop" aria-hidden="true" />
      <div
        className="card-reveal__content"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div
          ref={cardRef}
          className={`card-reveal__card${stage === 'outro' ? ' card-reveal__card--outro' : ''}`}
        >
          <header className="card-reveal__header">
            <span className="card-reveal__tag">{card.type}</span>
            <span className="card-reveal__tag">{permanenceLabel}</span>
            {lifetimeLabel ? <span className="card-reveal__tag">{lifetimeLabel}</span> : null}
          </header>
          <h2 id={titleId} className="card-reveal__name">
            {card.name}
          </h2>
          <p id={descriptionId} className="card-reveal__description">
            {card.description}
          </p>
          {card.traits.length > 0 ? (
            <p className="card-reveal__traits">Traits: {card.traits.join(' · ')}</p>
          ) : null}
          <button
            ref={acknowledgeButtonRef}
            type="button"
            className="card-reveal__button"
            onClick={handleAcknowledge}
          >
            Claim card
          </button>
        </div>
      </div>
    </div>
  );
}
