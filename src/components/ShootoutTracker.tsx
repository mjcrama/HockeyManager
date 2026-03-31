import { useState } from 'react';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';
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
  }

  function addAttempt(playerId: string, scored: boolean) {
    dispatch({ type: 'ADD_SHOOTOUT', payload: { playerId, scored } });
    if (nextShooterId === playerId) setNextShooterId(null);
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

      {/* Random picker — alleen voor coach */}
      {!isViewer && <div className="shootout-picker">
        <div className="shootout-picker__header">
          <span className="shootout-picker__label">Volgende schutter</span>
          <div className="shootout-picker__header-right">
            {totalAttempts > 0 && (
              <span className="shootout-picker__summary">
                {totalGoals}/{totalAttempts} gescoord
                <span className="shootout-picker__pct">
                  {' '}({Math.round((totalGoals / totalAttempts) * 100)}%)
                </span>
              </span>
            )}
            {!isViewer && totalAttempts > 0 && (
              <button
                className={`btn btn--sm shootout-reset${resetArmed ? ' shootout-reset--armed' : ''}`}
                onClick={handleReset}
                title={resetArmed ? 'Nogmaals klikken om te bevestigen' : 'Alle shootouts resetten'}
              >
                {resetArmed ? 'Zeker?' : '↺ Reset'}
              </button>
            )}
          </div>
        </div>

        <div className="shootout-picker__body">
          {nextShooter ? (
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
              {!isViewer && (
                <div className="shootout-picker__shot-actions">
                  <button
                    className="btn btn--ghost"
                    onClick={() => addAttempt(nextShooter.id, false)}
                  >
                    Gemist
                  </button>
                  <button
                    className="btn btn--primary"
                    onClick={() => addAttempt(nextShooter.id, true)}
                  >
                    Goal
                  </button>
                </div>
              )}
            </div>
          ) : (
            <span className="shootout-picker__empty">—</span>
          )}
          {!isViewer && (
            <button
              className="btn btn--primary"
              onClick={handlePickRandom}
              disabled={!availablePlayers.length}
            >
              🎲 Kies random
            </button>
          )}
        </div>

        {availablePlayers.length > 0 && (
          <p className="shootout-picker__hint">
            Kiest uit {availablePlayers.filter((p) => stats(p).attempts === minAttempts).length} speler(s)
            met het minste aantal pogingen ({minAttempts}×)
          </p>
        )}
      </div>}

      {/* Sort controls */}
      {players.length > 0 && (
        <div className="shootout-sort">
          <span className="shootout-sort__label">Sorteer op:</span>
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
            // Mark players eligible for next pick
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
                        className="btn btn--icon btn--sm"
                        onClick={() => undoLast(player.id)}
                        title="Laatste poging ongedaan maken"
                      >
                        ↩
                      </button>
                    )}
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={() => addAttempt(player.id, false)}
                      disabled={!player.available}
                    >
                      Gemist
                    </button>
                    <button
                      className="btn btn--primary btn--sm"
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
