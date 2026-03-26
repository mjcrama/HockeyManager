import { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  pointerWithin,
} from '@dnd-kit/core';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { FieldCanvas } from './FieldCanvas';
import { PlayerChip } from './PlayerChip';
import { getPositions } from '../data/formations';
import type { Player } from '../types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Empty drop slot — shown when a field player is being dragged
function BenchEmptySlot() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'matchday-bench-empty',
    data: { isEmptySlot: true },
  });
  return (
    <div
      ref={setNodeRef}
      className={['bench-empty-slot', isOver ? 'bench-empty-slot--over' : ''].join(' ').trim()}
    />
  );
}

interface BenchChipProps {
  player: Player;
  subCount: number;
  subbedOff: boolean;
}

function BenchChip({ player, subCount, subbedOff }: BenchChipProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `matchday-bench-drop-${player.id}`,
    data: { isBenchPlayer: true, benchPlayerId: player.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        subbedOff ? 'bench-chip-wrapper bench-chip-wrapper--subbed' : 'bench-chip-wrapper',
        isOver ? 'bench-chip-wrapper--drop-over' : '',
      ].join(' ').trim()}
    >
      <PlayerChip
        player={player}
        draggableId={`matchday-bench-${player.id}`}
        size="medium"
        isOnField={false}
        subCount={subCount}
      />
    </div>
  );
}

