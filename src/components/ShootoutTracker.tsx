import { useState } from 'react';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';
import { useScrollLock } from '../hooks/useScrollLock';
import { getPositions } from '../data/formations';
import type { Player, ShootoutEntry } from '../types';

type SortKey = 'attempts' | 'goals' | 'missed' | 'name';

/** Strictly pick from the available players who have taken the fewest shootouts. */
function pickFairest(availablePlayers: Player[], shootouts: ShootoutEntry[]): Player {
  const attempts = (p: Player) => shootouts.filter((s) => s.playerId === p.id).length;
  const minCount  = Math.min(...availablePlayers.map(attempts));
  const eligible  = availablePlayers.filter((p) => attempts(p) === minCount);
  return eligible[Math.floor(Math.random() * eligible.length)];
}

export function ShootoutTracker() {
  const { players, currentMatch } = useAppState();
  const dispatch = useAppDispatch();
  const { isViewer } = useTeam();
  const [nextShooterId, setNextShooterId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('attempts');
  const [resetArmed, setResetArmed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useScrollLock(pickerOpen);

  const shootouts = currentMatch.shootouts ?? [];

  // Per-player stats
  const statsMap = new Map<string, { attempts: number; goals: number }>();
  for (const s of shootouts) {
    const prev = statsMap.get(s.playerId) ?? { attempts: 0, goals: 0 };
    statsMap.set(s.playerId, {
      attempts: prev.attempts + 1,
      goals:    prev.goals + (s.scored ? 1 : 0),
    });
  }

  const stats = (p: Player) => statsMap.get(p.id) ?? { attempts: 0, goals: 0 };

  // Find the player currently assigned to the GK position
  const positions = getPositions(currentMatch.playerCount, currentMatch.formation);
  const gkPositionId = positions.find((p) => p.label === 'GK')?.id ?? null;
  const gkPlayerId = gkPositionId
    ? (currentMatch.lineup.find((e) => e.positionId === gkPositionId)?.playerId ?? null)
    : null;

  // Only available non-GK players are eligible for the picker
  const availablePlayers = players.filter((p) => p.available && p.id !== gkPlayerId);
  const nextShooter      = nextShooterId ? players.find((p) => p.id === nextShooterId) ?? null : null;

  const totalAttempts = shootouts.length;
  const totalGoals    = shootouts.filter((s) => s.scored).length;

  // Min attempts among available players (for "next up" badge)
  const minAttempts = availablePlayers.length
    ? Math.min(...availablePlayers.map((p) => stats(p).attempts))
    : 0;

  function handlePickRandom() {
    if (!availablePlayers.length) return;
    const picked = pickFairest(availablePlayers, shootouts);
    setNextShooterId(picked.id);
    setPickerOpen(true);
  }

  function addAttempt(playerId: string, scored: boolean) {
    dispatch({ type: 'ADD_SHOOTOUT', payload: { playerId, scored } });
    setNextShooterId(null);
    setPickerOpen(false);
  }

  function undoLast(playerId: string) {
    dispatch({ type: 'UNDO_LAST_SHOOTOUT', payload: { playerId } });
  }

  function handleReset() {
    if (resetArmed) {
      dispatch({ type: 'RESET_SHOOTOUTS' });
      setNextShooterId(null);
      setResetArmed(false);
    } else {
      setResetArmed(true);
      setTimeout(() => setResetArmed(false), 2000);
    }
  }

  const sorted = [...players].sort((a, b) => {
    const sa = stats(a);
    const sb = stats(b);
    switch (sortKey) {
      case 'goals':    return sb.goals   - sa.goals   || a.name.localeCompare(b.name);
      case 'missed':   return (sb.attempts - sb.goals) - (sa.attempts - sa.goals) || a.name.localeCompare(b.name);
      case 'name':     return a.name.localeCompare(b.name);
      case 'attempts':
      default:         return sb.attempts - sa.attempts || a.name.localeCompare(b.name);
    }
  });

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'attempts', label: 'Genomen' },
    { key: 'goals',    label: 'Gescoord' },
    { key: 'missed',   label: 'Gemist' },
    { key: 'name',     label: 'Naam' },
  ];

  return (
    <div className="shootout-tracker">

      {/* Stats summary + reset */}
      {!isViewer && totalAttempts > 0 && (
        <div className="shootout-summary">
          <span className="shootout-summary__score">
            {totalGoals}/{totalAttempts} gescoord
            <span className="shootout-picker__pct"> ({Math.round((totalGoals / totalAttempts) * 100)}%)</span>
          </span>
          <button
            className={`btn shootout-reset${resetArmed ? ' shootout-reset--armed' : ''}`}
            onClick={handleReset}
            title={resetArmed ? 'Nogmaals klikken om te bevestigen' : 'Alle shootouts resetten'}
          >
            {resetArmed ? 'Zeker?' : '↺ Reset'}
          </button>
        </div>
      )}

      {/* Sort controls + random button */}
      {players.length > 0 && (
        <div className="shootout-controls">
          <span className="shootout-sort__label">Sorteer op:</span>
          <div className="shootout-controls__row">
            <div className="shootout-sort__options">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  className={`control-btn${sortKey === opt.key ? ' control-btn--active' : ''}`}
                  onClick={() => setSortKey(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {!isViewer && (
              <button
                className="btn btn--primary shootout-random-btn"
                onClick={handlePickRandom}
                disabled={!availablePlayers.length}
              >
                🎲<span className="shootout-random-btn__label"> Kies random</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Random picker modal */}
      {pickerOpen && nextShooter && (
        <div className="settings-modal-overlay" onClick={() => setPickerOpen(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-modal__header">
              <span className="settings-modal__header-title">Random shootout speler</span>
              <button className="settings-modal__close-x" onClick={() => setPickerOpen(false)}>✕</button>
            </div>
            <div className="settings-modal__body">
              <div className="shootout-picker__player">
                <div className="shootout-picker__player-info">
                  <span className="shootout-picker__jersey">#{nextShooter.jerseyNumber}</span>
                  <span className="shootout-picker__name">{nextShooter.name}</span>
                  {(() => {
                    const s = stats(nextShooter);
                    return s.attempts > 0 ? (
                      <span className="shootout-picker__prev">({s.goals}/{s.attempts} eerder)</span>
                    ) : (
                      <span className="shootout-picker__prev shootout-picker__prev--new">nog niet genomen</span>
                    );
                  })()}
                </div>
                <div className="shootout-picker__shot-actions">
                  <button className="btn btn--ghost btn--lg" onClick={() => addAttempt(nextShooter.id, false)}>
                    Gemist
                  </button>
                  <button className="btn btn--primary btn--lg" onClick={() => addAttempt(nextShooter.id, true)}>
                    Goal
                  </button>
                </div>
              </div>
              <div className="shootout-picker__modal-footer">
                <button
                  className="btn btn--ghost btn--lg btn--fullwidth"
                  onClick={handlePickRandom}
                  disabled={!availablePlayers.length}
                >
                  🎲 Kies opnieuw
                </button>
                {availablePlayers.length > 0 && (
                  <p className="shootout-picker__hint">
                    Kiest uit {availablePlayers.filter((p) => stats(p).attempts === minAttempts).length} speler(s)
                    met het minste aantal pogingen ({minAttempts}×)
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player list */}
      {players.length === 0 ? (
        <div className="shootout-empty">Geen spelers in de selectie.</div>
      ) : (
        <div className="shootout-list">
          {sorted.map((player) => {
            const s      = stats(player);
            const missed = s.attempts - s.goals;
            const isNext = player.id === nextShooterId;
            const isEligible = player.available && s.attempts === minAttempts;

            return (
              <div
                key={player.id}
                className={[
                  'shootout-row',
                  isNext            ? 'shootout-row--next'        : '',
                  !player.available ? 'shootout-row--unavailable' : '',
                ].filter(Boolean).join(' ')}
              >
                <div className="shootout-row__info">
                  <span className="shootout-row__jersey">#{player.jerseyNumber}</span>
                  <span className="shootout-row__name">{player.name}</span>
                  {isEligible && !isNext && (
                    <span className="shootout-row__eligible" title="In aanmerking voor volgende beurt">●</span>
                  )}
                </div>

                <div className="shootout-row__stats">
                  {s.attempts > 0 ? (
                    <>
                      <span className="shootout-row__count">{s.attempts}×</span>
                      <span className="shootout-row__goals">{s.goals} ✓</span>
                      <span className="shootout-row__missed">{missed} ✗</span>
                    </>
                  ) : (
                    <span className="shootout-row__stats--none">—</span>
                  )}
                </div>

                <div className="shootout-row__dots">
                  {Array.from({ length: s.attempts }).map((_, i) => (
                    <span
                      key={i}
                      className={`shootout-dot${i < s.goals ? ' shootout-dot--goal' : ' shootout-dot--miss'}`}
                    />
                  ))}
                </div>

                {!isViewer && (
                  <div className="shootout-row__actions">
                    {s.attempts > 0 && (
                      <button
                        className="btn btn--icon btn--md"
                        onClick={() => undoLast(player.id)}
                        title="Laatste poging ongedaan maken"
                      >
                        ↩
                      </button>
                    )}
                    <button
                      className="btn btn--ghost btn--md"
                      onClick={() => addAttempt(player.id, false)}
                      disabled={!player.available}
                    >
                      Gemist
                    </button>
                    <button
                      className="btn btn--primary btn--md"
                      onClick={() => addAttempt(player.id, true)}
                      disabled={!player.available}
                    >
                      Goal
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
