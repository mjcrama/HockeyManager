import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import type { Player } from '../types';

interface PlayerChipProps {
  player: Player;
  draggableId: string;
  size?: 'small' | 'medium' | 'large';
  isOnField?: boolean;
  isOverlay?: boolean;
  subCount?: number;
  onClick?: () => void;
}

export function PlayerChip({
  player,
  draggableId,
  size = 'medium',
  isOnField = false,
  isOverlay = false,
  subCount = 0,
  onClick,
}: PlayerChipProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: draggableId,
    data: { playerId: player.id, isOnField },
  });

  const style: React.CSSProperties = {
    // No transform here — DragOverlay handles the moving visual
    opacity: isDragging ? 0 : 1,
    cursor: 'grab',
    position: 'relative',
    touchAction: 'none',
  };

  if (isOverlay) {
    return (
      <div className={[
        'player-chip',
        `player-chip--${size}`,
        isOnField ? 'player-chip--on-field' : '',
        'player-chip--overlay',
      ].filter(Boolean).join(' ')}>
        <span className="player-chip__number">#{player.jerseyNumber}</span>
        <span className="player-chip__name">{player.name}</span>
        {subCount > 0 && (
          <span className="player-chip__sub-count">{subCount}↕</span>
        )}
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`player-chip player-chip--${size}${isOnField ? ' player-chip--on-field' : ''}`}
      {...listeners}
      {...attributes}
      onClick={onClick}
    >
      <span className="player-chip__number">#{player.jerseyNumber}</span>
      <span className="player-chip__name">{player.name}</span>
      {subCount > 0 && (
        <span className="player-chip__sub-count" title={`${subCount} substitution${subCount > 1 ? 's' : ''}`}>
          {subCount}↕
        </span>
      )}
    </div>
  );
}