export function MatchDay() {
  const { players, currentMatch } = useAppState();
  const dispatch = useAppDispatch();
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const positions = getPositions(currentMatch.playerCount, currentMatch.formation);

  const onFieldIds = new Set(
    currentMatch.lineup.filter((e) => e.playerId !== null).map((e) => e.playerId as string)
  );

  const substitutedOffIds = new Set(currentMatch.substitutions.map((s) => s.playerOffId));
  const substitutedOnIds  = new Set(currentMatch.substitutions.map((s) => s.playerOnId));

  const subCounts = new Map<string, number>();
  currentMatch.substitutions.forEach((s) => {
    subCounts.set(s.playerOffId, (subCounts.get(s.playerOffId) ?? 0) + 1);
    subCounts.set(s.playerOnId,  (subCounts.get(s.playerOnId)  ?? 0) + 1);
  });

  const substitutedOnPositionIds = new Set(
    currentMatch.lineup
      .filter((e) => e.playerId && substitutedOnIds.has(e.playerId))
      .map((e) => e.positionId)
  );

  const benchPlayers = players.filter((p) => p.available && !onFieldIds.has(p.id));
  const activePlayer = activePlayerId ? players.find((p) => p.id === activePlayerId) ?? null : null;
  const preferredPositionLabels = activePlayer ? (activePlayer.preferredPositions as string[]) : [];

  // Show the empty bench slot when a field player is being dragged
  const isDraggingFieldPlayer = activePlayerId !== null && onFieldIds.has(activePlayerId);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as { playerId: string } | undefined;
    if (data?.playerId) setActivePlayerId(data.playerId);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePlayerId(null);
      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current as {
        playerId: string | null;
        isOnField: boolean;
        sourcePositionId?: string;
      } | undefined;

      const dropData = over.data.current as
        | { positionId: string; isPosition: boolean; currentPlayerId?: string | null }
        | { isEmptySlot: true }
        | { isBenchPlayer: true; benchPlayerId: string }
        | undefined;

      if (!dragData?.playerId) return;
      const playerId = dragData.playerId;

      // ── Field player → empty bench slot: remove from field ────────────────
      if (dropData && 'isEmptySlot' in dropData) {
        if (dragData.isOnField) {
          dispatch({
            type: 'UPDATE_LINEUP',
            payload: currentMatch.lineup.map((e) =>
              e.playerId === playerId ? { ...e, playerId: null } : e
            ),
          });
        }
        return;
      }

      // ── Field player → bench chip: substitute ─────────────────────────────
      if (dropData && 'isBenchPlayer' in dropData) {
        if (dragData.isOnField && dragData.sourcePositionId) {
          dispatch({
            type: 'ADD_SUBSTITUTION',
            payload: {
              playerOnId: dropData.benchPlayerId,
              playerOffId: playerId,
              positionId: dragData.sourcePositionId,
              minute: currentMatch.timerSeconds,
              timestamp: Date.now(),
            },
          });
        }
        return;
      }

      if (!dropData || !('isPosition' in dropData) || !dropData.isPosition) return;

      const targetPositionId = dropData.positionId;
      const currentAtTarget  = dropData.currentPlayerId ?? null;

      // ── Field → Field: swap ───────────────────────────────────────────────
      if (dragData.isOnField && dragData.sourcePositionId) {
        const srcId = dragData.sourcePositionId;
        if (srcId === targetPositionId) return;
        dispatch({
          type: 'UPDATE_LINEUP',
          payload: currentMatch.lineup.map((e) => {
            if (e.positionId === targetPositionId) return { ...e, playerId };
            if (e.positionId === srcId)            return { ...e, playerId: currentAtTarget };
            return e;
          }),
        });
        return;
      }

      // ── Bench → empty position ────────────────────────────────────────────
      if (!currentAtTarget) {
        dispatch({
          type: 'ASSIGN_PLAYER_TO_POSITION',
          payload: { positionId: targetPositionId, playerId },
        });
        return;
      }

      // ── Bench → occupied position: substitute ────────────────────────────
      dispatch({
        type: 'ADD_SUBSTITUTION',
        payload: {
          playerOnId: playerId,
          playerOffId: currentAtTarget,
          positionId: targetPositionId,
          minute: currentMatch.timerSeconds,
          timestamp: Date.now(),
        },
      });
    },
    [currentMatch.lineup, currentMatch.timerSeconds, dispatch]
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="match-day">
        {/* Timer + Score */}
        <div className="match-timer">
          <div className="match-timer__top">
            <div className="match-score__team match-score__team--home">
              <span className="match-score__label">Wij</span>
              <div className="match-score__controls">
                <button className="match-score__btn" onClick={() => dispatch({ type: 'UNDO_GOAL', payload: { team: 'home' } })}>−</button>
                <span className="match-score__value">{currentMatch.homeScore}</span>
                <button className="match-score__btn match-score__btn--add" onClick={() => dispatch({ type: 'SCORE_GOAL', payload: { team: 'home' } })}>+</button>
              </div>
            </div>

            <div className="match-timer__center">
              <div className="match-timer__display">{formatTime(currentMatch.timerSeconds)}</div>
              <div className="match-timer__controls">
                {currentMatch.timerRunning ? (
                  <button className="btn btn--danger btn--sm" onClick={() => dispatch({ type: 'STOP_TIMER' })}>⏸</button>
                ) : (
                  <button className="btn btn--primary btn--sm" onClick={() => dispatch({ type: 'START_TIMER' })}>▶</button>
                )}
                <button className="btn btn--ghost btn--sm" onClick={() => {
                  dispatch({ type: 'RESET_TIMER' });
                  dispatch({ type: 'RESET_SUBSTITUTIONS' });
                }}>↺</button>
              </div>
            </div>

            <div className="match-score__team match-score__team--away">
              <span className="match-score__label">Zij</span>
              <div className="match-score__controls">
                <button className="match-score__btn" onClick={() => dispatch({ type: 'UNDO_GOAL', payload: { team: 'away' } })}>−</button>
                <span className="match-score__value">{currentMatch.awayScore}</span>
                <button className="match-score__btn match-score__btn--add" onClick={() => dispatch({ type: 'SCORE_GOAL', payload: { team: 'away' } })}>+</button>
              </div>
            </div>
          </div>

          <div className="match-timer__info">
            <span>{currentMatch.playerCount}v{currentMatch.playerCount} · {currentMatch.formation}</span>
          </div>
        </div>

        {/* Main content */}
        <div className="match-day__main">
          <div className="match-day__field-wrapper">
            <FieldCanvas
              positions={positions}
              lineup={currentMatch.lineup}
              players={players}
              fieldSize={currentMatch.fieldSize}
              substitutedOnPositionIds={substitutedOnPositionIds}
              preferredPositionLabels={preferredPositionLabels}
              className="match-day__canvas"
            />
          </div>

          <div className="match-day__sidebar">
            <div className="match-day__bench">
              <h3 className="match-day__bench-title">Bank ({benchPlayers.length})</h3>
              <div className="match-day__bench-players">
                {isDraggingFieldPlayer && <BenchEmptySlot />}
                {benchPlayers.map((p) => (
                  <BenchChip
                    key={p.id}
                    player={p}
                    subCount={subCounts.get(p.id) ?? 0}
                    subbedOff={substitutedOffIds.has(p.id)}
                  />
                ))}
                {benchPlayers.length === 0 && !isDraggingFieldPlayer && (
                  <p className="match-day__bench-empty">Geen bankspelers</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePlayer && (
          <PlayerChip
            player={activePlayer}
            draggableId={`overlay-${activePlayer.id}`}
            size="medium"
            isOverlay
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
