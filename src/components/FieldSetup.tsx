import { useState, useRef } from 'react';
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
import { FORMATIONS_BY_COUNT, getPositions, matchesPreferred } from '../data/formations';
import { MATCH_PROFILES } from '../data/matchProfiles';
import type { FieldSize, PlayerCount, Player, MatchProfileKey } from '../types';

function SetupBenchEmptySlot() {
  const { setNodeRef, isOver } = useDroppable({
    id: 'bench-empty',
    data: { isEmptySlot: true },
  });
  return (
    <div
      ref={setNodeRef}
      className={['bench-empty-slot', isOver ? 'bench-empty-slot--over' : ''].join(' ').trim()}
    />
  );
}

function SetupBenchChip({ player }: { player: Player }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `bench-player-${player.id}`,
    data: { isBenchPlayer: true, benchPlayerId: player.id },
  });
  return (
    <div
      ref={setNodeRef}
      className={['bench-chip-wrapper', isOver ? 'bench-chip-wrapper--drop-over' : ''].join(' ').trim()}
    >
      <PlayerChip
        player={player}
        draggableId={`bench-${player.id}`}
        size="medium"
        isOnField={false}
      />
    </div>
  );
}

const FIELD_SIZE_OPTIONS: { value: FieldSize; label: string }[] = [
  { value: 'full',           label: 'Volledig veld (O12+)' },
  { value: 'three-quarter',  label: '¾ veld (O11)'         },
  { value: 'half',           label: 'Half veld (O10)'       },
  { value: 'small',          label: 'Klein veld (O9)'       },
  { value: 'mini',           label: 'Mini veld (O8)'        },
];

const PLAYER_COUNT_OPTIONS: { value: PlayerCount; label: string }[] = [
  { value: 11, label: '11v11 — O12+' },
  { value: 9,  label: '9v9   — O11'  },
  { value: 8,  label: '8v8   — O10'  },
  { value: 6,  label: '6v6   — O9'   },
  { value: 3,  label: '3v3   — O8'   },
];

const PROFILE_KEYS: MatchProfileKey[] = [
  'o8', 'o9', 'o10', 'o11', 'o12', 'o14', 'o16', 'senior', 'zaal', 'custom',
];

function profileChipLabel(key: MatchProfileKey): string {
  if (key === 'custom') return 'Aangepast';
  const p = MATCH_PROFILES[key];
  return `${p.periods}×${p.periodMinutes} +${p.breakMinutes}`;
}

