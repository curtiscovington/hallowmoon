import { useEffect, useId, useRef } from 'react';
import { PERSONA_OPTIONS, type PersonaOptionDefinition } from '../constants/personaOptions';
import { useDisableBodyScroll } from '../hooks/useDisableBodyScroll';

interface PersonaSelectOverlayProps {
  options?: readonly PersonaOptionDefinition[];
  onSelect: (templateKey: string) => void;
}

export function PersonaSelectOverlay({
  options = PERSONA_OPTIONS,
  onSelect
}: PersonaSelectOverlayProps) {
  const titleId = useId();
  const descriptionId = useId();
  const firstButtonRef = useRef<HTMLButtonElement | null>(null);

  useDisableBodyScroll();

  useEffect(() => {
    firstButtonRef.current?.focus();
  }, []);

  return (
    <div className="persona-overlay">
      <div className="persona-overlay__backdrop" aria-hidden="true" />
      <div
        className="persona-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="persona-overlay__header">
          <p className="persona-overlay__eyebrow">Invocation</p>
          <h1 id={titleId} className="persona-overlay__title">
            Choose your persona
          </h1>
          <div id={descriptionId} className="persona-overlay__prologue">
            <p>To exist here, you must first take form.</p>
            <p>A Persona — the mask of intent, the echo of your will.</p>
            <p>Which face will you wear as you step into the world?</p>
          </div>
        </header>
        <ul className="persona-overlay__grid" role="list">
          {options.map((option, index) => (
            <li key={option.templateKey} className="persona-overlay__item" role="listitem">
              <button
                type="button"
                className={`persona-card persona-card--${option.accent}`}
                onClick={() => onSelect(option.templateKey)}
                ref={index === 0 ? firstButtonRef : undefined}
              >
                <span className="persona-card__glow" aria-hidden="true" />
                <span className="persona-card__body">
                  <span className="persona-card__glyph" aria-hidden="true">
                    {option.glyph}
                  </span>
                  <span className="persona-card__name">{option.name}</span>
                  <span className="persona-card__summary">{option.summary}</span>
                  <span className="persona-card__quote">{option.quote}</span>
                  <span className="persona-card__cta">Become {option.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
