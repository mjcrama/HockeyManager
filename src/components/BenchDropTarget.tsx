import React from 'react';
import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';

interface BenchEmptySlotProps {
  dropId: string;
}

export function BenchEmptySlot({ dropId }: BenchEmptySlotProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { isEmptySlot: true },
  });

  return (
    <div
      ref={setNodeRef}
      className={['bench-empty-slot', isOver ? 'bench-empty-slot--over' : ''].join(' ').trim()}
    />
  );
}

interface BenchPlayerDropTargetProps {
  dropId: string;
  benchPlayerId: string;
  isSelected?: boolean;
  isSubbedOff?: boolean;
  isAdvisorTarget?: boolean;
  isInjured?: boolean;
  onClick?: () => void;
  children: ReactNode;
}

export function BenchPlayerDropTarget({
  dropId,
  benchPlayerId,
  isSelected = false,
  isSubbedOff = false,
  isAdvisorTarget = false,
  isInjured = false,
  onClick,
  children,
}: BenchPlayerDropTargetProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId,
    data: { isBenchPlayer: true, benchPlayerId },
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        isSubbedOff ? 'bench-chip-wrapper bench-chip-wrapper--subbed' : 'bench-chip-wrapper',
        isOver ? 'bench-chip-wrapper--drop-over' : '',
        isSelected ? 'bench-chip-wrapper--selected' : '',
        isAdvisorTarget && !isSelected ? 'bench-chip-wrapper--advisor' : '',
        isInjured ? 'bench-chip-wrapper--injured' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick ? (e: React.MouseEvent) => { e.stopPropagation(); onClick(); } : undefined}
    >
      {children}
    </div>
  );
}