export function FieldSetup() {
  const { players, currentMatch } = useAppState();
  const dispatch = useAppDispatch();
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const [periodInput, setPeriodInput] = useState(String(currentMatch.periods));
  const [durationInput, setDurationInput] = useState(String(Math.round(currentMatch.timerDuration / 60)));
  const [breakInput, setBreakInput] = useState(String(Math.round(currentMatch.breakDuration / 60)));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 250, tolerance: 5 } }),
  );

  const availablePlayers = players.filter((p) => p.available);
  const onFieldIds = new Set(
    currentMatch.lineup.filter((e) => e.playerId !== null).map((e) => e.playerId as string)
  );
  const benchPlayers = availablePlayers.filter((p) => !onFieldIds.has(p.id));
  const unavailablePlayers = players.filter((p) => !p.available);

  const positions = getPositions(currentMatch.playerCount, currentMatch.formation);
  const formationOptions = Object.keys(FORMATIONS_BY_COUNT[currentMatch.playerCount]);

  const activePlayer = activePlayerId ? players.find((p) => p.id === activePlayerId) ?? null : null;
  const preferredPositionLabels = activePlayer ? activePlayer.preferredPositions as string[] : [];
  const isDraggingFieldPlayer = activePlayerId !== null && onFieldIds.has(activePlayerId);

  function handleDragStart(event: DragStartEvent) {
    const { data } = event.active;
    if (data.current?.playerId) {
      setActivePlayerId(data.current.playerId as string);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
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

    // ── Field player → empty bench slot: remove from field ───────────────
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

    // ── Field player → bench player: swap ────────────────────────────────
    if (dropData && 'isBenchPlayer' in dropData) {
      if (dragData.isOnField && dragData.sourcePositionId) {
        dispatch({
          type: 'UPDATE_LINEUP',
          payload: currentMatch.lineup.map((e) =>
            e.positionId === dragData.sourcePositionId
              ? { ...e, playerId: dropData.benchPlayerId }
              : e
          ),
        });
      }
      return;
    }

    // ── Drop onto a field position ───────────────────────────────────────
    if (dropData && 'isPosition' in dropData && dropData.isPosition) {
      const targetPositionId = dropData.positionId;
      const currentAtTarget = dropData.currentPlayerId ?? null;

      // Dragging from one field position to another → swap
      if (dragData.isOnField && dragData.sourcePositionId) {
        const srcId = dragData.sourcePositionId;
        if (srcId === targetPositionId) return; // dropped on itself
        const newLineup = currentMatch.lineup.map((entry) => {
          if (entry.positionId === targetPositionId) return { ...entry, playerId };
          if (entry.positionId === srcId) return { ...entry, playerId: currentAtTarget };
          return entry;
        });
        dispatch({ type: 'UPDATE_LINEUP', payload: newLineup });
        return;
      }

      // Dragging from bench → field position (occupied or empty)
      // ASSIGN_PLAYER_TO_POSITION removes player from any slot and places at target;
      // the displaced player's slot becomes null → they return to bench naturally.
      dispatch({
        type: 'ASSIGN_PLAYER_TO_POSITION',
        payload: { positionId: targetPositionId, playerId },
      });
    }
  }

  function handleClearAll() {
    const cleared = currentMatch.lineup.map((e) => ({ ...e, playerId: null }));
    dispatch({ type: 'UPDATE_LINEUP', payload: cleared });
  }

  function handleAutoFill() {
    const shuffled = [...benchPlayers].sort(() => Math.random() - 0.5);
    const emptySlots = currentMatch.lineup.filter((e) => !e.playerId);
    const newAssignments = [...currentMatch.lineup];

    const filledPositionIds = new Set<string>();
    const assignedPlayerIds = new Set<string>();

    // Pass 1: place each player on a preferred empty position if available
    for (const player of shuffled) {
      const preferred = player.preferredPositions as string[];
      if (!preferred.length) continue;

      const matchingSlots = emptySlots.filter((slot) => {
        if (filledPositionIds.has(slot.positionId)) return false;
        const posConfig = positions.find((p) => p.id === slot.positionId);
        return posConfig ? matchesPreferred(posConfig.label, preferred) : false;
      });

      if (matchingSlots.length > 0) {
        const chosen = matchingSlots[Math.floor(Math.random() * matchingSlots.length)];
        const idx = newAssignments.findIndex((e) => e.positionId === chosen.positionId);
        if (idx !== -1) {
          newAssignments[idx] = { ...newAssignments[idx], playerId: player.id };
          filledPositionIds.add(chosen.positionId);
          assignedPlayerIds.add(player.id);
        }
      }
    }

    // Pass 2: fill remaining empty slots with unassigned players in random order
    const remainingPlayers = shuffled.filter((p) => !assignedPlayerIds.has(p.id));
    const remainingSlots   = emptySlots.filter((s) => !filledPositionIds.has(s.positionId));

    for (let i = 0; i < remainingSlots.length && i < remainingPlayers.length; i++) {
      const idx = newAssignments.findIndex((e) => e.positionId === remainingSlots[i].positionId);
      if (idx !== -1) {
        newAssignments[idx] = { ...newAssignments[idx], playerId: remainingPlayers[i].id };
      }
    }

    dispatch({ type: 'UPDATE_LINEUP', payload: newAssignments });
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="field-setup">
        {/* Top bar */}
        <div className="field-setup__mobile-bar">
          <span className="field-setup__mobile-info">
            {currentMatch.formation} · {currentMatch.playerCount}v{currentMatch.playerCount}
          </span>
          <div className="field-setup__mobile-actions">
            <button className="btn btn--secondary" onClick={handleAutoFill}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                {/* Wand stick */}
                <line x1="3" y1="21" x2="12" y2="13" strokeWidth="2.5"/>
                {/* 4-pointed star at tip, radius 6, center (14, 9) */}
                <path d="M14 3 L15.7 7.3 L20 9 L15.7 10.7 L14 15 L12.3 10.7 L8 9 L12.3 7.3 Z" fill="currentColor" stroke="none"/>
                {/* Rays outward from star */}
                <line x1="14"  y1="2.5" x2="14"  y2="1"   strokeWidth="1.5"/>
                <line x1="17.5" y1="4.5" x2="19.5" y2="2.5" strokeWidth="1.5"/>
                <line x1="21"  y1="9"   x2="23"  y2="9"   strokeWidth="1.5"/>
                <line x1="10.5" y1="4.5" x2="8.5" y2="2.5" strokeWidth="1.5"/>
              </svg>
              Auto invullen
            </button>
            <button className="btn btn--ghost" onClick={handleClearAll}>Wissen</button>
            <button
              className={`btn btn--ghost field-setup__gear-btn${settingsOpen ? ' btn--active' : ''}`}
              onClick={() => setSettingsOpen(true)}
            >⚙</button>
          </div>
        </div>

        {/* Main layout */}
        <div className="field-setup__main">
          <div className="field-setup__field">
            <FieldCanvas
              positions={positions}
              lineup={currentMatch.lineup}
              players={players}
              fieldSize={currentMatch.fieldSize}
              preferredPositionLabels={preferredPositionLabels}
            />
          </div>

          <div className="field-setup__sidebar">
            <div className="bench">
              <h3 className="bench__title">Bank ({benchPlayers.length})</h3>
              <div className="bench__players">
                {isDraggingFieldPlayer && <SetupBenchEmptySlot />}
                {benchPlayers.length === 0 && !isDraggingFieldPlayer && (
                  <p className="bench__empty">Geen beschikbare spelers</p>
                )}
                {benchPlayers.map((p) => (
                  <SetupBenchChip key={p.id} player={p} />
                ))}
              </div>
              {unavailablePlayers.length > 0 && ( 
                <>
                <h3 className="unavailable__title">Niet Beschikbaar</h3>
                <div className="unavailable__players">
                  {unavailablePlayers.map((p) => (
                    <div key={p.id} className="bench-chip-wrapper bench-chip-wrapper--unavailable">
                      <div className="player-chip player-chip--medium player-chip--unavailable">
                        <span className="player-chip__number">#{p.jerseyNumber}</span>
                        <span className="player-chip__name">{p.name.split(' ')[0]}</span>
                      </div>
                    </div>
                  ))}
                </div>
                </>
                )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activePlayer && (
          <div className="bench-chip-wrapper bench-chip-wrapper--overlay">
            <PlayerChip
              player={activePlayer}
              draggableId={`overlay-${activePlayer.id}`}
              size="medium"
              isOverlay
            />
          </div>
        )}
      </DragOverlay>

      {settingsOpen && (
        <div className="settings-modal-overlay" onClick={() => setSettingsOpen(false)}>
          <div className="settings-modal settings-modal--wide" ref={settingsRef} onClick={(e) => e.stopPropagation()}>
            <p className="settings-modal__title">Opstelling instellingen</p>

            <div className="settings-modal__field">
              <label className="settings-modal__field-label">Veldgrootte</label>
              <div className="timer-settings__row" style={{ flexWrap: 'wrap' }}>
                {FIELD_SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`control-btn${currentMatch.fieldSize === opt.value ? ' control-btn--active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_FIELD_SIZE', payload: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-modal__field">
              <label className="settings-modal__field-label">Aantal spelers</label>
              <div className="timer-settings__row" style={{ flexWrap: 'wrap' }}>
                {PLAYER_COUNT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`control-btn${currentMatch.playerCount === opt.value ? ' control-btn--active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_PLAYER_COUNT', payload: opt.value })}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-modal__field">
              <label className="settings-modal__field-label">Formatie</label>
              <div className="timer-settings__row" style={{ flexWrap: 'wrap' }}>
                {formationOptions.map((f) => (
                  <button
                    key={f}
                    className={`control-btn${currentMatch.formation === f ? ' control-btn--active' : ''}`}
                    onClick={() => dispatch({ type: 'SET_FORMATION', payload: f })}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="timer-settings__divider" />
            <p className="settings-modal__title">Wedstrijdtijden</p>

            <div className="settings-modal__field">
              <div className="timer-settings__row" style={{ flexWrap: 'wrap' }}>
                {PROFILE_KEYS.map((key) => (
                  <button
                    key={key}
                    className={`control-btn${currentMatch.matchProfile === key ? ' control-btn--active' : ''}`}
                    onClick={() => {
                      dispatch({ type: 'SET_MATCH_PROFILE', payload: key });
                      const p = MATCH_PROFILES[key];
                      setPeriodInput(String(p.periods));
                      setDurationInput(String(p.periodMinutes));
                      setBreakInput(String(p.breakMinutes));
                    }}
                  >
                    {profileChipLabel(key)}
                  </button>
                ))}
              </div>
              <div className="match-profile-custom">
                <div className="match-profile-custom__field">
                  <label className="match-profile-custom__label">Periodes</label>
                  <input
                    className="timer-settings__input"
                    type="number" min={1} max={8}
                    value={periodInput}
                    onChange={(e) => setPeriodInput(e.target.value)}
                    onBlur={() => {
                      const v = Math.max(1, Math.min(8, parseInt(periodInput, 10)));
                      if (isNaN(v)) { setPeriodInput(String(currentMatch.periods)); return; }
                      setPeriodInput(String(v));
                      dispatch({ type: 'SET_PERIODS', payload: v });
                    }}
                  />
                </div>
                <div className="match-profile-custom__field">
                  <label className="match-profile-custom__label">Min/periode</label>
                  <input
                    className="timer-settings__input"
                    type="number" min={1} max={90}
                    value={durationInput}
                    onChange={(e) => setDurationInput(e.target.value)}
                    onBlur={() => {
                      const v = Math.max(1, Math.min(90, parseInt(durationInput, 10)));
                      if (isNaN(v)) { setDurationInput(String(Math.round(currentMatch.timerDuration / 60))); return; }
                      setDurationInput(String(v));
                      dispatch({ type: 'SET_TIMER_DURATION', payload: v * 60 });
                    }}
                  />
                </div>
                <div className="match-profile-custom__field">
                  <label className="match-profile-custom__label">Rust (min)</label>
                  <input
                    className="timer-settings__input"
                    type="number" min={0} max={30}
                    value={breakInput}
                    onChange={(e) => setBreakInput(e.target.value)}
                    onBlur={() => {
                      const v = Math.max(0, Math.min(30, parseInt(breakInput, 10)));
                      if (isNaN(v)) { setBreakInput(String(Math.round(currentMatch.breakDuration / 60))); return; }
                      setBreakInput(String(v));
                      dispatch({ type: 'SET_BREAK_DURATION', payload: v * 60 });
                    }}
                  />
                </div>
              </div>
            </div>

            <button className="settings-modal__close" onClick={() => setSettingsOpen(false)}>Sluiten</button>
          </div>
        </div>
      )}
    </DndContext>
  );
}
