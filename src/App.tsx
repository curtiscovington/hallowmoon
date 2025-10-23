import {
  CSSProperties,
  DragEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState
} from 'react';
import { useGame } from './state/GameContext';
import { CardInstance, Resources, Slot } from './state/types';
import { SLOT_TYPE_INFO } from './constants/slotTypeInfo';
import { SlotRevealOverlay } from './components/SlotRevealOverlay';
import { CardRevealOverlay } from './components/CardRevealOverlay';
import { SlotMap } from './components/SlotMap';
import { SlotDetailsOverlay } from './components/SlotDetailsOverlay';
import { formatDuration } from './utils/time';
import {
  MAP_DEFINITIONS,
  MAP_SEQUENCE,
  type MapId,
  findAnchorForSlot
} from './constants/mapDefinitions';
import { getSlotActionMetadata } from './utils/slotActions';
import {
  buildLocationExplorationAvailability,
  buildSlotSummaries,
  type SlotSummary
} from './state/selectors/slots';

const CARD_DRAG_TYPE = 'application/x-hallowmoon-card';

const BASE_CYCLE_MS = 60000;
const TIMER_RESOLUTION_MS = 200;
const SPEED_OPTIONS = [1, 2, 3] as const;
const MANOR_ROOT_SLOT_KEY = 'the-manor';

type SpeedOption = (typeof SPEED_OPTIONS)[number];

