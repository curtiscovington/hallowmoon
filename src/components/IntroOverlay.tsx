import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useDisableBodyScroll } from '../hooks/useDisableBodyScroll';

interface IntroOverlayProps {
  entries: string[];
  heroName: string | null;
  manorName: string | null;
  onClose: () => void;
}

export function IntroOverlay({
  entries,
  heroName,
  manorName,
  onClose
}: IntroOverlayProps) {
  const closingEntry = useMemo(() => {
    if (heroName && manorName) {
      return `${heroName} pauses within ${manorName}, sensing stories quicken in the hush.`;
    }
    if (heroName) {
      return `${heroName} pauses within the manor, sensing stories quicken in the hush.`;
    }
    if (manorName) {
      return `You pause within ${manorName}, sensing stories quicken in the hush.`;
    }
    return 'You pause within the manor, sensing stories quicken in the hush.';
  }, [heroName, manorName]);
  const slides = useMemo(() => [...entries, closingEntry], [entries, closingEntry]);
  const totalSlides = slides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogTitleId = useId();
  const bodyId = useId();
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasPrevious = activeIndex > 0;
  const onFinalSlide = activeIndex >= totalSlides - 1;
  const progressLabel = `Verse ${activeIndex + 1} of ${totalSlides}`;

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
          <article className="intro-overlay__story">
            <h2 className="intro-overlay__title">
              {onFinalSlide ? 'The hush before the work' : 'Welcome to Hollowmoon Manor'}
            </h2>
            {slides[activeIndex].split('\n\n').map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </article>
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
            {onFinalSlide ? 'Enter the manor' : 'Continue'}
          </button>
        </footer>
      </div>
    </div>
  );
}
