import {
  PointerEvent,
  type CSSProperties,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  MAP_DEFINITIONS,
  MAP_SEQUENCE,
  MapId,
  MapSlotAnchor,
  findAnchorForSlot
} from '../constants/mapDefinitions';
import type { CardInstance, Slot } from '../state/types';
import { describeCardForStatus } from '../utils/slotActions';
import { formatDurationLabel } from '../utils/time';

type MarkerPlaceholderState = 'locked' | 'busy' | 'open';

const CARD_TYPE_GLYPHS: Record<CardInstance['type'], string> = {
  persona: '👤',
  inspiration: '✨',
  relic: '🔶',
  task: '📜'
};

const PLACEHOLDER_GLYPHS: Record<MarkerPlaceholderState, string> = {
  locked: '🔒',
  busy: '⏳',
  open: '＋'
};

const DEFAULT_GLYPH = '✦';

export interface SlotMapSlotSummary {
  occupant: CardInstance | null;
  assistant: CardInstance | null;
  attachments: CardInstance[];
  isHeroInSlot: boolean;
  canExploreLocation: boolean;
  isSlotInteractive: boolean;
  isLocked: boolean;
  actionLabel: string | null;
  canActivate: boolean;
  availabilityNote: string | null;
  lockRemainingMs: number;
  lockTotalMs: number | null;
}

interface SlotMapProps {
  mapId: MapId;
  onMapChange: (mapId: MapId) => void;
  availableMaps: MapId[];
  slots: Slot[];
  slotSummaries: Record<string, SlotMapSlotSummary>;
  selectedSlotId: string | null;
  onFocusSlot: (slotId: string) => void;
  onOpenSlotDetails: (slotId: string) => void;
  onActivateSlot: (slotId: string) => void;
  onDropCard: (cardId: string, slotId: string) => void;
  draggedCard: CardInstance | null;
}

interface MarkerData {
  slot: Slot;
  anchor: MapSlotAnchor;
  summary: SlotMapSlotSummary | null;
  locked: boolean;
  damaged: boolean;
  resolving: boolean;
}

const MIN_ZOOM = 0.85;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.2;

