import { useState, useCallback, useEffect, useRef } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
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
import { useTeam } from '../context/TeamContext';
import { FieldCanvas } from './FieldCanvas';
import { PlayerChip } from './PlayerChip';
import { getPositions } from '../data/formations';
import { getPeriodLabel } from '../data/matchProfiles';
import { WedstrijdIcon, ScoreIcon, WisselsIcon, OpstellingIcon } from './Icons';
import type { Player } from '../types';

/** Reconstruct the original lineup before any substitutions were made */
function getInitialLineup(
  substitutions: { positionId: string; playerOffId: string }[],
  lineup: { positionId: string; playerId: string | null }[]
) {
  return [...substitutions].reverse().reduce(
    (acc, s) => acc.map((e) => e.positionId === s.positionId ? { ...e, playerId: s.playerOffId } : e),
    lineup
  );
}

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
  isSelected?: boolean;
  onClick?: () => void;
}

function BenchChip({ player, subCount, subbedOff, benchTime, isDragging, isSelected, onClick }: BenchChipProps) {
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
        isSelected ? 'bench-chip-wrapper--selected' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
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

type SelectedPlayer =
  | { type: 'field'; positionId: string; playerId: string | null }
  | { type: 'bench'; playerId: string }
  | null;

export function MatchDay() {
  const { players, currentMatch } = useAppState();
  const dispatch = useAppDispatch();
  const { isViewer } = useTeam();
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  useScrollLock(settingsOpen);
  const [benchEntryMap, setBenchEntryMap] = useState<Record<string, number>>({});

  const drawerRef = useRef<HTMLDivElement>(null);

  // Local tick to trigger re-renders while running or break is running
  const [, tick] = useState(0);
  useEffect(() => {
    if (!currentMatch.timerRunning && !currentMatch.breakRunning) return;
    const id = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, [currentMatch.timerRunning, currentMatch.breakRunning]);

  // Compute current elapsed seconds from wall clock
  const currentSeconds = currentMatch.timerRunning && currentMatch.timerStartedAt != null
    ? currentMatch.timerSeconds + Math.floor((Date.now() - currentMatch.timerStartedAt) / 1000)
    : currentMatch.timerSeconds;

  // Compute current break seconds from wall clock
  const currentBreakSeconds = currentMatch.breakRunning && currentMatch.breakStartedAt != null
    ? currentMatch.breakSeconds + Math.floor((Date.now() - currentMatch.breakStartedAt) / 1000)
    : currentMatch.breakSeconds;

  // Beep + vibrate when period timer crosses duration
  const prevSeconds = useRef(currentSeconds);
  const prevBreakSeconds = useRef(currentBreakSeconds);
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
      if (currentMatch.timerVibrate && 'vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 300]);
      }
    }

    const prevBreak = prevBreakSeconds.current;
    prevBreakSeconds.current = currentBreakSeconds;
    if (
      currentMatch.breakRunning &&
      currentMatch.breakDuration > 0 &&
      currentMatch.timerBeep !== 'off' &&
      prevBreak < currentMatch.breakDuration &&
      currentBreakSeconds >= currentMatch.breakDuration
    ) {
      playEndBeep(currentMatch.timerBeep);
      if (currentMatch.timerVibrate && 'vibrate' in navigator) {
        navigator.vibrate([300, 150, 300, 150, 300]);
      }
    }
  });

  // Close drawer on outside click
  useEffect(() => {
    if (!controlsOpen) return;
    function handle(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setControlsOpen(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [controlsOpen]);

  const isOvertime = currentMatch.timerDuration > 0 && currentSeconds >= currentMatch.timerDuration;
  const isBreakOvertime = currentMatch.inBreak && currentMatch.breakDuration > 0 && currentBreakSeconds >= currentMatch.breakDuration;
  const isMatchOver = currentMatch.currentPeriod > currentMatch.periods && !currentMatch.inBreak;
  const isLastPeriod = currentMatch.currentPeriod >= currentMatch.periods;

  const displaySeconds = currentMatch.timerCountDown
    ? isOvertime
      ? currentSeconds - currentMatch.timerDuration
      : currentMatch.timerDuration - currentSeconds
    : currentSeconds;

  const displayBreakSeconds = isBreakOvertime
    ? currentBreakSeconds - currentMatch.breakDuration
    : currentMatch.breakDuration - currentBreakSeconds;

  const periodLabel = isMatchOver
    ? 'Wedstrijd afgelopen'
    : currentMatch.inBreak
      ? 'Rust'
      : getPeriodLabel(currentMatch.currentPeriod, currentMatch.periods);

  const nextPeriodLabel = getPeriodLabel(currentMatch.currentPeriod + 1, currentMatch.periods);
  const endPeriodLabel = isLastPeriod ? 'Wedstrijd beëindigen' : `Einde ${getPeriodLabel(currentMatch.currentPeriod, currentMatch.periods)} →`;

  // Build match progress segments
  const progressSegments: { type: 'period' | 'break'; duration: number; start: number }[] = [];
  let segOffset = 0;
  for (let i = 0; i < currentMatch.periods; i++) {
    progressSegments.push({ type: 'period', duration: currentMatch.timerDuration, start: segOffset });
    segOffset += currentMatch.timerDuration;
    if (i < currentMatch.periods - 1) {
      progressSegments.push({ type: 'break', duration: currentMatch.breakDuration, start: segOffset });
      segOffset += currentMatch.breakDuration;
    }
  }
  const totalMatchDuration = segOffset;

  const absolutePosition = isMatchOver
    ? totalMatchDuration
    : currentMatch.inBreak
      ? currentMatch.currentPeriod * currentMatch.timerDuration +
        (currentMatch.currentPeriod - 1) * currentMatch.breakDuration +
        currentBreakSeconds
      : (currentMatch.currentPeriod - 1) * currentMatch.timerDuration +
        (currentMatch.currentPeriod - 1) * currentMatch.breakDuration +
        currentSeconds;

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor   = useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useSensors(...(isViewer ? [] : [pointerSensor, touchSensor]));

  const positions = getPositions(currentMatch.playerCount, currentMatch.formation);

  const onFieldIds = new Set(
    currentMatch.lineup.filter((e) => e.playerId !== null).map((e) => e.playerId as string)
  );

  const substitutedOffIds = new Set(currentMatch.substitutions.map((s) => s.playerOffId));
  const substitutedOnIds  = new Set(currentMatch.substitutions.map((s) => s.playerOnId));

  const initialLineup = getInitialLineup(currentMatch.substitutions, currentMatch.lineup);
  const initialFieldIds = new Set(
    initialLineup.filter((e) => e.playerId !== null).map((e) => e.playerId as string)
  );

  // Players who started on the bench begin with count 1. Only count a substitution when
  // the incoming player (playerOnId) actually came from the bench — this excludes any
  // field-to-field swaps that might be recorded as substitutions.
  const subCounts = new Map<string, number>();
  const currentBenchIds = new Set(
    players.filter((p) => p.available && !initialFieldIds.has(p.id)).map((p) => p.id)
  );
  currentBenchIds.forEach((id) => subCounts.set(id, 1));
  currentMatch.substitutions.forEach((s) => {
    if (currentBenchIds.has(s.playerOnId)) {
      subCounts.set(s.playerOffId, (subCounts.get(s.playerOffId) ?? 0) + 1);
      currentBenchIds.delete(s.playerOnId);
      currentBenchIds.add(s.playerOffId);
    }
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

  // Stable ID string: only changes when the SET of bench players changes,
  // not on every re-render (timer ticks, etc.)
  const benchPlayerIds = benchPlayers.map((p) => p.id).sort().join(',');

  // Detect players newly arriving on the bench
  const prevBenchIdsRef = useRef(new Set<string>());
  useEffect(() => {
    const currIds = new Set(benchPlayers.map((p) => p.id));
    const prevIds = prevBenchIdsRef.current;
    prevBenchIdsRef.current = currIds;

    const newOnBench = benchPlayers.filter((p) => !prevIds.has(p.id));
    if (newOnBench.length > 0) {
      setBenchEntryMap((m) => {
        const updated = { ...m };
        newOnBench.forEach((p) => { updated[p.id] = currentSeconds; });
        return updated;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [benchPlayerIds]);

  // Reset all bench timers only when substitutions are explicitly cleared
  const prevSubCountRef = useRef(currentMatch.substitutions.length);
  useEffect(() => {
    const prev = prevSubCountRef.current;
    const curr = currentMatch.substitutions.length;
    prevSubCountRef.current = curr;

    if (curr === 0 && prev > 0) {
      const fresh: Record<string, number> = {};
      benchPlayers.forEach((p) => { fresh[p.id] = currentSeconds; });
      setBenchEntryMap(fresh);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch.substitutions.length]);

  const getBenchTime = (playerId: string) =>
    Math.max(0, currentSeconds - (benchEntryMap[playerId] ?? 0));

  // Show the empty bench slot when a field player is being dragged
  const isDraggingFieldPlayer = activePlayerId !== null && onFieldIds.has(activePlayerId);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    if (isViewer) return;
    setSelectedPlayer(null);
    const data = event.active.data.current as { playerId: string } | undefined;
    if (data?.playerId) setActivePlayerId(data.playerId);
  }, [isViewer]);

  function handlePositionClick(positionId: string, playerId: string | null) {
    if (isViewer) return;
    if (!selectedPlayer) {
      setSelectedPlayer({ type: 'field', positionId, playerId });
      return;
    }
    if (selectedPlayer.type === 'field' && selectedPlayer.positionId === positionId) {
      setSelectedPlayer(null);
      return;
    }
    if (selectedPlayer.type === 'field') {
      // Field → Field: swap positions (no substitution)
      const srcId = selectedPlayer.positionId;
      const srcPlayerId = selectedPlayer.playerId;
      const newLineup = currentMatch.lineup.map((e) => {
        if (e.positionId === positionId) return { ...e, playerId: srcPlayerId };
        if (e.positionId === srcId)      return { ...e, playerId };
        return e;
      });
      dispatch({ type: 'UPDATE_LINEUP', payload: newLineup });
      setSelectedPlayer(null);
      return;
    }
    // Bench player selected → substitution if occupied, assign if empty
    if (playerId) {
      dispatch({
        type: 'ADD_SUBSTITUTION',
        payload: {
          playerOnId: selectedPlayer.playerId,
          playerOffId: playerId,
          positionId,
          minute: currentSeconds,
          timestamp: Date.now(),
        },
      });
    } else {
      dispatch({ type: 'ASSIGN_PLAYER_TO_POSITION', payload: { positionId, playerId: selectedPlayer.playerId } });
    }
    setSelectedPlayer(null);
  }

  function handleBenchClick(playerId: string) {
    if (isViewer) return;
    if (!selectedPlayer) {
      setSelectedPlayer({ type: 'bench', playerId });
      return;
    }
    if (selectedPlayer.type === 'bench' && selectedPlayer.playerId === playerId) {
      setSelectedPlayer(null);
      return;
    }
    if (selectedPlayer.type === 'bench') {
      setSelectedPlayer({ type: 'bench', playerId });
      return;
    }
    // Field position selected → substitute or assign
    if (selectedPlayer.playerId) {
      dispatch({
        type: 'ADD_SUBSTITUTION',
        payload: {
          playerOnId: playerId,
          playerOffId: selectedPlayer.playerId,
          positionId: selectedPlayer.positionId,
          minute: currentSeconds,
          timestamp: Date.now(),
        },
      });
    } else {
      dispatch({ type: 'ASSIGN_PLAYER_TO_POSITION', payload: { positionId: selectedPlayer.positionId, playerId } });
    }
    setSelectedPlayer(null);
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePlayerId(null);
      if (isViewer) return;
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

  const isPaused = (!currentMatch.timerRunning && !currentMatch.inBreak && !isMatchOver)
    || (currentMatch.inBreak && !currentMatch.breakRunning);
  const timerDisplayClass = [
    'match-timer__display',
    (isOvertime || isBreakOvertime) ? 'match-timer__display--overtime' : '',
    isPaused ? 'match-timer__display--paused' : '',
  ].filter(Boolean).join(' ');

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="match-day">
        {/* Timer + Score */}
        <div className="match-timer" ref={drawerRef}>
          {/* Clickable timer bar */}
          <div
            className="match-timer__bar"
            role="button"
            tabIndex={0}
            onClick={() => !isViewer && setControlsOpen((o) => !o)}
            onKeyDown={(e) => e.key === 'Enter' && !isViewer && setControlsOpen((o) => !o)}
          >
            <span className="match-timer__period-label">{periodLabel}</span>
            <span className={timerDisplayClass}>
              {currentMatch.inBreak
                ? (isBreakOvertime ? '+' : '') + formatTime(displayBreakSeconds)
                : (isOvertime && currentMatch.timerCountDown ? '+' : '') + formatTime(displaySeconds)
              }
            </span>
            {!isViewer && (
              <button
                className={`match-timer__gear btn btn--ghost${settingsOpen ? ' btn--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setControlsOpen(false); setSettingsOpen(true); }}
              >⚙</button>
            )}
          </div>

          {/* Match progress bar */}
          {totalMatchDuration > 0 && (
            <div className="match-progress-bar">
              {progressSegments.map((seg, i) => {
                const fillPct = Math.min(100, Math.max(0, (absolutePosition - seg.start) / seg.duration) * 100);
                return (
                  <div
                    key={i}
                    className={`match-progress-bar__segment match-progress-bar__segment--${seg.type}`}
                    style={{ flex: seg.duration }}
                  >
                    <div className="match-progress-bar__fill" style={{ width: `${fillPct}%` }} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Collapsible controls drawer */}
          {controlsOpen && !isViewer && (
            <div className="match-timer__drawer">
              {currentMatch.inBreak ? (
                <>
                  <button
                    className={`btn match-timer__drawer-btn match-timer__drawer-btn--icon ${currentMatch.breakRunning ? 'btn--danger' : 'btn--primary'}`}
                    title={currentMatch.breakRunning ? 'Pauzeer rust' : 'Hervat rust'}
                    onClick={() => { dispatch({ type: currentMatch.breakRunning ? 'PAUSE_BREAK' : 'RESUME_BREAK' }); setControlsOpen(false); }}
                  >
                    {currentMatch.breakRunning ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <rect x="5" y="4" width="4" height="16" rx="1" />
                        <rect x="15" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <polygon points="5,3 21,12 5,21" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="btn btn--secondary match-timer__drawer-btn match-timer__drawer-btn--icon"
                    title={`${nextPeriodLabel} starten`}
                    onClick={() => { dispatch({ type: 'START_NEXT_PERIOD' }); setControlsOpen(false); }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="5" y1="3" x2="5" y2="21" />
                      <path d="M5 3 L19 9 L5 15 Z" fill="currentColor" stroke="none" />
                    </svg>
                  </button>
                </>
              ) : isMatchOver ? null : (
                <>
                  <button
                    className={`btn match-timer__drawer-btn match-timer__drawer-btn--icon ${currentMatch.timerRunning ? 'btn--danger' : 'btn--primary'}`}
                    title={currentMatch.timerRunning ? 'Pauzeer' : 'Hervat'}
                    onClick={() => { dispatch({ type: currentMatch.timerRunning ? 'STOP_TIMER' : 'START_TIMER' }); setControlsOpen(false); }}
                  >
                    {currentMatch.timerRunning ? (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <rect x="5" y="4" width="4" height="16" rx="1" />
                        <rect x="15" y="4" width="4" height="16" rx="1" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                        <polygon points="5,3 21,12 5,21" />
                      </svg>
                    )}
                  </button>
                  <button
                    className="btn btn--secondary match-timer__drawer-btn match-timer__drawer-btn--icon"
                    title={endPeriodLabel}
                    onClick={() => {
                      if (isLastPeriod) {
                        dispatch({ type: 'STOP_TIMER' });
                      } else {
                        dispatch({ type: 'END_PERIOD' });
                      }
                      setControlsOpen(false);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="5" y1="3" x2="5" y2="21" />
                      <path d="M5 3 L19 9 L5 15 Z" fill="currentColor" stroke="none" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Score row */}
          {!isViewer && (
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
          )}

          {/* Viewer: period + time only */}
          {isViewer && (
            <div className="match-timer__row match-timer__row--viewer">
              <span className="match-timer__viewer-period">{periodLabel}</span>
              <div className={`match-timer__display${(isOvertime || isBreakOvertime) ? ' match-timer__display--overtime' : ''}`}>
                {currentMatch.inBreak
                  ? (isBreakOvertime ? '+' : '') + formatTime(displayBreakSeconds)
                  : (isOvertime && currentMatch.timerCountDown ? '+' : '') + formatTime(displaySeconds)
                }
              </div>
              <div className="match-timer__viewer-score">
                <span className="match-score__value">{currentMatch.homeScore}</span>
                <span className="match-timer__viewer-sep">–</span>
                <span className="match-score__value">{currentMatch.awayScore}</span>
              </div>
            </div>
          )}
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
              selectedPositionId={selectedPlayer?.type === 'field' ? selectedPlayer.positionId : null}
              onPositionClick={!isViewer ? handlePositionClick : undefined}
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
                    isSelected={selectedPlayer?.type === 'bench' && selectedPlayer.playerId === p.id}
                    onClick={!isViewer ? () => handleBenchClick(p.id) : undefined}
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
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal__header">
              <span className="settings-modal__header-title">Resetten</span>
              <button className="settings-modal__close-x" onClick={() => setSettingsOpen(false)}>✕</button>
            </div>
            <div className="settings-modal__body">
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
                  const original = getInitialLineup(currentMatch.substitutions, currentMatch.lineup);
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
            </div>
          </div>
        </div>
      )}

      <DragOverlay>
        {activePlayer && (
          <div className="bench-chip-wrapper bench-chip-wrapper--overlay">
            <PlayerChip
              player={activePlayer}
              draggableId={`overlay-${activePlayer.id}`}
              size="medium"
              isOverlay
              subCount={subCounts.get(activePlayer.id) ?? 0}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
