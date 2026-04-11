export type SelectedPlayer =
  | { type: 'field'; positionId: string; playerId: string | null }
  | { type: 'bench'; playerId: string }
  | null;

export type PositionClickIntent =
  | { type: 'select-field'; selection: Exclude<SelectedPlayer, null> }
  | { type: 'clear-selection' }
  | { type: 'swap-fields'; sourcePositionId: string; sourcePlayerId: string | null }
  | { type: 'bench-to-position'; benchPlayerId: string };

export function getPositionClickIntent(
  selectedPlayer: SelectedPlayer,
  positionId: string,
  playerId: string | null,
): PositionClickIntent {
  if (!selectedPlayer) {
    return { type: 'select-field', selection: { type: 'field', positionId, playerId } };
  }

  if (selectedPlayer.type === 'field' && selectedPlayer.positionId === positionId) {
    return { type: 'clear-selection' };
  }

  if (selectedPlayer.type === 'field') {
    return {
      type: 'swap-fields',
      sourcePositionId: selectedPlayer.positionId,
      sourcePlayerId: selectedPlayer.playerId,
    };
  }

  return { type: 'bench-to-position', benchPlayerId: selectedPlayer.playerId };
}

export type BenchClickIntent =
  | { type: 'select-bench'; selection: Exclude<SelectedPlayer, null> }
  | { type: 'clear-selection' }
  | { type: 'reselect-bench'; playerId: string }
  | { type: 'field-to-bench'; sourcePositionId: string; sourcePlayerId: string | null };

export function getBenchClickIntent(
  selectedPlayer: SelectedPlayer,
  playerId: string,
): BenchClickIntent {
  if (!selectedPlayer) {
    return { type: 'select-bench', selection: { type: 'bench', playerId } };
  }

  if (selectedPlayer.type === 'bench' && selectedPlayer.playerId === playerId) {
    return { type: 'clear-selection' };
  }

  if (selectedPlayer.type === 'bench') {
    return { type: 'reselect-bench', playerId };
  }

  return {
    type: 'field-to-bench',
    sourcePositionId: selectedPlayer.positionId,
    sourcePlayerId: selectedPlayer.playerId,
  };
}

export interface DragData {
  playerId: string | null;
  isOnField: boolean;
  sourcePositionId?: string;
}

export type DropData =
  | { positionId: string; isPosition: boolean; currentPlayerId?: string | null }
  | { isEmptySlot: true }
  | { isBenchPlayer: true; benchPlayerId: string }
  | undefined;

export type DragEndIntent =
  | { type: 'none' }
  | { type: 'field-to-empty-bench'; playerId: string }
  | { type: 'field-to-bench-player'; playerId: string; sourcePositionId: string; benchPlayerId: string }
  | { type: 'field-to-field'; playerId: string; sourcePositionId: string; targetPositionId: string; currentAtTarget: string | null }
  | { type: 'bench-to-empty-position'; playerId: string; targetPositionId: string }
  | { type: 'bench-to-occupied-position'; playerId: string; targetPositionId: string; currentAtTarget: string }
  | { type: 'bench-to-bench-player'; playerId: string; benchPlayerId: string };

export function getDragEndIntent(dragData: DragData | undefined, dropData: DropData): DragEndIntent {
  if (!dragData?.playerId || !dropData) return { type: 'none' };

  const playerId = dragData.playerId;

  if ('isEmptySlot' in dropData) {
    return dragData.isOnField
      ? { type: 'field-to-empty-bench', playerId }
      : { type: 'none' };
  }

  if ('isBenchPlayer' in dropData) {
    if (dragData.isOnField && dragData.sourcePositionId) {
      return {
        type: 'field-to-bench-player',
        playerId,
        sourcePositionId: dragData.sourcePositionId,
        benchPlayerId: dropData.benchPlayerId,
      };
    }
    return {
      type: 'bench-to-bench-player',
      playerId,
      benchPlayerId: dropData.benchPlayerId,
    };
  }

  if (!dropData.isPosition) return { type: 'none' };

  const targetPositionId = dropData.positionId;
  const currentAtTarget = dropData.currentPlayerId ?? null;

  if (dragData.isOnField && dragData.sourcePositionId) {
    if (dragData.sourcePositionId === targetPositionId) return { type: 'none' };
    return {
      type: 'field-to-field',
      playerId,
      sourcePositionId: dragData.sourcePositionId,
      targetPositionId,
      currentAtTarget,
    };
  }

  if (!currentAtTarget) {
    return { type: 'bench-to-empty-position', playerId, targetPositionId };
  }

  return {
    type: 'bench-to-occupied-position',
    playerId,
    targetPositionId,
    currentAtTarget,
  };
}
