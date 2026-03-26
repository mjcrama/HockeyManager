import { useDroppable } from '@dnd-kit/core';
import { PlayerChip } from './PlayerChip';
import type { Player } from '../types';

function BenchEmptySlot() {
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

function BenchPlayerSlot({ player }: { player: Player }) {
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

interface BenchProps {
  players: Player[];
  title?: string;
  showEmptySlot?: boolean;
}

export function Bench({ players, title = 'Bank', showEmptySlot = false }: BenchProps) {
  return (
    <div className="bench">
      <h3 className="bench__title">{title}</h3>
      <div className="bench__players">
        {showEmptySlot && <BenchEmptySlot />}
        {players.length === 0 && !showEmptySlot && (
          <p className="bench__empty">Geen beschikbare spelers</p>
        )}
        {players.map((player) => (
          <BenchPlayerSlot key={player.id} player={player} />
        ))}
      </div>
    </div>
  );
}
