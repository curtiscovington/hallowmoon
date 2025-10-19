import { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from './state/GameContext';
import { CardInstance, Slot } from './state/types';

const CARD_DRAG_TYPE = 'application/x-hallowmoon-card';

const BASE_CYCLE_MS = 12000;
const TIMER_RESOLUTION_MS = 200;
const SPEED_OPTIONS = [0.5, 1, 2, 3] as const;

type SpeedOption = (typeof SPEED_OPTIONS)[number];

interface CardTimingContext {
  cycleDurationMs: number;
  timeToNextCycleMs: number;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return () => undefined;
    }

    const mediaQuery = window.matchMedia(query);

    const handleChange = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    setMatches(mediaQuery.matches);

    return () => {
      if (typeof mediaQuery.removeEventListener === 'function') {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}

function formatDuration(ms: number): string {
  const clamped = Math.max(0, ms);
  if (clamped >= 60000) {
    const minutes = Math.floor(clamped / 60000);
    const seconds = Math.round((clamped % 60000) / 1000);
    if (seconds === 0) {
      return `${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
  }
  if (clamped >= 10000) {
    return `${Math.round(clamped / 1000)}s`;
  }
  if (clamped >= 1000) {
    return `${(clamped / 1000).toFixed(1)}s`;
  }
  return `${clamped}ms`;
}

function describeCardExpiry(
  card: CardInstance,
  timing: CardTimingContext
): { cycles: number; durationMs: number; durationLabel: string } | null {
  if (card.permanent || card.remainingTurns === null) {
    return null;
  }

  const cyclesRemaining = Math.max(0, card.remainingTurns);
  if (cyclesRemaining === 0) {
    return { cycles: 0, durationMs: 0, durationLabel: formatDuration(0) };
  }

  const durationMs =
    timing.timeToNextCycleMs + Math.max(0, cyclesRemaining - 1) * timing.cycleDurationMs;

  return {
    cycles: cyclesRemaining,
    durationMs,
    durationLabel: formatDuration(durationMs)
  };
}

function formatSpeedDisplay(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function ResourceTrack({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="resource-track">
      <span className="resource-track__icon" aria-hidden="true">
        {icon}
      </span>
      <div className="resource-track__meta">
        <span className="resource-track__label">{label}</span>
        <span className="resource-track__value">{value}</span>
      </div>
    </div>
  );
}

function CardView({
  card,
  selected = false,
  onSelect,
  draggable = false,
  variant = 'hand',
  onDragStart,
  onDragEnd,
  timing
}: {
  card: CardInstance;
  selected?: boolean;
  onSelect?: (cardId: string) => void;
  draggable?: boolean;
  variant?: 'hand' | 'slot';
  onDragStart?: (cardId: string) => void;
  onDragEnd?: () => void;
  timing?: CardTimingContext;
}) {
  const expiryInfo = timing ? describeCardExpiry(card, timing) : null;
  const cyclesLabel =
    !card.permanent && card.remainingTurns !== null
      ? `${card.remainingTurns} cycle${card.remainingTurns === 1 ? '' : 's'} remain`
      : null;
  const permanenceLabel = card.permanent ? 'permanent' : 'fleeting';
  const traitsLabel = card.traits.length > 0 ? card.traits.join(' · ') : null;
  const interactive = Boolean(onSelect);
  const tokenClasses = ['card-token', `card-token--${variant}`];
  if (selected) {
    tokenClasses.push('card-token--selected');
  }
  if (draggable) {
    tokenClasses.push('card-token--draggable');
  }
  if (interactive) {
    tokenClasses.push('card-token--interactive');
  }

  return (
    <article
      className={tokenClasses.join(' ')}
      onClick={interactive ? () => onSelect?.(card.id) : undefined}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(card.id);
              }
            }
          : undefined
      }
      draggable={draggable}
      onDragStart={
        draggable
          ? (event) => {
              event.dataTransfer?.setData(CARD_DRAG_TYPE, card.id);
              event.dataTransfer?.setData('text/plain', card.name);
              event.dataTransfer.effectAllowed = 'move';
              onDragStart?.(card.id);
            }
          : undefined
      }
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      <header className="card-token__header">
        <span className="card-token__type">{card.type}</span>
        <span className="card-token__name">{card.name}</span>
      </header>
      <p className="card-token__description">{card.description}</p>
      <footer className="card-token__footer">
        <div className="card-token__footer-row">
          <span>
            {permanenceLabel}
            {cyclesLabel ? ` · ${cyclesLabel}` : ''}
          </span>
          {expiryInfo ? <span className="card-token__timer">≈ {expiryInfo.durationLabel}</span> : null}
        </div>
        {traitsLabel ? (
          <div className="card-token__footer-row card-token__footer-row--traits">{traitsLabel}</div>
        ) : null}
      </footer>
    </article>
  );
}

function describeSlotAcceptance(accepted: Slot['accepted']): string {
  switch (accepted) {
    case 'persona-only':
      return 'Accepts persona cards only';
    case 'non-persona':
      return 'Accepts non-persona cards';
    default:
      return 'Accepts any card';
  }
}

function SlotView({
  slot,
  occupant,
  isHeroInSlot,
  onClick,
  onActivate,
  onUpgrade,
  upgradeCost,
  onRecall,
  onDropCard,
  onCardDragStart,
  onCardDragEnd,
  timing,
  isTimePaused
}: {
  slot: Slot;
  occupant: CardInstance | null;
  isHeroInSlot: boolean;
  onClick: (slotId: string) => void;
  onActivate: (slotId: string) => void;
  onUpgrade: (slotId: string) => void;
  upgradeCost: number;
  onRecall: (cardId: string) => void;
  onDropCard: (cardId: string, slotId: string) => void;
  onCardDragStart: (cardId: string) => void;
  onCardDragEnd: () => void;
  timing: CardTimingContext;
  isTimePaused: boolean;
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const showDetails = isDesktop || isDetailsOpen;
  const detailsId = `slot-details-${slot.id}`;
  const occupancyLabel = occupant
    ? occupant.name
    : slot.unlocked
    ? 'Open for assignment'
    : 'Locked discovery';
  const acceptanceLabel = describeSlotAcceptance(slot.accepted);
  const occupantTraits = occupant && occupant.traits.length > 0 ? occupant.traits.join(' · ') : null;
  const slotClasses = ['slot-card'];
  if (!slot.unlocked) {
    slotClasses.push('slot-card--locked');
  }
  if (isDragOver && slot.unlocked) {
    slotClasses.push('slot-card--active');
  }
  if (!showDetails) {
    slotClasses.push('slot-card--collapsed');
  }

  const timerClasses = ['slot-card__timer'];
  if (isTimePaused) {
    timerClasses.push('slot-card__timer--paused');
  }

  const occupantExpiry = occupant ? describeCardExpiry(occupant, timing) : null;

  function acceptsCard(event: DragEvent<HTMLElement>) {
    return event.dataTransfer?.types.includes(CARD_DRAG_TYPE) ?? false;
  }

  function handleDragEnter(event: DragEvent<HTMLButtonElement>) {
    if (!slot.unlocked || !acceptsCard(event)) {
      return;
    }
    event.preventDefault();
    setIsDragOver(true);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    if (!slot.unlocked || !acceptsCard(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    if (!slot.unlocked) {
      return;
    }
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    if (!slot.unlocked) {
      return;
    }
    const cardId = event.dataTransfer?.getData(CARD_DRAG_TYPE);
    if (!cardId) {
      setIsDragOver(false);
      return;
    }
    event.preventDefault();
    setIsDragOver(false);
    onDropCard(cardId, slot.id);
  }

  const dropzoneClasses = ['slot-card__dropzone'];
  if (isDragOver && slot.unlocked) {
    dropzoneClasses.push('slot-card__dropzone--active');
  }
  if (!slot.unlocked) {
    dropzoneClasses.push('slot-card__dropzone--locked');
  }
  if (occupant) {
    dropzoneClasses.push('slot-card__dropzone--occupied');
  }
  if (isHeroInSlot) {
    dropzoneClasses.push('slot-card__dropzone--hero');
  }

  return (
    <section className={slotClasses.join(' ')} data-collapsed={!showDetails}>
      <header className="slot-card__header">
        <div className="slot-card__title-block">
          <span className="slot-card__type">{slot.type}</span>
          <h3 className="slot-card__name">{slot.name}</h3>
        </div>
        <div className="slot-card__header-actions">
          <span className="slot-card__level">Lv {slot.level}</span>
          {!isDesktop ? (
            <button
              type="button"
              className="slot-card__toggle"
              onClick={() => setIsDetailsOpen((prev) => !prev)}
              aria-expanded={showDetails}
              aria-controls={detailsId}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
          ) : null}
        </div>
      </header>
      <p className="slot-card__description">{slot.description}</p>
      <div className="slot-card__status-row">
        <span className="slot-card__status-label">{occupancyLabel}</span>
        <div className={timerClasses.join(' ')} role="timer">
          {isTimePaused ? 'Time paused' : `Next cycle in ${formatDuration(timing.timeToNextCycleMs)}`}
        </div>
      </div>
      <button
        className={dropzoneClasses.join(' ')}
        type="button"
        aria-label={`Assign a card to ${slot.name}`}
        aria-disabled={!slot.unlocked}
        onClick={() => {
          if (slot.unlocked) {
            onClick(slot.id);
          }
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {occupant ? (
          <CardView
            card={occupant}
            variant="slot"
            draggable
            timing={timing}
            onDragStart={() => {
              setIsDragOver(false);
              onCardDragStart(occupant.id);
            }}
            onDragEnd={() => {
              setIsDragOver(false);
              onCardDragEnd();
            }}
          />
        ) : (
          <div className="slot-card__placeholder" aria-live="polite">
            <span className="slot-card__placeholder-title">
              {slot.unlocked ? 'Open for assignment' : 'Locked discovery'}
            </span>
            <span className="slot-card__placeholder-hint">Drop a compatible card here.</span>
          </div>
        )}
        {occupantTraits ? <span className="slot-card__occupant-traits">{occupantTraits}</span> : null}
      </button>
      <div
        id={detailsId}
        className={`slot-card__details${showDetails ? ' slot-card__details--open' : ''}`}
        aria-hidden={!showDetails}
      >
        <div className="slot-card__meta">
          <span className="slot-card__traits">{slot.traits.join(' · ')}</span>
          <span className="slot-card__accepted">{acceptanceLabel}</span>
        </div>
        <div className="slot-card__actions">
          <button
            className="slot-card__action"
            type="button"
            onClick={() => onActivate(slot.id)}
            disabled={!slot.unlocked}
          >
            {slot.type === 'work' ? 'Work' : slot.type === 'hearth' ? 'Rest' : 'Activate'}
          </button>
          <button
            className="slot-card__action"
            type="button"
            onClick={() => onUpgrade(slot.id)}
            disabled={!slot.unlocked}
          >
            Upgrade ({upgradeCost} ✦)
          </button>
          {occupant ? (
            <button className="slot-card__action" type="button" onClick={() => onRecall(occupant.id)}>
              Recall
            </button>
          ) : null}
        </div>
        <div className="slot-card__notes">
          {!occupant && !slot.unlocked ? (
            <span className="slot-card__note">Requires a discovery.</span>
          ) : null}
          {occupantExpiry ? (
            <span className="slot-card__note">
              {occupantExpiry.cycles} cycle{occupantExpiry.cycles === 1 ? '' : 's'} remain · ≈ {occupantExpiry.durationLabel}
            </span>
          ) : null}
          {slot.type === 'work' && !isHeroInSlot ? (
            <span className="slot-card__note">Send your persona to work shifts.</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const { state, moveCardToSlot, activateSlot, upgradeSlot, advanceTime, getUpgradeCost, recallCard } =
    useGame();
  const [isPaused, setIsPaused] = useState(false);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const cycleDurationMs = useMemo(() => Math.round(BASE_CYCLE_MS / speed), [speed]);
  const [timeToNextCycle, setTimeToNextCycle] = useState(cycleDurationMs);
  const prevIntervalRef = useRef(cycleDurationMs);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [isChronicleOpen, setIsChronicleOpen] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimeToNextCycle((prev) => {
        const next = prev - TIMER_RESOLUTION_MS;
        if (next <= 0) {
          advanceTime();
          return cycleDurationMs;
        }
        return next;
      });
    }, TIMER_RESOLUTION_MS);

    return () => window.clearInterval(intervalId);
  }, [advanceTime, cycleDurationMs, isPaused]);

  useEffect(() => {
    const previous = prevIntervalRef.current;
    if (previous !== cycleDurationMs) {
      setTimeToNextCycle((prev) => {
        if (previous <= 0) {
          return cycleDurationMs;
        }
        const scaled = Math.round((prev / previous) * cycleDurationMs);
        return Math.min(cycleDurationMs, Math.max(0, scaled));
      });
      prevIntervalRef.current = cycleDurationMs;
      return;
    }
    prevIntervalRef.current = cycleDurationMs;
  }, [cycleDurationMs]);

  const handCards = useMemo(
    () =>
      state.hand
        .map((cardId) => state.cards[cardId])
        .filter((card): card is CardInstance => Boolean(card) && card.location.area === 'hand'),
    [state.cards, state.hand]
  );

  const slots = useMemo(() => Object.values(state.slots).sort((a, b) => a.name.localeCompare(b.name)), [
    state.slots
  ]);

  const timingContext = useMemo<CardTimingContext>(
    () => ({ cycleDurationMs, timeToNextCycleMs: timeToNextCycle }),
    [cycleDurationMs, timeToNextCycle]
  );

  const headerTimerClasses = ['game-header__timer'];
  if (isPaused) {
    headerTimerClasses.push('game-header__timer--paused');
  }

  const nextCycleLabel = isPaused ? 'Time paused' : `Next cycle in ${formatDuration(timeToNextCycle)}`;

  const selectedCard = selectedCardId ? state.cards[selectedCardId] ?? null : null;

  function handleCardSelect(cardId: string) {
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  }

  function handleCardDragStart(cardId: string) {
    setDraggedCardId(cardId);
    setSelectedCardId(null);
  }

  function handleCardDragEnd() {
    setDraggedCardId(null);
  }

  function handleSlotClick(slotId: string) {
    if (!selectedCardId) {
      return;
    }
    moveCardToSlot(selectedCardId, slotId);
    setSelectedCardId(null);
  }

  function handleSlotDrop(cardId: string, slotId: string) {
    moveCardToSlot(cardId, slotId);
    setDraggedCardId(null);
    setSelectedCardId(null);
  }

  function handleHandDrop(event: DragEvent<HTMLDivElement>) {
    const cardId = event.dataTransfer?.getData(CARD_DRAG_TYPE);
    if (!cardId) {
      return;
    }
    event.preventDefault();
    const card = state.cards[cardId];
    if (card && card.location.area === 'slot') {
      recallCard(cardId);
    }
    setDraggedCardId(null);
  }

  function allowHandDrop(event: DragEvent<HTMLDivElement>) {
    if (!draggedCardId || !(event.dataTransfer?.types.includes(CARD_DRAG_TYPE) ?? false)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }

  function handleAdvanceNow() {
    advanceTime();
    setTimeToNextCycle(cycleDurationMs);
  }

  useEffect(() => {
    if (isDesktop) {
      setIsChronicleOpen(false);
    }
  }, [isDesktop]);

  const resourceTracks = [
    { label: 'Coin', value: state.resources.coin, icon: '🪙' },
    { label: 'Lore', value: state.resources.lore, icon: '📜' },
    { label: 'Glimmer', value: state.resources.glimmer, icon: '✨' }
  ];

  const chronicleTitleId = 'chronicle-title';

  const chronicleContent = (
    <>
      <h2 id={chronicleTitleId} className="game-log__title">
        Chronicle
      </h2>
      <ul className="game-log__entries">
        {state.log.map((entry, index) => (
          <li key={index} className="game-log__entry">
            {entry}
          </li>
        ))}
      </ul>
      {state.discoveries.length > 0 ? (
        <div className="game-log__discoveries">
          <h3>Discoveries</h3>
          <ul>
            {state.discoveries.map((discovery) => (
              <li key={discovery.id}>
                <strong>{discovery.name}</strong> · {discovery.description}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  return (
    <div className="game-shell">
      <header className="game-header">
        <div className="game-header__identity">
          <span className="game-header__badge">Veiled Ledger</span>
          <h1 className="game-header__title">Chamber of Echoes</h1>
          <p className="game-header__subtitle">
            Combine cards, nurture cultic slots, and push into the Hollow Ways.
          </p>
        </div>
        <div className="game-header__status">
          <div className="game-header__status-main">
            <div className="game-header__cycle" aria-label="Current cycle">
              <span className="game-header__cycle-label">Cycle</span>
              <span className="game-header__cycle-value">{state.cycle}</span>
            </div>
            <div className={headerTimerClasses.join(' ')} role="timer">
              {nextCycleLabel}
            </div>
          </div>
          <div className="game-header__resources" aria-label="Resource overview">
            <div className="game-header__resources-scroll">
              {resourceTracks.map((track) => (
                <ResourceTrack key={track.label} {...track} />
              ))}
            </div>
          </div>
        </div>
      </header>

      <nav className="game-controls" aria-label="Time controls">
        <button
          className="game-controls__toggle"
          type="button"
          onClick={() => setIsPaused((prev) => !prev)}
        >
          {isPaused ? 'Resume time' : 'Pause time'}
        </button>
        <div className="game-controls__speed" role="group" aria-label="Time speed">
          <span className="game-controls__speed-label">Speed</span>
          <div className="game-controls__speed-buttons">
            {SPEED_OPTIONS.map((option) => {
              const isActive = option === speed;
              return (
                <button
                  key={option}
                  className={`game-controls__speed-button${
                    isActive ? ' game-controls__speed-button--active' : ''
                  }`}
                  type="button"
                  onClick={() => {
                    if (!isActive) {
                      setSpeed(option);
                    }
                  }}
                  aria-pressed={isActive}
                >
                  {formatSpeedDisplay(option)}×
                </button>
              );
            })}
          </div>
        </div>
        <button className="game-controls__advance" type="button" onClick={handleAdvanceNow}>
          Advance now
        </button>
        <button
          className="game-controls__chronicle"
          type="button"
          onClick={() => setIsChronicleOpen(true)}
        >
          Chronicle
        </button>
      </nav>

      <main className="game-main">
        <section className="slots-grid" aria-label="Available slots">
          {slots.map((slot) => {
            const occupant = slot.occupantId ? state.cards[slot.occupantId] ?? null : null;
            const isHeroInSlot = occupant ? occupant.id === state.heroCardId : false;
            return (
              <SlotView
                key={slot.id}
                slot={slot}
                occupant={occupant}
                isHeroInSlot={isHeroInSlot}
                onClick={handleSlotClick}
                onActivate={activateSlot}
                onUpgrade={upgradeSlot}
                upgradeCost={getUpgradeCost(slot.id)}
                onRecall={recallCard}
                onDropCard={handleSlotDrop}
                onCardDragStart={handleCardDragStart}
                onCardDragEnd={handleCardDragEnd}
                timing={timingContext}
                isTimePaused={isPaused}
              />
            );
          })}
        </section>
        {isDesktop ? (
          <aside className="game-log" aria-live="polite">
            {chronicleContent}
          </aside>
        ) : null}
      </main>

      <footer className="game-hand" aria-label="Cards in hand">
        <div className="game-hand__meta">
          <h2>Hand</h2>
          {selectedCard ? <span>Selected: {selectedCard.name}</span> : <span>Select a card to place.</span>}
        </div>
        <div
          className={`game-hand__cards${draggedCardId ? ' game-hand__cards--droppable' : ''}`}
          onDragOver={allowHandDrop}
          onDrop={handleHandDrop}
        >
          {handCards.map((card) => (
            <CardView
              key={card.id}
              card={card}
              selected={selectedCardId === card.id}
              onSelect={handleCardSelect}
              draggable
              onDragStart={handleCardDragStart}
              onDragEnd={handleCardDragEnd}
              timing={timingContext}
            />
          ))}
        </div>
      </footer>

      {!isDesktop && isChronicleOpen ? (
        <div className="chronicle-drawer" role="dialog" aria-modal="true" aria-labelledby={chronicleTitleId}>
          <button
            type="button"
            className="chronicle-drawer__backdrop"
            aria-label="Close chronicle"
            onClick={() => setIsChronicleOpen(false)}
          />
          <div className="chronicle-drawer__panel">
            <button
              type="button"
              className="chronicle-drawer__close"
              onClick={() => setIsChronicleOpen(false)}
            >
              Close
            </button>
            <div className="chronicle-drawer__content" aria-live="polite">
              {chronicleContent}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
