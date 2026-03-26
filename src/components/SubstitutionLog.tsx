import React from 'react';
import type { Substitution, Player } from '../types';

interface SubstitutionLogProps {
  substitutions: Substitution[];
  players: Player[];
}

function formatMinute(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}'${s > 0 ? String(s).padStart(2, '0') + '"' : ''}`;
}

export function SubstitutionLog({ substitutions, players }: SubstitutionLogProps) {
  const playerMap = React.useMemo(() => {
    const map = new Map<string, Player>();
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [players]);

  if (substitutions.length === 0) {
    return (
      <div className="sub-log">
        <h3 className="sub-log__title">Wissellog</h3>
        <p className="sub-log__empty">Nog geen wissels gemaakt</p>
      </div>
    );
  }

  return (
    <div className="sub-log">
      <h3 className="sub-log__title">Wissellog</h3>
      <ul className="sub-log__list">
        {[...substitutions].reverse().map((sub) => {
          const playerOn = playerMap.get(sub.playerOnId);
          const playerOff = playerMap.get(sub.playerOffId);
          return (
            <li key={sub.id} className="sub-log__item">
              <span className="sub-log__minute">{formatMinute(sub.minute)}</span>
              <span className="sub-log__on">
                <span className="sub-log__arrow sub-log__arrow--on">▲</span>
                {playerOn ? `#${playerOn.jerseyNumber} ${playerOn.name}` : 'Onbekend'}
              </span>
              <span className="sub-log__off">
                <span className="sub-log__arrow sub-log__arrow--off">▼</span>
                {playerOff ? `#${playerOff.jerseyNumber} ${playerOff.name}` : 'Onbekend'}
              </span>
              <span className="sub-log__position">({sub.positionId})</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