interface CardTimingContext {
  cycleDurationMs: number;
  timeToNextCycleMs: number;
  timeScale: number;
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
  const permanenceLabel = card.permanent ? 'permanent' : 'fleeting';
  const metaLabel = expiryInfo ? `${permanenceLabel} · ≈ ${expiryInfo.durationLabel}` : permanenceLabel;
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
          <span>{metaLabel}</span>
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
  assistant,
  attachments,
  isHeroInSlot,
  hasSelectedCard,
  selectedCardName,
  onClick,
  onActivate,
  onUpgrade,
  upgradeCost,
  onRecall,
  onDropCard,
  onCardDragStart,
  onCardDragEnd,
  timing,
  resources,
  pausedAt,
  isTimePaused,
  canExploreLocation,
  availableMaps,
  currentMapId,
  onTravelToMap,
  titleId,
  descriptionId,
  displayContext = 'panel'
}: {
  slot: Slot;
  occupant: CardInstance | null;
  assistant: CardInstance | null;
  attachments: CardInstance[];
  isHeroInSlot: boolean;
  hasSelectedCard: boolean;
  selectedCardName: string | null;
  onClick: (slotId: string) => void;
  onActivate: (slotId: string) => void;
  onUpgrade: (slotId: string) => void;
  upgradeCost: number;
  onRecall: (cardId: string) => void;
  onDropCard: (cardId: string, slotId: string) => void;
  onCardDragStart: (cardId: string) => void;
  onCardDragEnd: () => void;
  timing: CardTimingContext;
  resources: Resources;
  pausedAt: number | null;
  isTimePaused: boolean;
  canExploreLocation: boolean;
  availableMaps: MapId[];
  currentMapId: MapId;
  onTravelToMap: (mapId: MapId) => void;
  titleId?: string;
  descriptionId?: string;
  displayContext?: 'panel' | 'modal';
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const showDetails = isDesktop || isDetailsOpen;
  const detailsId = `slot-details-${slot.id}`;
  const slotTypeInfo = SLOT_TYPE_INFO[slot.type];
  const occupancyLabel = occupant
    ? assistant
      ? `${occupant.name} · with ${assistant.name}`
      : occupant.name
    : slot.unlocked
    ? 'Open for assignment'
    : 'Locked discovery';
  const acceptanceLabel = describeSlotAcceptance(slot.accepted);
  const occupantTraitSources = [
    ...(occupant ? occupant.traits : []),
    ...(assistant ? assistant.traits : []),
    ...attachments.flatMap((card) => card.traits)
  ];
  const occupantTraits =
    occupantTraitSources.length > 0 ? Array.from(new Set(occupantTraitSources)).join(' · ') : null;
  const now = Date.now();
  const pausedElapsedMs = pausedAt !== null ? Math.max(0, now - pausedAt) : 0;
  const lockRemainingMs = slot.lockedUntil
    ? Math.max(0, slot.lockedUntil - now + pausedElapsedMs)
    : 0;
  const lockTotalMs = slot.lockDurationMs ?? null;
  const displayLockRemainingMs = Math.max(0, Math.round(lockRemainingMs * timing.timeScale));
  const isSlotLocked = Boolean(slot.lockedUntil && lockRemainingMs > 0);
  const isSlotInteractive = slot.unlocked && !isSlotLocked;
  const upgradeDisabled =
    !isSlotInteractive || slot.state === 'damaged' || slot.upgradeCost === 0;
  const showLockTimer = isSlotLocked && lockRemainingMs > 0;
  const lockRemainingFraction =
    showLockTimer && lockTotalMs && lockTotalMs > 0
      ? Math.min(1, Math.max(0, lockRemainingMs / lockTotalMs))
      : null;
  const dropzoneTimerAngle =
    lockRemainingFraction !== null ? lockRemainingFraction * 360 : 360;
  const dropzoneTimerProgress =
    lockRemainingFraction !== null ? 1 - lockRemainingFraction : null;
  const dropzoneTimerStyle = showLockTimer
    ? ({
        '--slot-dropzone-timer-angle': `${dropzoneTimerAngle}deg`,
        ...(dropzoneTimerProgress !== null
          ? { '--slot-dropzone-timer-progress': dropzoneTimerProgress.toFixed(3) }
          : {})
      } as CSSProperties)
    : undefined;
  const cardLockTimerStyle = showLockTimer
    ? ({
        '--slot-card-timer-angle': `${dropzoneTimerAngle}deg`,
        ...(dropzoneTimerProgress !== null
          ? { '--slot-card-timer-progress': dropzoneTimerProgress.toFixed(3) }
          : {})
      } as CSSProperties)
    : undefined;

  useEffect(() => {
    if (!isSlotInteractive) {
      setIsDragOver(false);
    }
  }, [isSlotInteractive]);
  const slotClasses = ['slot-card'];
  if (displayContext === 'modal') {
    slotClasses.push('slot-card--modal');
  }
  if (!slot.unlocked) {
    slotClasses.push('slot-card--locked');
  }
  if (isSlotLocked) {
    slotClasses.push('slot-card--busy');
  }
  if (isDragOver && isSlotInteractive) {
    slotClasses.push('slot-card--active');
  }
  if (isDragOver && isSlotInteractive) {
    slotClasses.push('slot-card--drop-target');
  }
  if (!showDetails) {
    slotClasses.push('slot-card--collapsed');
  }

  const actionMetadata = useMemo(
    () =>
      getSlotActionMetadata({
        slot,
        occupant,
        assistant,
        attachments,
        resources,
        canExploreLocation,
        isSlotInteractive
      }),
    [
      slot,
      occupant,
      assistant,
      attachments,
      resources,
      canExploreLocation,
      isSlotInteractive
    ]
  );

  const { actionLabel, canActivate: canActivateSlot, availabilityNote: actionAvailabilityNote } =
    actionMetadata;

  const baseActionLabel = useMemo(() => {
    switch (slot.type) {
      case 'study':
        return 'Study';
      case 'work':
        return 'Work';
      case 'hearth':
        return 'Rest';
      case 'location':
        return slot.state === 'damaged' ? 'Clear' : 'Explore';
      case 'bedroom':
        return 'Slumber';
      default:
        return 'Activate';
    }
  }, [slot]);

  const timerClasses = ['slot-card__timer'];
  if (isSlotLocked) {
    timerClasses.push('slot-card__timer--busy');
  }
  if (isTimePaused) {
    timerClasses.push('slot-card__timer--paused');
  }
  const lockCountdownMessage =
    displayLockRemainingMs > 0 ? `≈ ${formatDuration(displayLockRemainingMs)} remain` : 'In progress';
  const lockStatusMessage = isTimePaused
    ? displayLockRemainingMs > 0
      ? `${lockCountdownMessage} · paused`
      : 'Paused'
    : lockCountdownMessage;
  const timerMessage = isSlotLocked
    ? lockStatusMessage
    : isTimePaused
    ? 'Time paused'
    : actionLabel ?? baseActionLabel;

  const occupantExpiry = occupant ? describeCardExpiry(occupant, timing) : null;
  const assistantExpiry = assistant ? describeCardExpiry(assistant, timing) : null;
  const repairNote =
    slot.state === 'damaged' && slot.repair
      ? slot.repairStarted
        ? `Restoration underway · ≈ ${formatDuration(
            slot.repair.remaining * timing.cycleDurationMs
          )} remain.`
        : 'In disrepair — activate with a persona to begin restoration.'
      : null;
  const explorationNote =
    slot.pendingAction?.type === 'explore-location'
      ? `Exploration underway within ${slot.name}.`
      : null;
  const shouldShowPrimaryAction = Boolean(actionLabel && canActivateSlot);

  const travelTargetMapId = useMemo(() => {
    if (!slot.location) {
      return null;
    }
    const candidate =
      MAP_SEQUENCE.find((mapId) => {
        if (mapId === 'overworld') {
          return false;
        }
        if (mapId === currentMapId) {
          return false;
        }
        const definition = MAP_DEFINITIONS[mapId];
        return definition.focusLocations.includes(slot.location);
      }) ?? null;
    if (!candidate) {
      return null;
    }
    return availableMaps.includes(candidate) ? candidate : null;
  }, [availableMaps, currentMapId, slot.location]);
  const travelTargetDefinition = travelTargetMapId
    ? MAP_DEFINITIONS[travelTargetMapId]
    : null;
  const travelButtonLabel = travelTargetDefinition
    ? `Visit ${travelTargetDefinition.name}`
    : null;
  const travelButtonVariant = shouldShowPrimaryAction ? 'secondary' : 'primary';

  function acceptsCard(event: DragEvent<HTMLElement>) {
    return event.dataTransfer?.types.includes(CARD_DRAG_TYPE) ?? false;
  }

  function handleDragEnter(event: DragEvent<HTMLElement>) {
    if (!isSlotInteractive || !acceptsCard(event)) {
      return;
    }
    event.preventDefault();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }

  function handleDragOver(event: DragEvent<HTMLElement>) {
    if (!isSlotInteractive || !acceptsCard(event)) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }

  function handleDragLeave(event: DragEvent<HTMLElement>) {
    if (!isSlotInteractive) {
      return;
    }
    const nextTarget = event.relatedTarget as Node | null;
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return;
    }

    const { clientX, clientY } = event;
    const hoveredElement =
      typeof document !== 'undefined' && typeof document.elementFromPoint === 'function'
        ? document.elementFromPoint(clientX, clientY)
        : null;
    if (hoveredElement && event.currentTarget.contains(hoveredElement)) {
      return;
    }
    const targetElement = event.currentTarget as HTMLElement;
    const rect = targetElement.getBoundingClientRect();
    if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
      return;
    }

    setIsDragOver(false);
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    if (!isSlotInteractive) {
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
  if (isDragOver && isSlotInteractive) {
    dropzoneClasses.push('slot-card__dropzone--active');
  }
  if (!slot.unlocked) {
    dropzoneClasses.push('slot-card__dropzone--locked');
  }
  if (isSlotLocked) {
    dropzoneClasses.push('slot-card__dropzone--busy');
  }
  if (occupant) {
    dropzoneClasses.push('slot-card__dropzone--occupied');
  } else {
    dropzoneClasses.push('slot-card__dropzone--empty');
  }
  if (isHeroInSlot) {
    dropzoneClasses.push('slot-card__dropzone--hero');
  }

  const stackSize = (occupant ? 1 : 0) + attachments.length;
  const stackPreview = attachments.slice(-3);
  const stackDescription =
    stackSize > 0 && occupant
      ? `${stackSize} card${stackSize === 1 ? '' : 's'}: ${[occupant.name, ...attachments.map((card) => card.name)].join(', ')}`
      : null;

  const canDragOccupant = slot.unlocked && !isSlotLocked;

  const dropzoneLabel = !isSlotInteractive
    ? `${slot.name} is not accepting cards right now`
    : hasSelectedCard
    ? `Assign ${selectedCardName ?? 'selected card'} to ${slot.name}`
    : occupant
    ? canActivateSlot
      ? `${actionLabel ?? 'Activate'} ${slot.name}`
      : `${slot.name} cannot be activated right now`
    : `Assign a card to ${slot.name}`;

  function handlePrimaryClick() {
    if (!isSlotInteractive) {
      return;
    }
    if (hasSelectedCard) {
      onClick(slot.id);
      return;
    }
    if (occupant && canActivateSlot) {
      onActivate(slot.id);
    }
  }

  function handlePrimaryKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    event.preventDefault();
    handlePrimaryClick();
  }

  const detailActions: ReactNode[] = [];
  if (assistant) {
    detailActions.push(
      <button
        key="assistant"
        className="slot-card__action"
        type="button"
        onClick={() => onRecall(assistant.id)}
        disabled={isSlotLocked}
      >
        {`Recall ${assistant.name}`}
      </button>,
    );
  }

  if (occupant) {
    detailActions.push(
      <button
        key="occupant"
        className="slot-card__action"
        type="button"
        onClick={() => onRecall(occupant.id)}
        disabled={isSlotLocked}
      >
        {`Recall ${occupant.name}`}
      </button>,
    );
  }

  return (
    <section
      className={slotClasses.join(' ')}
      data-collapsed={!showDetails}
      data-slot-type={slot.type}
      data-slot-id={slot.id}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className="slot-card__lock-overlay"
        data-active={showLockTimer ? 'true' : 'false'}
        data-paused={isTimePaused ? 'true' : 'false'}
        style={cardLockTimerStyle}
        aria-hidden="true"
      >
        <span className="slot-card__lock-overlay-message">{timerMessage}</span>
      </div>
      <header className="slot-card__header">
        <div className="slot-card__title-block">
          <span className="slot-card__type" aria-label={`${slotTypeInfo.label} slot`}>
            <span className="slot-card__type-icon" aria-hidden="true">
              {slotTypeInfo.icon}
            </span>
            <span className="slot-card__type-label">{slotTypeInfo.label}</span>
          </span>
          <h3 id={titleId} className="slot-card__name">
            {slot.name}
          </h3>
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
      <p id={descriptionId} className="slot-card__description">
        {slot.description}
      </p>
      <div className="slot-card__status-row">
        <span className="slot-card__status-label">{occupancyLabel}</span>
        <div className={timerClasses.join(' ')} role="timer">
          {timerMessage}
        </div>
      </div>
      <button
        className={dropzoneClasses.join(' ')}
        type="button"
        aria-label={dropzoneLabel}
        aria-disabled={!isSlotInteractive}
        data-has-occupant={Boolean(occupant)}
        style={dropzoneTimerStyle}
        onClick={handlePrimaryClick}
        onKeyDown={handlePrimaryKey}
      >
        <span
          className="slot-card__dropzone-timer"
          data-active={showLockTimer ? 'true' : 'false'}
          data-paused={isTimePaused ? 'true' : 'false'}
          aria-hidden="true"
        />
        {stackDescription ? <span className="sr-only">{stackDescription}</span> : null}
        {occupant ? (
          <div className={`slot-card__stack${attachments.length > 0 ? ' slot-card__stack--layered' : ''}`}>
            {attachments.length > 0 ? (
              <div className="slot-card__stack-layers" aria-hidden="true">
                {stackPreview.map((card, index) => (
                  <span
                    key={card.id}
                    className="slot-card__stack-layer"
                    style={{ '--stack-index': stackPreview.length - index } as CSSProperties}
                  />
                ))}
              </div>
            ) : null}
            <CardView
              card={occupant}
              variant="slot"
              draggable={canDragOccupant}
              timing={timing}
              onDragStart={
                canDragOccupant
                  ? () => {
                      setIsDragOver(false);
                      onCardDragStart(occupant.id);
                    }
                  : undefined
              }
              onDragEnd={
                canDragOccupant
                  ? () => {
                      setIsDragOver(false);
                      onCardDragEnd();
                    }
                  : undefined
              }
            />
            {shouldShowPrimaryAction || stackSize > 1 ? (
              <div className="slot-card__stack-label" aria-hidden="true">
                {shouldShowPrimaryAction ? (
                  <span className="slot-card__stack-label-action">{actionLabel}</span>
                ) : null}
                {stackSize > 1 ? (
                  <span className="slot-card__stack-label-count">{stackSize} cards</span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="slot-card__placeholder" aria-live="polite">
            <span className="slot-card__placeholder-title">
              {slot.unlocked ? (isSlotLocked ? 'In progress' : 'Open for assignment') : 'Locked discovery'}
            </span>
            <span className="slot-card__placeholder-hint">Drop a compatible card here.</span>
          </div>
        )}
      </button>
      {occupantTraits ? <span className="slot-card__occupant-traits">{occupantTraits}</span> : null}
      {attachments.length > 0 ? (
        <div className="slot-card__stack-summary" aria-live="polite">
          <span className="slot-card__stack-summary-title">Attached cards</span>
          <ul className="slot-card__attachments">
            {attachments.map((card, index) => (
              <li
                key={card.id}
                className="slot-card__attachment"
                style={{ '--stack-index': attachments.length - index } as CSSProperties}
              >
                <span className="slot-card__attachment-name">{card.name}</span>
                <span className="slot-card__attachment-meta">{card.type}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="slot-card__cta" role="group" aria-label={`${slot.name} actions`}>
        {travelTargetMapId && travelButtonLabel ? (
          <button
            className={`slot-card__cta-button slot-card__cta-button--${travelButtonVariant}`}
            type="button"
            onClick={() => onTravelToMap(travelTargetMapId)}
          >
            {travelButtonLabel}
          </button>
        ) : null}
        {shouldShowPrimaryAction && actionLabel ? (
          <button
            className="slot-card__cta-button slot-card__cta-button--primary"
            type="button"
            onClick={() => onActivate(slot.id)}
            disabled={!isSlotInteractive}
          >
            {actionLabel}
          </button>
        ) : null}
        <button
          className="slot-card__cta-button slot-card__cta-button--secondary"
          type="button"
          onClick={() => onUpgrade(slot.id)}
          disabled={upgradeDisabled}
        >
          Upgrade ({upgradeCost} ✦)
        </button>
      </div>
      <div
        id={detailsId}
        className={`slot-card__details${showDetails ? ' slot-card__details--open' : ''}`}
        aria-hidden={!showDetails}
      >
        <div className="slot-card__meta">
          <span className="slot-card__traits">{slot.traits.join(' · ')}</span>
          <span className="slot-card__accepted">{acceptanceLabel}</span>
        </div>
        {detailActions.length > 0 ? (
          <div className="slot-card__actions">{detailActions}</div>
        ) : null}
        <div className="slot-card__notes">
          {!occupant && !slot.unlocked ? (
            <span className="slot-card__note">Requires a discovery.</span>
          ) : null}
          {isSlotLocked && displayLockRemainingMs > 0 ? (
            <span className="slot-card__note">{lockStatusMessage}</span>
          ) : null}
          {occupantExpiry ? (
            <span className="slot-card__note">
              ≈ {occupantExpiry.durationLabel} remain for {occupant?.name ?? 'the occupant'}
            </span>
          ) : null}
          {assistantExpiry ? (
            <span className="slot-card__note">
              {(assistant?.name ?? 'Assistant')} ≈ {assistantExpiry.durationLabel} remain
            </span>
          ) : null}
          {repairNote ? <span className="slot-card__note">{repairNote}</span> : null}
          {actionAvailabilityNote ? (
            <span className="slot-card__note">{actionAvailabilityNote}</span>
          ) : null}
          {assistant && !assistantExpiry ? (
            <span className="slot-card__note">Assistant: {assistant.name}</span>
          ) : null}
          {explorationNote ? <span className="slot-card__note">{explorationNote}</span> : null}
          {slot.type === 'work' && !isHeroInSlot ? (
            <span className="slot-card__note">Send your persona to work shifts.</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const {
    state,
    moveCardToSlot,
    activateSlot,
    upgradeSlot,
    advanceTime,
    getUpgradeCost,
    recallCard,
    setTimeScale,
    acknowledgeCardReveal
  } = useGame();
  const isDesktop = useMediaQuery('(min-width: 900px)');
  const [isPaused, setIsPausedState] = useState(false);
  const [speed, setSpeed] = useState<SpeedOption>(1);
  const cycleDurationMs = BASE_CYCLE_MS;
  const [timeToNextCycle, setTimeToNextCycle] = useState(cycleDurationMs);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [activeMapId, setActiveMapId] = useState<MapId>('overworld');
  const [focusedSlotId, setFocusedSlotId] = useState<string | null>(null);
  const [activeSlotModalId, setActiveSlotModalId] = useState<string | null>(null);
  const [isChronicleOpen, setIsChronicleOpen] = useState(false);
  const [isHandOpen, setIsHandOpen] = useState(isDesktop);
  const handPanelId = useId();
  const slotModalTitleId = useId();
  const slotModalDescriptionId = useId();
  const [slotRevealQueue, setSlotRevealQueue] = useState<string[]>([]);
  const previousSlotIdsRef = useRef<Set<string>>(new Set(Object.keys(state.slots)));
  const previousAvailableMapsRef = useRef<MapId[]>([]);
  const manualPauseRef = useRef(false);
  const autoPausedByRevealRef = useRef(false);

  const setPausedManual = (value: boolean) => {
    manualPauseRef.current = value;
    setIsPausedState(value);
  };

  const setPausedAuto = (value: boolean) => {
    setIsPausedState(value);
  };

  useEffect(() => {
    if (isPaused) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setTimeToNextCycle((prev) => {
        const decrement = TIMER_RESOLUTION_MS * speed;
        const next = prev - decrement;
        if (next <= 0) {
          advanceTime();
          return cycleDurationMs;
        }
        return Math.max(0, Math.min(cycleDurationMs, next));
      });
    }, TIMER_RESOLUTION_MS);

    return () => window.clearInterval(intervalId);
  }, [advanceTime, cycleDurationMs, isPaused, speed]);

  useEffect(() => {
    setTimeScale(isPaused ? 0 : speed);
  }, [isPaused, setTimeScale, speed]);

  useEffect(() => {
    const previousIds = previousSlotIdsRef.current;
    const currentIds = Object.keys(state.slots);
    const newIds = currentIds.filter((id) => !previousIds.has(id));
    previousSlotIdsRef.current = new Set(currentIds);

    if (newIds.length > 0) {
      setSlotRevealQueue((prev) => [...prev, ...newIds]);
    }
  }, [state.slots]);

  useEffect(() => {
    const pendingCardReveals = state.pendingReveals.length;
    const hasReveals = slotRevealQueue.length > 0 || pendingCardReveals > 0;

    if (hasReveals) {
      if (!manualPauseRef.current) {
        autoPausedByRevealRef.current = true;
        if (!isPaused) {
          setPausedAuto(true);
        }
      }
    } else {
      autoPausedByRevealRef.current = false;
      if (!manualPauseRef.current && isPaused) {
        setPausedAuto(false);
      }
    }
  }, [isPaused, slotRevealQueue.length, state.pendingReveals.length]);

  const activeRevealSlotId = slotRevealQueue[0] ?? null;
  const activeRevealSlot = activeRevealSlotId ? state.slots[activeRevealSlotId] ?? null : null;

  useEffect(() => {
    if (activeRevealSlotId && !activeRevealSlot) {
      setSlotRevealQueue((prev) => prev.filter((id) => id !== activeRevealSlotId));
    }
  }, [activeRevealSlot, activeRevealSlotId]);

  const handleRevealClose = () => {
    setSlotRevealQueue((prev) => prev.slice(1));
  };

  const cardRevealQueue = state.pendingReveals;
  const activeCardRevealId = activeRevealSlot ? null : cardRevealQueue[0] ?? null;
  const activeCardReveal = activeCardRevealId ? state.cards[activeCardRevealId] ?? null : null;

  useEffect(() => {
    if (activeCardRevealId && !activeCardReveal) {
      acknowledgeCardReveal(activeCardRevealId);
    }
  }, [acknowledgeCardReveal, activeCardReveal, activeCardRevealId]);

  const handleCardRevealClose = () => {
    if (activeCardRevealId) {
      acknowledgeCardReveal(activeCardRevealId);
    }
  };

  const handCards = useMemo(
    () =>
      state.hand
        .map((cardId) => state.cards[cardId])
        .filter((card): card is CardInstance => Boolean(card) && card.location.area === 'hand'),
    [state.cards, state.hand]
  );

  const slots = useMemo(() => Object.values(state.slots), [state.slots]);

  const locationExplorationAvailability = useMemo(
    () => buildLocationExplorationAvailability(slots),
    [slots]
  );

  const slotSummaries = useMemo<Record<string, SlotSummary>>(
    () => {
      void timeToNextCycle;
      const summaryTimestamp = Date.now();
      return buildSlotSummaries({
        slots,
        cards: state.cards,
        heroCardId: state.heroCardId,
        resources: state.resources,
        pausedAt: state.pausedAt,
        locationAvailability: locationExplorationAvailability,
        now: summaryTimestamp
      });
    },
    [
      slots,
      state.cards,
      state.heroCardId,
      state.resources,
      state.pausedAt,
      locationExplorationAvailability,
      timeToNextCycle
    ]
  );

  const slotsByMap = useMemo(() => {
    const mapping: Record<MapId, Slot[]> = {
      overworld: [],
      manor: [],
      town: [],
      forest: []
    };

    for (const slot of slots) {
      for (const mapId of MAP_SEQUENCE) {
        const definition = MAP_DEFINITIONS[mapId];
        if (findAnchorForSlot(definition, slot.key)) {
          mapping[mapId].push(slot);
        }
      }
    }

    for (const mapId of MAP_SEQUENCE) {
      mapping[mapId].sort((a, b) => a.name.localeCompare(b.name));
    }

    return mapping;
  }, [slots]);

  const availableMaps = useMemo(() => {
    const mapsWithSites = MAP_SEQUENCE.filter((id) => {
      if (slotsByMap[id].length > 0) {
        return true;
      }
      const definition = MAP_DEFINITIONS[id];
      return slots.some((slot) => {
        if (!slot.location || !definition.focusLocations.includes(slot.location)) {
          return false;
        }
        if (id === 'manor') {
          return slot.key !== MANOR_ROOT_SLOT_KEY;
        }
        return true;
      });
    });
    if (!mapsWithSites.includes('overworld')) {
      mapsWithSites.unshift('overworld');
    }
    return Array.from(new Set<MapId>(mapsWithSites));
  }, [slotsByMap, slots]);

  const activeMapSlots = slotsByMap[activeMapId] ?? [];

  useEffect(() => {
    if (availableMaps.length === 0) {
      return;
    }

    const previousMaps = previousAvailableMapsRef.current;
    const newlyAdded = availableMaps.find((id) => !previousMaps.includes(id));

    if (!availableMaps.includes(activeMapId)) {
      setActiveMapId(availableMaps[0]);
    } else if (newlyAdded && newlyAdded !== 'overworld') {
      setActiveMapId(newlyAdded);
    }

    previousAvailableMapsRef.current = [...availableMaps];
  }, [activeMapId, availableMaps]);

  useEffect(() => {
    const currentSlots = slotsByMap[activeMapId] ?? [];
    if (currentSlots.length === 0) {
      setFocusedSlotId(null);
      return;
    }

    setFocusedSlotId((prev) => {
      if (prev && currentSlots.some((slot) => slot.id === prev)) {
        return prev;
      }
      return currentSlots[0].id;
    });
  }, [activeMapId, slotsByMap]);

  const timingContext = useMemo<CardTimingContext>(
    () => ({ cycleDurationMs, timeToNextCycleMs: timeToNextCycle, timeScale: state.timeScale }),
    [cycleDurationMs, state.timeScale, timeToNextCycle]
  );

  const selectedCard = selectedCardId ? state.cards[selectedCardId] ?? null : null;
  const draggedCard = draggedCardId ? state.cards[draggedCardId] ?? null : null;
  const slotForModal = activeSlotModalId ? state.slots[activeSlotModalId] ?? null : null;

  useEffect(() => {
    if (activeSlotModalId && !slotForModal) {
      setActiveSlotModalId(null);
    }
  }, [activeSlotModalId, slotForModal]);

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

  function handleMapSlotFocus(slotId: string) {
    setFocusedSlotId(slotId);
  }

  function handleOpenSlotDetails(slotId: string) {
    setActiveSlotModalId(slotId);
  }

  function handleCloseSlotModal() {
    setActiveSlotModalId(null);
  }

  function handleMapChange(mapId: MapId) {
    setActiveMapId(mapId);
    setActiveSlotModalId(null);
  }

  function handleSlotClick(slotId: string) {
    if (!selectedCardId) {
      setFocusedSlotId(slotId);
      return;
    }
    moveCardToSlot(selectedCardId, slotId);
    setSelectedCardId(null);
    setFocusedSlotId(slotId);
    if (!isDesktop) {
      setIsHandOpen(false);
    }
  }

  function handleSlotDrop(cardId: string, slotId: string) {
    moveCardToSlot(cardId, slotId);
    setDraggedCardId(null);
    setSelectedCardId(null);
    setFocusedSlotId(slotId);
    if (!isDesktop) {
      setIsHandOpen(false);
    }
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

  useEffect(() => {
    if (isDesktop) {
      setIsChronicleOpen(false);
    }
    setIsHandOpen(isDesktop);
  }, [isDesktop]);

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

  function renderSlotCard(
    slot: Slot,
    options?: { titleId?: string; descriptionId?: string; displayContext?: 'panel' | 'modal' }
  ) {
    const summary = slotSummaries[slot.id];
    const occupant = summary?.occupant ?? null;
    const assistant = summary?.assistant ?? null;
    const attachments = summary?.attachments ?? [];
    const isHeroInSlot = summary?.isHeroInSlot ?? false;
    const canExplore = summary?.canExploreLocation ?? true;

    return (
      <SlotView
        key={slot.id}
        slot={slot}
        occupant={occupant}
        assistant={assistant}
        attachments={attachments}
        isHeroInSlot={isHeroInSlot}
        hasSelectedCard={Boolean(selectedCard)}
        selectedCardName={selectedCard?.name ?? null}
        onClick={handleSlotClick}
        onActivate={activateSlot}
        onUpgrade={upgradeSlot}
        upgradeCost={getUpgradeCost(slot.id)}
        onRecall={recallCard}
        onDropCard={handleSlotDrop}
        onCardDragStart={handleCardDragStart}
        onCardDragEnd={handleCardDragEnd}
        timing={timingContext}
        resources={state.resources}
        pausedAt={state.pausedAt}
        isTimePaused={isPaused}
        canExploreLocation={canExplore}
        availableMaps={availableMaps}
        currentMapId={activeMapId}
        onTravelToMap={handleMapChange}
        titleId={options?.titleId}
        descriptionId={options?.descriptionId}
        displayContext={options?.displayContext ?? 'panel'}
      />
    );
  }

  return (
    <div className="game-shell">
      <nav className="game-controls" aria-label="Time controls">
        <button
          className="game-controls__button game-controls__button--pause"
          type="button"
          aria-label={isPaused ? 'Resume time' : 'Pause time'}
          aria-pressed={isPaused}
          onClick={() => setPausedManual(!isPaused)}
        >
          <span className="sr-only">{isPaused ? 'Resume time' : 'Pause time'}</span>
          <span aria-hidden="true" className="game-controls__icon">
            {isPaused ? '▶' : '⏸'}
          </span>
        </button>
        {SPEED_OPTIONS.map((option) => {
          const isActive = option === speed;
          return (
            <button
              key={option}
              className={`game-controls__button game-controls__button--speed${
                isActive ? ' game-controls__button--active' : ''
              }`}
              type="button"
              aria-label={`${formatSpeedDisplay(option)} times speed`}
              aria-pressed={isActive}
              onClick={() => {
                if (!isActive) {
                  setSpeed(option);
                }
              }}
            >
              {formatSpeedDisplay(option)}
            </button>
          );
        })}
        <button
          className={`game-controls__button game-controls__button--chronicle${
            isChronicleOpen ? ' game-controls__button--active' : ''
          }`}
          type="button"
          aria-label={isChronicleOpen ? 'Close chronicle' : 'Open chronicle'}
          aria-pressed={isChronicleOpen}
          onClick={() => setIsChronicleOpen((prev) => !prev)}
        >
          <span className="sr-only">{isChronicleOpen ? 'Close chronicle' : 'Open chronicle'}</span>
          <span aria-hidden="true" className="game-controls__icon">
            📜
          </span>
        </button>
      </nav>

      <main className="game-main">
        <section className="game-map-panel" aria-label="Territory overview">
          <SlotMap
            mapId={activeMapId}
            availableMaps={availableMaps}
            onMapChange={handleMapChange}
            slots={activeMapSlots}
            slotSummaries={slotSummaries}
            selectedSlotId={focusedSlotId}
            onFocusSlot={handleMapSlotFocus}
            onOpenSlotDetails={handleOpenSlotDetails}
            onActivateSlot={activateSlot}
            onDropCard={handleSlotDrop}
            draggedCard={draggedCard}
          />
        </section>
        {isDesktop ? (
          <aside className="game-log" aria-live="polite">
            {chronicleContent}
          </aside>
        ) : null}
      </main>

      <footer className={`game-hand${isHandOpen ? ' game-hand--open' : ''}`} aria-label="Cards in hand">
        <div className="game-hand__surface">
          <button
            type="button"
            className="game-hand__toggle"
            aria-expanded={isHandOpen}
            aria-controls={handPanelId}
            onClick={() => setIsHandOpen((prev) => !prev)}
          >
            <span className="game-hand__toggle-title">Hand</span>
            <span className="game-hand__toggle-meta">
              {handCards.length} card{handCards.length === 1 ? '' : 's'}
            </span>
            <span className="game-hand__toggle-icon" aria-hidden="true">
              {isHandOpen ? '▾' : '▴'}
            </span>
          </button>
          <div
            id={handPanelId}
            className="game-hand__panel"
            aria-hidden={!isHandOpen}
          >
            <div className="game-hand__meta">
              <div className="game-hand__meta-text">
                <h2>
                  Hand
                  <span className="game-hand__meta-count">
                    · {handCards.length} card{handCards.length === 1 ? '' : 's'}
                  </span>
                </h2>
                <p>{selectedCard ? `Selected: ${selectedCard.name}` : 'Select a card to place.'}</p>
              </div>
              <button
                type="button"
                className="game-hand__collapse"
                onClick={() => setIsHandOpen(false)}
              >
                <span className="sr-only">Close hand</span>
                <span aria-hidden="true">⌄</span>
              </button>
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
          </div>
        </div>
      </footer>

      {activeRevealSlot ? (
        <SlotRevealOverlay slot={activeRevealSlot} onClose={handleRevealClose} />
      ) : null}

      {activeCardReveal ? (
        <CardRevealOverlay card={activeCardReveal} onClose={handleCardRevealClose} />
      ) : null}

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
      {slotForModal ? (
        <SlotDetailsOverlay
          labelledBy={slotModalTitleId}
          describedBy={slotModalDescriptionId}
          onClose={handleCloseSlotModal}
        >
          {renderSlotCard(slotForModal, {
            titleId: slotModalTitleId,
            descriptionId: slotModalDescriptionId,
            displayContext: 'modal'
          })}
        </SlotDetailsOverlay>
      ) : null}
    </div>
  );
}
