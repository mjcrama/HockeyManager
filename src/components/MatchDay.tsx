import { useState, useCallback, useEffect, useRef } from 'react';
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
import { WedstrijdIcon, ScoreIcon, WisselsIcon, OpstellingIcon } from './Icons';
import type { Player } from '../types';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playEndBeep(volume: 'soft' | 'loud') {
  try {
    const ctx = new AudioContext();
    const gainLevel = volume === 'loud' ? 1.0 : 0.3;
    const roundDuration = 1.1; // 3 beeps × ~0.37s each
    const pause = 2.0;
    [0, 1, 2].forEach((round) => {
      const base = round * (roundDuration + pause);
      [0, 0.4, 0.8].forEach((offset) => {
        const t = base + offset;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(gainLevel, ctx.currentTime + t);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.3);
        osc.start(ctx.currentTime + t);
        osc.stop(ctx.currentTime + t + 0.3);
      });
    });
  } catch { /* audio not available */ }
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
  benchTime: number;
  isDragging: boolean;
}

function BenchChip({ player, subCount, subbedOff, benchTime, isDragging }: BenchChipProps) {
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
      {!isDragging && <span className="bench-timer-badge">{formatTime(benchTime)}</span>}
    </div>
  );
}

export function MatchDay() {
  const { players, currentMatch } = useAppState();
  const dispatch = useAppDispatch();
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [durationInput, setDurationInput] = useState(String(Math.round(currentMatch.timerDuration / 60)));
  const [benchEntryMap, setBenchEntryMap] = useState<Record<string, number>>({});

  // Sync input when duration changes externally (e.g. reset)
  useEffect(() => {
    setDurationInput(String(Math.round(currentMatch.timerDuration / 60)));
  }, [currentMatch.timerDuration]);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    function handleClick(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [settingsOpen]);

  // Local tick just to trigger re-renders while running
  const [, tick] = useState(0);
  useEffect(() => {
    if (!currentMatch.timerRunning) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [currentMatch.timerRunning]);

  // Compute current elapsed seconds from wall clock
  const currentSeconds = currentMatch.timerRunning && currentMatch.timerStartedAt != null
    ? currentMatch.timerSeconds + Math.floor((Date.now() - currentMatch.timerStartedAt) / 1000)
    : currentMatch.timerSeconds;

  // Beep when timer crosses duration
  const prevSeconds = useRef(currentSeconds);
  useEffect(() => {
    const prev = prevSeconds.current;
    prevSeconds.current = currentSeconds;
    if (
      currentMatch.timerRunning &&
      currentMatch.timerDuration > 0 &&
      currentMatch.timerBeep !== 'off' &&
      prev < currentMatch.timerDuration &&
      currentSeconds >= currentMatch.timerDuration
    ) {
      playEndBeep(currentMatch.timerBeep);
    }
  });

  const isOvertime = currentMatch.timerDuration > 0 && currentSeconds >= currentMatch.timerDuration;
  const displaySeconds = currentMatch.timerCountDown
    ? isOvertime
      ? currentSeconds - currentMatch.timerDuration
      : currentMatch.timerDuration - currentSeconds
    : currentSeconds;

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

  const benchPlayers = players
    .filter((p) => p.available && !onFieldIds.has(p.id))
    .sort((a, b) => (subCounts.get(a.id) ?? 0) - (subCounts.get(b.id) ?? 0));
  const activePlayer = activePlayerId ? players.find((p) => p.id === activePlayerId) ?? null : null;
  const preferredPositionLabels = activePlayer ? (activePlayer.preferredPositions as string[]) : [];

  // Track when players arrive on bench (for bench timers)
  const prevSubCountRef = useRef(currentMatch.substitutions.length);
  const prevBenchIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const prevSubCount = prevSubCountRef.current;
    const currSubCount = currentMatch.substitutions.length;
    prevSubCountRef.current = currSubCount;

    const prevIds = prevBenchIdsRef.current;
    const currIds = new Set(benchPlayers.map((p) => p.id));
    prevBenchIdsRef.current = currIds;

    if (currSubCount < prevSubCount) {
      // Substitutions reset — restart timers for all current bench players
      const fresh: Record<string, number> = {};
      benchPlayers.forEach((p) => { fresh[p.id] = currentSeconds; });
      setBenchEntryMap(fresh);
      return;
    }

    // Any player newly appearing on bench gets a fresh start
    const newOnBench: string[] = [];
    currIds.forEach((id) => { if (!prevIds.has(id)) newOnBench.push(id); });
    if (newOnBench.length > 0) {
      setBenchEntryMap((m) => {
        const updated = { ...m };
        newOnBench.forEach((id) => { updated[id] = currentSeconds; });
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPlayers, currentMatch.substitutions.length]);

  const getBenchTime = (playerId: string) =>
    Math.max(0, currentSeconds - (benchEntryMap[playerId] ?? 0));

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
              minute: currentSeconds,
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
          minute: currentSeconds,
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
          {/* Rij 1: gecentreerde timer+play, reset+settings rechts */}
          <div className="match-timer__row match-timer__row--main">
            <div className="match-timer__center">
              <div className={`match-timer__display${isOvertime ? ' match-timer__display--overtime' : ''}`}>
                {isOvertime && currentMatch.timerCountDown ? '+' : ''}{formatTime(displaySeconds)}
              </div>
              {currentMatch.timerRunning ? (
                <button className="btn btn--danger match-timer__play-btn" onClick={() => dispatch({ type: 'STOP_TIMER' })}>⏸</button>
              ) : (
                <button className="btn btn--primary match-timer__play-btn" onClick={() => dispatch({ type: 'START_TIMER' })}>▶</button>
              )}
            </div>
            <div className="match-timer__secondary">
              <button
                className={`btn btn--ghost${settingsOpen ? ' btn--active' : ''}`}
                onClick={() => setSettingsOpen((o) => !o)}
              >⚙</button>
            </div>
          </div>

          {/* Rij 3: scores */}
          <div className="match-timer__row match-timer__row--scores">
            <div className="match-score__team match-score__team--home">
              <span className="match-score__label">Wij</span>
              <div className="match-score__controls">
                <button className="match-score__btn" onClick={() => dispatch({ type: 'UNDO_GOAL', payload: { team: 'home' } })}>−</button>
                <span className="match-score__value">{currentMatch.homeScore}</span>
                <button className="match-score__btn match-score__btn--add" onClick={() => dispatch({ type: 'SCORE_GOAL', payload: { team: 'home' } })}>+</button>
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
                    benchTime={getBenchTime(p.id)}
                    isDragging={activePlayerId === p.id}
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

      {settingsOpen && (
        <div className="settings-modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal" ref={settingsRef} onClick={(e) => e.stopPropagation()}>
            <p className="settings-modal__title">Instellingen</p>
            <div className="settings-modal__field">
              <label className="settings-modal__field-label">Speelduur (minuten)</label>
              <input
                className="timer-settings__input"
                type="number"
                min={1}
                max={90}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onBlur={() => {
                  const mins = Math.max(1, Math.min(90, parseInt(durationInput, 10)));
                  if (isNaN(mins)) {
                    setDurationInput(String(Math.round(currentMatch.timerDuration / 60)));
                  } else {
                    dispatch({ type: 'SET_TIMER_DURATION', payload: mins * 60 });
                  }
                }}
              />
            </div>
            <div className="settings-modal__field">
              <label className="settings-modal__field-label">Richting</label>
              <div className="timer-settings__row">
                <button
                  className={`control-btn${!currentMatch.timerCountDown ? ' control-btn--active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_TIMER_COUNTDOWN', payload: false })}
                >Oplopen</button>
                <button
                  className={`control-btn${currentMatch.timerCountDown ? ' control-btn--active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_TIMER_COUNTDOWN', payload: true })}
                >Aftellen</button>
              </div>
            </div>
            <div className="settings-modal__field">
              <label className="settings-modal__field-label">Geluid bij einde</label>
              <div className="timer-settings__row">
                {(['off', 'soft', 'loud'] as const).map((v) => (
                  <button
                    key={v}
                    className={`control-btn${currentMatch.timerBeep === v ? ' control-btn--active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_TIMER_BEEP', payload: v })}
                  >{{ off: 'Uit', soft: 'Zacht', loud: 'Hard' }[v]}</button>
                ))}
              </div>
            </div>
            <div className="timer-settings__divider" />
            <p className="settings-modal__title">Resetten</p>
            <div className="timer-settings__reset-grid">
              <button className="timer-settings__reset-btn" onClick={() => { dispatch({ type: 'RESET_TIMER' }); setSettingsOpen(false); }}>
                <span className="timer-settings__reset-icon"><WedstrijdIcon size={20} /></span>
                Tijd
              </button>
              <button className="timer-settings__reset-btn" onClick={() => { dispatch({ type: 'RESET_SCORE' }); setSettingsOpen(false); }}>
                <span className="timer-settings__reset-icon"><ScoreIcon size={20} /></span>
                Score
              </button>
              <button className="timer-settings__reset-btn" onClick={() => { dispatch({ type: 'RESET_SUBSTITUTIONS' }); setSettingsOpen(false); }}>
                <span className="timer-settings__reset-icon"><WisselsIcon size={20} /></span>
                Wissels
              </button>
              <button className="timer-settings__reset-btn" onClick={() => {
                const original = [...currentMatch.substitutions].reverse().reduce(
                  (lineup, sub) => lineup.map((e) =>
                    e.positionId === sub.positionId ? { ...e, playerId: sub.playerOffId } : e
                  ),
                  currentMatch.lineup
                );
                dispatch({ type: 'UPDATE_LINEUP', payload: original });
                dispatch({ type: 'RESET_SUBSTITUTIONS' });
                setSettingsOpen(false);
              }}>
                <span className="timer-settings__reset-icon"><OpstellingIcon size={20} /></span>
                Opstelling
              </button>
              <button className="timer-settings__reset-btn timer-settings__reset-btn--danger" onClick={() => {
                dispatch({ type: 'RESET_TIMER' });
                dispatch({ type: 'RESET_SCORE' });
                dispatch({ type: 'RESET_SUBSTITUTIONS' });
                setSettingsOpen(false);
              }}>
                <span className="timer-settings__reset-icon">↺</span>
                Alles
              </button>
            </div>
            <button className="settings-modal__close" onClick={() => setSettingsOpen(false)}>Sluiten</button>
          </div>
        </div>
      )}

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
