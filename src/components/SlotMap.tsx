import {
  PointerEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  MAP_DEFINITIONS,
  MapId,
  MapSlotAnchor,
  findAnchorForSlot
} from '../constants/mapDefinitions';
import { Slot } from '../state/types';

interface SlotMapProps {
  mapId: MapId;
  onMapChange: (mapId: MapId) => void;
  availableMaps: MapId[];
  slots: Slot[];
  selectedSlotId: string | null;
  onFocusSlot: (slotId: string) => void;
  onDropCard: (cardId: string, slotId: string) => void;
  draggedCardId: string | null;
  pausedAt: number | null;
}

interface MarkerData {
  slot: Slot;
  anchor: MapSlotAnchor;
  locked: boolean;
  occupied: boolean;
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
  selectedSlotId,
  onFocusSlot,
  onDropCard,
  draggedCardId,
  pausedAt
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
    const now = Date.now();
    const pausedElapsedMs = pausedAt !== null ? Math.max(0, now - pausedAt) : 0;
    return slots
      .map((slot) => {
        const anchor = findAnchorForSlot(map, slot.key);
        if (!anchor) {
          return null;
        }
        const lockRemaining = slot.lockedUntil
          ? Math.max(0, slot.lockedUntil - now + pausedElapsedMs)
          : 0;
        return {
          slot,
          anchor,
          locked: Boolean(slot.lockedUntil && lockRemaining > 0),
          occupied: Boolean(slot.occupantId),
          damaged: slot.state === 'damaged',
          resolving: Boolean(slot.pendingAction)
        } satisfies MarkerData;
      })
      .filter((value): value is MarkerData => value !== null)
      .sort((a, b) => a.slot.name.localeCompare(b.slot.name));
  }, [map, pausedAt, slots]);

  const canDropOnSlot = useCallback(
    (slot: Slot, locked: boolean) => {
      return Boolean(!locked && slot.unlocked);
    },
    []
  );

  const handleMarkerClick = useCallback(
    (slotId: string) => {
      onFocusSlot(slotId);
    },
    [onFocusSlot]
  );

  const handleMarkerDrop = useCallback(
    (slotId: string, event: DragEvent<HTMLButtonElement>) => {
      const marker = markers.find((entry) => entry.slot.id === slotId);
      if (!marker || !canDropOnSlot(marker.slot, marker.locked)) {
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

    return markers.map(({ slot, anchor, locked, occupied, damaged, resolving }) => {
      const isSelected = slot.id === selectedSlotId;
      const isHovered = slot.id === hoveredSlotId;
      const isDroppable = Boolean(draggedCardId && canDropOnSlot(slot, locked));
      const markerClass = [
        'slot-map__marker',
        isSelected ? 'slot-map__marker--selected' : '',
        locked ? 'slot-map__marker--locked' : '',
        occupied ? 'slot-map__marker--occupied' : '',
        damaged ? 'slot-map__marker--damaged' : '',
        resolving ? 'slot-map__marker--resolving' : '',
        isHovered ? 'slot-map__marker--hovered' : '',
        isDroppable ? 'slot-map__marker--droppable' : ''
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
      } else if (occupied) {
        statusParts.push('Occupied');
      } else {
        statusParts.push('Open');
      }
      if (damaged) {
        statusParts.push('Damaged');
      }

      return (
        <button
          key={slot.id}
          type="button"
          data-slot-id={slot.id}
          className={markerClass}
          style={{ left: `${anchor.x}%`, top: `${anchor.y}%` }}
          onClick={() => handleMarkerClick(slot.id)}
          onDragOver={(event) => {
            if (!draggedCardId || !canDropOnSlot(slot, locked)) {
              return;
            }
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            setHoveredSlotId(slot.id);
          }}
          onDragEnter={(event) => {
            if (!draggedCardId || !canDropOnSlot(slot, locked)) {
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
          <span className="slot-map__marker-label" aria-hidden="true">
            {slot.name}
          </span>
        </button>
      );
    });
  }, [
    markers,
    selectedSlotId,
    hoveredSlotId,
    draggedCardId,
    canDropOnSlot,
    handleMarkerClick,
    handleMarkerDrop
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
