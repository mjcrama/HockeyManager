import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useScrollLock } from '../hooks/useScrollLock';
import { useMatchTimer, formatTime } from '../hooks/useMatchTimer';
import { Modal } from './Modal';
import { getBestPositionForBenchPlayer } from '../utils/substitutionAdvisor';
import type { AdvisorInput } from '../utils/substitutionAdvisor';
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';
import { BenchEmptySlot, BenchPlayerDropTarget } from './BenchDropTarget';
import { FieldCanvas } from './FieldCanvas';
import { PlayerChip } from './PlayerChip';
import {
  getDragEndIntent,
  getBenchClickIntent,
  getPositionClickIntent,
  type DragData,
  type DropData,
  type SelectedPlayer,
} from './selectionIntents';
import { TacticsBoard } from './TacticsBoard';
import { getPositions } from '../data/formations';
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
  return (
    <BenchPlayerDropTarget
      dropId={`matchday-bench-drop-${player.id}`}
      benchPlayerId={player.id}
      isSelected={isSelected}
      isSubbedOff={subbedOff}
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
    </BenchPlayerDropTarget>
  );
}

export function MatchDay() {
  const { players, currentMatch } = useAppState();
  const dispatch = useAppDispatch();
  const { isViewer } = useTeam();
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<SelectedPlayer>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [tacticsOpen,  setTacticsOpen]  = useState(false);
  useScrollLock(tacticsOpen);
  const [benchEntryMap, setBenchEntryMap] = useState<Record<string, number>>({});

  const drawerRef = useRef<HTMLDivElement>(null);

  const timer = useMatchTimer(currentMatch);
  const {
    currentSeconds, isOvertime, isBreakOvertime, isMatchOver, isLastPeriod, isPaused,
    periodLabel, nextPeriodLabel, endPeriodLabel,
    progressSegments, totalMatchDuration, absolutePosition,
  } = timer;

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

  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor   = useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } });
  const sensors = useSensors(...(isViewer ? [] : [pointerSensor, touchSensor]));

  const positions = getPositions(currentMatch.playerCount, currentMatch.formation);

  const onFieldIds = new Set(
    currentMatch.lineup.filter((e) => e.playerId !== null).map((e) => e.playerId as string)
  );

  const substitutedOffIds = new Set(currentMatch.substitutions.map((s) => s.playerOffId));

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

  // ── Substitution Advisor (field highlight only) ──
  const advisorInput = useMemo<AdvisorInput | null>(() => {
    if (!benchPlayers.length) return null;
    const fieldEntries = currentMatch.lineup
      .filter((e) => e.playerId && onFieldIds.has(e.playerId))
      .map((e) => {
        const pos = positions.find((p) => p.id === e.positionId);
        const pl = players.find((p) => p.id === e.playerId);
        return {
          positionId: e.positionId,
          positionLabel: pos?.label ?? '',
          playerId: e.playerId!,
          playerName: pl?.name ?? '',
          playerJersey: pl?.jerseyNumber ?? 0,
        };
      });
    if (!fieldEntries.length) return null;
    return {
      benchPlayers: benchPlayers.map((p) => ({
        id: p.id, name: p.name, jerseyNumber: p.jerseyNumber,
        preferredPositions: p.preferredPositions as string[],
      })),
      fieldEntries,
      currentSeconds,
      substitutions: currentMatch.substitutions,
      subCounts,
      benchEntryMap,
    };
  }, [benchPlayers, currentMatch.lineup, currentMatch.substitutions, currentSeconds, subCounts, benchEntryMap, positions, players, onFieldIds]);

  // When a bench player is selected or dragged, find the best field position for the pulse highlight
  const advisorPlayerId = selectedPlayer?.type === 'bench'
    ? selectedPlayer.playerId
    : activePlayerId && !onFieldIds.has(activePlayerId)
      ? activePlayerId
      : null;

  const advisorPositionId = useMemo(() => {
    if (!advisorPlayerId || !advisorInput) return null;
    return getBestPositionForBenchPlayer(advisorPlayerId, advisorInput);
  }, [advisorPlayerId, advisorInput]);

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
    const intent = getPositionClickIntent(selectedPlayer, positionId, playerId);
    if (intent.type === 'select-field') {
      setSelectedPlayer(intent.selection);
      return;
    }
    if (intent.type === 'clear-selection') {
      setSelectedPlayer(null);
      return;
    }
    if (intent.type === 'swap-fields') {
      // Field → Field: swap positions (no substitution)
      const newLineup = currentMatch.lineup.map((e) => {
        if (e.positionId === positionId) return { ...e, playerId: intent.sourcePlayerId };
        if (e.positionId === intent.sourcePositionId) return { ...e, playerId };
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
          playerOnId: intent.benchPlayerId,
          playerOffId: playerId,
          positionId,
          minute: currentSeconds,
          timestamp: Date.now(),
        },
      });
    } else {
      dispatch({ type: 'ASSIGN_PLAYER_TO_POSITION', payload: { positionId, playerId: intent.benchPlayerId } });
    }
    setSelectedPlayer(null);
  }

  function handleBenchClick(playerId: string) {
    if (isViewer) return;
    const intent = getBenchClickIntent(selectedPlayer, playerId);
    if (intent.type === 'select-bench') {
      setSelectedPlayer(intent.selection);
      return;
    }
    if (intent.type === 'clear-selection') {
      setSelectedPlayer(null);
      return;
    }
    if (intent.type === 'reselect-bench') {
      setSelectedPlayer({ type: 'bench', playerId: intent.playerId });
      return;
    }
    // Field position selected → substitute or assign
    if (intent.sourcePlayerId) {
      dispatch({
        type: 'ADD_SUBSTITUTION',
        payload: {
          playerOnId: playerId,
          playerOffId: intent.sourcePlayerId,
          positionId: intent.sourcePositionId,
          minute: currentSeconds,
          timestamp: Date.now(),
        },
      });
    } else {
      dispatch({ type: 'ASSIGN_PLAYER_TO_POSITION', payload: { positionId: intent.sourcePositionId, playerId } });
    }
    setSelectedPlayer(null);
  }

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActivePlayerId(null);
      if (isViewer) return;
      const { active, over } = event;
      if (!over) return;

      const dragData = active.data.current as DragData | undefined;
      const dropData = over.data.current as DropData;
      const intent = getDragEndIntent(dragData, dropData);

      if (intent.type === 'none' || intent.type === 'bench-to-bench-player') return;

      if (intent.type === 'field-to-empty-bench') {
        dispatch({
          type: 'UPDATE_LINEUP',
          payload: currentMatch.lineup.map((e) =>
            e.playerId === intent.playerId ? { ...e, playerId: null } : e
          ),
        });
        return;
      }

      if (intent.type === 'field-to-bench-player') {
        dispatch({
          type: 'ADD_SUBSTITUTION',
          payload: {
            playerOnId: intent.benchPlayerId,
            playerOffId: intent.playerId,
            positionId: intent.sourcePositionId,
            minute: currentSeconds,
            timestamp: Date.now(),
          },
        });
        return;
      }

      if (intent.type === 'field-to-field') {
        dispatch({
          type: 'UPDATE_LINEUP',
          payload: currentMatch.lineup.map((e) => {
            if (e.positionId === intent.targetPositionId) return { ...e, playerId: intent.playerId };
            if (e.positionId === intent.sourcePositionId) return { ...e, playerId: intent.currentAtTarget };
            return e;
          }),
        });
        return;
      }

      if (intent.type === 'bench-to-empty-position') {
        dispatch({
          type: 'ASSIGN_PLAYER_TO_POSITION',
          payload: { positionId: intent.targetPositionId, playerId: intent.playerId },
        });
        return;
      }

      if (intent.type === 'bench-to-occupied-position') {
        dispatch({
          type: 'ADD_SUBSTITUTION',
          payload: {
            playerOnId: intent.playerId,
            playerOffId: intent.currentAtTarget,
            positionId: intent.targetPositionId,
            minute: currentSeconds,
            timestamp: Date.now(),
          },
        });
        return;
      }
    },
    [currentMatch.lineup, currentSeconds, dispatch]
  );

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
              {currentMatch.inBreak ? timer.displayBreakTime : timer.displayTime}
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
                {currentMatch.inBreak ? timer.displayBreakTime : timer.displayTime}
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
              subCounts={subCounts}
              preferredPositionLabels={preferredPositionLabels}
              className="match-day__canvas"
              selectedPositionId={selectedPlayer?.type === 'field' ? selectedPlayer.positionId : null}
              onPositionClick={!isViewer ? handlePositionClick : undefined}
              onTacticsClick={!isViewer ? () => setTacticsOpen(true) : undefined}
              advisorPositionId={advisorPositionId}
            />
          </div>

          <div className="match-day__sidebar">
            <div className="match-day__bench">
              <div className="match-day__bench-header">
                <h3 className="match-day__bench-title">Bank ({benchPlayers.length})</h3>
              </div>
              <div className="match-day__bench-players">
                {isDraggingFieldPlayer && <BenchEmptySlot dropId="matchday-bench-empty" />}
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

      {tacticsOpen && (
        <TacticsBoard
          positions={positions}
          lineup={currentMatch.lineup}
          players={players}
          fieldSize={currentMatch.fieldSize}
          onClose={() => setTacticsOpen(false)}
        />
      )}

      {settingsOpen && (
        <Modal title="Resetten" onClose={() => setSettingsOpen(false)}>
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
        </Modal>
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