export function SlotMap({
  mapId,
  availableMaps,
  onMapChange,
  slots,
  slotSummaries,
  selectedSlotId,
  onFocusSlot,
  onOpenSlotDetails,
  onActivateSlot,
  onDropCard,
  draggedCard
}: SlotMapProps) {
  const map = MAP_DEFINITIONS[mapId];
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [hoveredSlotId, setHoveredSlotId] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const markers = useMemo<MarkerData[]>(() => {
    return slots
      .map((slot) => {
        const anchor = findAnchorForSlot(map, slot.key);
        if (!anchor) {
          return null;
        }
        const summary = slotSummaries[slot.id] ?? null;
        const locked = !slot.unlocked || Boolean(summary?.isLocked);
        return {
          slot,
          anchor,
          summary,
          locked,
          damaged: slot.state === 'damaged',
          resolving: Boolean(slot.pendingAction)
        } satisfies MarkerData;
      })
      .filter((value): value is MarkerData => value !== null)
      .sort((a, b) => a.slot.name.localeCompare(b.slot.name));
  }, [map, slotSummaries, slots]);

  const canDropOnSlot = useCallback(
    (slot: Slot, summary: SlotMapSlotSummary | null) => {
      if (!summary) {
        return false;
      }
      return Boolean(summary.isSlotInteractive && slot.unlocked);
    },
    []
  );

  const handleMarkerClick = useCallback(
    (slotId: string) => {
      onFocusSlot(slotId);
      onOpenSlotDetails(slotId);
    },
    [onFocusSlot, onOpenSlotDetails]
  );

  const handleMarkerDrop = useCallback(
    (slotId: string, event: DragEvent<HTMLButtonElement>) => {
      const marker = markers.find((entry) => entry.slot.id === slotId);
      if (!marker || !canDropOnSlot(marker.slot, marker.summary)) {
        setHoveredSlotId(null);
        return;
      }
      const cardId = event.dataTransfer?.getData('application/x-hallowmoon-card');
      if (!cardId) {
        return;
      }
      event.preventDefault();
      setHoveredSlotId(null);
      onDropCard(cardId, slotId);
    },
    [canDropOnSlot, markers, onDropCard]
  );

  const clampScale = useCallback((next: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)), []);

  const setZoom = useCallback(
    (next: number) => {
      setScale((prev) => {
        const target = clampScale(typeof next === 'number' ? next : prev);
        return target;
      });
    },
    [clampScale]
  );

  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [mapId]);

  const zoomIn = useCallback(() => setZoom(scale + ZOOM_STEP), [scale, setZoom]);
  const zoomOut = useCallback(() => setZoom(scale - ZOOM_STEP), [scale, setZoom]);
  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey) {
        return;
      }
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      setZoom(scale + direction * ZOOM_STEP);
    },
    [scale, setZoom]
  );

  const beginPan = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      if (!(event.target instanceof Element)) {
        return;
      }
      const target = event.target as HTMLElement;
      if (target.closest('button[data-slot-id]')) {
        return;
      }
      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }
      const pointerId = event.pointerId;
      panStateRef.current = {
        pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y
      };
      viewport.setPointerCapture(pointerId);
    },
    [offset.x, offset.y]
  );

  const updatePan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const state = panStateRef.current;
    if (!state || state.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    const deltaX = event.clientX - state.startX;
    const deltaY = event.clientY - state.startY;
    setOffset({ x: state.originX + deltaX, y: state.originY + deltaY });
  }, []);

  const endPan = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current;
    const state = panStateRef.current;
    if (viewport && state && state.pointerId === event.pointerId) {
      viewport.releasePointerCapture(state.pointerId);
      panStateRef.current = null;
    }
  }, []);

  const markerElements = useMemo(() => {
    if (markers.length === 0) {
      return (
        <p className="slot-map__empty" role="status">
          No sites are present on this map yet.
        </p>
      );
    }

    return markers.map(({ slot, anchor, summary, locked, damaged, resolving }) => {
      const isSelected = slot.id === selectedSlotId;
      const isHovered = slot.id === hoveredSlotId;
      const isDroppable = Boolean(draggedCard && canDropOnSlot(slot, summary));
      const showDraggedPreview = Boolean(isHovered && isDroppable && draggedCard);
      const occupant = summary?.occupant ?? null;
      const previewCard = showDraggedPreview ? draggedCard : occupant;
      const placeholderState: MarkerPlaceholderState = !slot.unlocked
        ? 'locked'
        : locked
        ? 'busy'
        : 'open';
      const markerGlyph = previewCard
        ? CARD_TYPE_GLYPHS[previewCard.type] ?? DEFAULT_GLYPH
        : PLACEHOLDER_GLYPHS[placeholderState] ?? DEFAULT_GLYPH;
      const lockRemainingMs = summary?.lockRemainingMs ?? 0;
      const lockTotalMs = summary?.lockTotalMs ?? null;
      const showTimer = Boolean(summary?.isLocked && lockRemainingMs > 0);
      const remainingFraction =
        showTimer && lockTotalMs && lockTotalMs > 0
          ? Math.min(1, Math.max(0, lockRemainingMs / lockTotalMs))
          : null;
      const timerAngle = showTimer
        ? remainingFraction !== null
          ? remainingFraction * 360
          : 360
        : 0;
      const timerProgress =
        showTimer && remainingFraction !== null ? 1 - remainingFraction : showTimer ? 0 : null;
      const timerStyle = showTimer
        ? ({
            '--slot-timer-angle': `${timerAngle}deg`,
            ...(timerProgress !== null ? { '--slot-timer-progress': timerProgress.toFixed(3) } : {})
          } satisfies CSSProperties)
        : undefined;
      const markerClass = [
        'slot-map__marker',
        isSelected ? 'slot-map__marker--selected' : '',
        locked ? 'slot-map__marker--locked' : '',
        occupant ? 'slot-map__marker--occupied' : '',
        damaged ? 'slot-map__marker--damaged' : '',
        resolving ? 'slot-map__marker--resolving' : '',
        isHovered ? 'slot-map__marker--hovered' : '',
        isDroppable ? 'slot-map__marker--droppable' : '',
        showDraggedPreview ? 'slot-map__marker--preview' : ''
      ]
        .filter(Boolean)
        .join(' ');

      const statusParts: string[] = [];
      if (!slot.unlocked) {
        statusParts.push('Locked discovery');
      } else if (locked) {
        statusParts.push('Resolving action');
      } else if (resolving) {
        statusParts.push('Exploration underway');
      } else if (occupant) {
        const occupantStatus = describeCardForStatus(occupant);
        statusParts.push(occupantStatus ? `Occupied by ${occupantStatus}` : 'Occupied');
      } else {
        statusParts.push('Open');
      }
      if (damaged) {
        statusParts.push('Damaged');
      }
      if (summary?.isLocked && lockRemainingMs > 0) {
        statusParts.push(`≈ ${formatDurationLabel(lockRemainingMs)} remain`);
      }
      if (summary?.availabilityNote) {
        statusParts.push(summary.availabilityNote);
      }

      const actionLabel = summary?.actionLabel ?? null;
      const actionReady = Boolean(
        actionLabel && summary?.canActivate && summary?.isSlotInteractive && summary?.occupant
      );

      const travelTargetMapId =
        mapId === 'overworld' && slot.location
          ?
              MAP_SEQUENCE.find((candidate) => {
                if (candidate === 'overworld') {
                  return false;
                }
                const definition = MAP_DEFINITIONS[candidate];
                return definition.focusLocations.includes(slot.location);
              }) ?? null
          : null;
      const travelDefinition = travelTargetMapId ? MAP_DEFINITIONS[travelTargetMapId] : null;
      const canTravelToTarget = Boolean(
        travelTargetMapId && travelDefinition && availableMaps.includes(travelTargetMapId) && !occupant
      );
      const travelLabel = travelDefinition ? `Visit ${travelDefinition.name}` : null;

      return (
        <div
          key={slot.id}
          className={markerClass}
          style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
        >
          <button
            type="button"
            data-slot-id={slot.id}
            className="slot-map__marker-button"
            onClick={() => handleMarkerClick(slot.id)}
            onDragOver={(event) => {
              if (!draggedCard || !canDropOnSlot(slot, summary)) {
                return;
              }
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setHoveredSlotId(slot.id);
            }}
            onDragEnter={(event) => {
              if (!draggedCard || !canDropOnSlot(slot, summary)) {
                return;
              }
              event.preventDefault();
              setHoveredSlotId(slot.id);
            }}
            onDragLeave={(event) => {
              if (!(event.currentTarget instanceof HTMLElement)) {
                return;
              }
              const related = event.relatedTarget as Node | null;
              if (related && event.currentTarget.contains(related)) {
                return;
              }
              setHoveredSlotId((current) => (current === slot.id ? null : current));
            }}
            onDrop={(event) => handleMarkerDrop(slot.id, event)}
            aria-pressed={isSelected}
            aria-label={`${slot.name} — ${statusParts.join(', ')}`}
          >
            <span className="slot-map__marker-outline" aria-hidden="true" />
            {showTimer ? (
              <span
                className="slot-map__marker-timer"
                aria-hidden="true"
                data-active="true"
                style={timerStyle}
              />
            ) : null}
            <span
              className="slot-map__marker-emblem"
              data-card-type={previewCard ? previewCard.type : undefined}
              data-marker-state={previewCard ? undefined : placeholderState}
              data-preview={showDraggedPreview ? 'true' : undefined}
              aria-hidden="true"
            >
              <span className="slot-map__marker-emblem-icon">{markerGlyph}</span>
            </span>
          </button>
          {canTravelToTarget && travelTargetMapId && travelLabel ? (
            <button
              type="button"
              data-slot-id={slot.id}
              className="slot-map__marker-action"
              onClick={(event) => {
                event.stopPropagation();
                onFocusSlot(slot.id);
                onMapChange(travelTargetMapId);
              }}
              aria-label={`${travelLabel} ${slot.name}`}
            >
              {travelLabel}
            </button>
          ) : null}
          {!canTravelToTarget && actionReady ? (
            <button
              type="button"
              data-slot-id={slot.id}
              className="slot-map__marker-action"
              onClick={(event) => {
                event.stopPropagation();
                onFocusSlot(slot.id);
                onActivateSlot(slot.id);
              }}
              aria-label={`${actionLabel} ${slot.name}`}
            >
              {actionLabel}
            </button>
          ) : null}
          <span className="slot-map__marker-label" aria-hidden="true">
            {slot.name}
          </span>
        </div>
      );
    });
  }, [
    availableMaps,
    canDropOnSlot,
    draggedCard,
    handleMarkerClick,
    handleMarkerDrop,
    hoveredSlotId,
    mapId,
    markers,
    onActivateSlot,
    onFocusSlot,
    onMapChange,
    selectedSlotId
  ]);

  return (
    <section className="slot-map" aria-label={`${map.name} map`}> 
      <header className="slot-map__header">
        <div className="slot-map__title-block">
          <h2 className="slot-map__title">{map.name}</h2>
          <p className="slot-map__description">{map.description}</p>
        </div>
        <div className="slot-map__controls" role="group" aria-label="Map tools">
          <div className="slot-map__map-select" role="tablist" aria-label="Map views">
            {availableMaps.map((id) => {
              const definition = MAP_DEFINITIONS[id];
              const isActive = id === mapId;
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  className={`slot-map__map-button${isActive ? ' slot-map__map-button--active' : ''}`}
                  onClick={() => onMapChange(id)}
                >
                  {definition.name}
                </button>
              );
            })}
          </div>
          <div className="slot-map__zoom" role="group" aria-label="Zoom controls">
            <button type="button" onClick={zoomOut} className="slot-map__zoom-button" aria-label="Zoom out">
              −
            </button>
            <button type="button" onClick={zoomIn} className="slot-map__zoom-button" aria-label="Zoom in">
              +
            </button>
          </div>
        </div>
      </header>
      <div
        ref={viewportRef}
        className="slot-map__viewport"
        onPointerDown={beginPan}
        onPointerMove={updatePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={handleWheel}
      >
        <div
          className="slot-map__canvas"
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
        >
          <img src={map.image.src} alt="" className="slot-map__image" />
          <div className="slot-map__markers" aria-hidden={markers.length === 0}>
            {markerElements}
          </div>
        </div>
      </div>
    </section>
  );
}
