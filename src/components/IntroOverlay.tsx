import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDisableBodyScroll } from '../hooks/useDisableBodyScroll';

interface IntroOverlayProps {
  entries: string[];
  heroName: string | null;
  manorName: string | null;
  fleetingCardName: string | null;
  onClose: () => void;
}

export function IntroOverlay({
  entries,
  heroName,
  manorName,
  fleetingCardName,
  onClose
}: IntroOverlayProps) {
  const totalSlides = entries.length + 1;
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogTitleId = useId();
  const bodyId = useId();
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasPrevious = activeIndex > 0;
  const onFinalSlide = activeIndex >= entries.length;
  const progressLabel = `Step ${activeIndex + 1} of ${totalSlides}`;
  const heroLabel = heroName ?? 'your caretaker';
  const manorLabel = manorName ?? 'the manor';
  const fleetingLabel = fleetingCardName ?? 'your fleeting card';

  const orientationItems = useMemo(
    () => [
      {
        title: 'Scout the estate',
        description: `Drag ${heroLabel} onto ${manorLabel} to begin exploring and reveal new rooms.`
      },
      {
        title: 'Spend fleeting insights',
        description: `${fleetingLabel} will fade after a few cycles. Study it as soon as you uncover a desk.`
      },
      {
        title: 'Control the tempo',
        description:
          'Use the pause and speed controls above the board to plan between cycles. The chronicle drawer tracks the story so you can review it later.'
      }
    ],
    [fleetingLabel, heroLabel, manorLabel]
  );

  useDisableBodyScroll();

  useEffect(() => {
    primaryButtonRef.current?.focus();
  }, [activeIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleAdvance = () => {
    if (onFinalSlide) {
      onClose();
      return;
    }
    setActiveIndex((index) => Math.min(index + 1, totalSlides - 1));
  };

  const handleBack = () => {
    if (!hasPrevious) {
      return;
    }
    setActiveIndex((index) => Math.max(0, index - 1));
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="intro-overlay">
      <div className="intro-overlay__backdrop" aria-hidden="true" />
      <div
        className="intro-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        aria-describedby={bodyId}
      >
        <header className="intro-overlay__header">
          <div>
            <p id={dialogTitleId} className="intro-overlay__eyebrow">
              Prologue
            </p>
            <p className="intro-overlay__progress" aria-live="polite">
              {progressLabel}
            </p>
          </div>
          <button type="button" className="intro-overlay__skip" onClick={handleSkip}>
            Skip intro
          </button>
        </header>
        <div id={bodyId} className="intro-overlay__body">
          {onFinalSlide ? (
            <div className="intro-overlay__orientation">
              <h2 className="intro-overlay__title">Your first moves</h2>
              <ol className="intro-overlay__list">
                {orientationItems.map((item) => (
                  <li key={item.title} className="intro-overlay__list-item">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <article className="intro-overlay__story">
              <h2 className="intro-overlay__title">Welcome to Hollowmoon Manor</h2>
              <p>{entries[activeIndex]}</p>
            </article>
          )}
        </div>
        <footer className="intro-overlay__actions">
          <button
            type="button"
            className="intro-overlay__button intro-overlay__button--ghost"
            onClick={handleBack}
            disabled={!hasPrevious}
          >
            Back
          </button>
          <button
            ref={primaryButtonRef}
            type="button"
            className="intro-overlay__button"
            onClick={handleAdvance}
          >
            {onFinalSlide ? 'Begin caretaking' : 'Continue'}
          </button>
        </footer>
      </div>
    </div>
  );
}
