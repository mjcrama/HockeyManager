import type { FieldPositionConfig, PlayerCount } from '../types';

// ── 11v11  O12+ — portrait, GK bottom (y≈92), FWD top (y≈28) ────────────────
export const POSITIONS_11: Record<string, FieldPositionConfig[]> = {
  '4-3-3': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 18, y: 72 },
    { id: 'CB1', label: 'CB', x: 38, y: 76 },
    { id: 'CB2', label: 'CB', x: 62, y: 76 },
    { id: 'RB',  label: 'RB', x: 82, y: 72 },
    { id: 'LM',  label: 'LM', x: 22, y: 55 },
    { id: 'CM',  label: 'CM', x: 50, y: 58 },
    { id: 'RM',  label: 'RM', x: 78, y: 55 },
    { id: 'LF',  label: 'LF', x: 26, y: 32 },
    { id: 'CF',  label: 'CF', x: 50, y: 28 },
    { id: 'RF',  label: 'RF', x: 74, y: 32 },
  ],
  '4-4-2': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 18, y: 72 },
    { id: 'CB1', label: 'CB', x: 38, y: 76 },
    { id: 'CB2', label: 'CB', x: 62, y: 76 },
    { id: 'RB',  label: 'RB', x: 82, y: 72 },
    { id: 'LM',  label: 'LM', x: 16, y: 52 },
    { id: 'CM1', label: 'CM', x: 38, y: 55 },
    { id: 'CM2', label: 'CM', x: 62, y: 55 },
    { id: 'RM',  label: 'RM', x: 84, y: 52 },
    { id: 'LF',  label: 'LF', x: 34, y: 28 },
    { id: 'RF',  label: 'RF', x: 66, y: 28 },
  ],
  '3-4-3': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 24, y: 72 },
    { id: 'CB',  label: 'CB', x: 50, y: 76 },
    { id: 'RB',  label: 'RB', x: 76, y: 72 },
    { id: 'LM',  label: 'LM', x: 16, y: 55 },
    { id: 'CM1', label: 'CM', x: 38, y: 58 },
    { id: 'CM2', label: 'CM', x: 62, y: 58 },
    { id: 'RM',  label: 'RM', x: 84, y: 55 },
    { id: 'LF',  label: 'LF', x: 26, y: 32 },
    { id: 'CF',  label: 'CF', x: 50, y: 28 },
    { id: 'RF',  label: 'RF', x: 74, y: 32 },
  ],
};

// ── 9v9  O11 — portrait 3/4 field, GK bottom (y≈92), FWD top (y≈28) ─────────
export const POSITIONS_9: Record<string, FieldPositionConfig[]> = {
  '3-3-2': [
    { id: 'GK', label: 'GK', x: 50, y: 92 },
    { id: 'LB', label: 'LB', x: 24, y: 74 },
    { id: 'CB', label: 'CB', x: 50, y: 78 },
    { id: 'RB', label: 'RB', x: 76, y: 74 },
    { id: 'LM', label: 'LM', x: 26, y: 55 },
    { id: 'CM', label: 'CM', x: 50, y: 59 },
    { id: 'RM', label: 'RM', x: 74, y: 55 },
    { id: 'LF', label: 'LF', x: 34, y: 30 },
    { id: 'RF', label: 'RF', x: 66, y: 30 },
  ],
  '2-4-2': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 28, y: 74 },
    { id: 'RB',  label: 'RB', x: 72, y: 74 },
    { id: 'LM',  label: 'LM', x: 16, y: 55 },
    { id: 'CM1', label: 'CM', x: 38, y: 58 },
    { id: 'CM2', label: 'CM', x: 62, y: 58 },
    { id: 'RM',  label: 'RM', x: 84, y: 55 },
    { id: 'LF',  label: 'LF', x: 34, y: 30 },
    { id: 'RF',  label: 'RF', x: 66, y: 30 },
  ],
  '3-2-3': [
    { id: 'GK', label: 'GK', x: 50, y: 92 },
    { id: 'LB', label: 'LB', x: 24, y: 74 },
    { id: 'CB', label: 'CB', x: 50, y: 78 },
    { id: 'RB', label: 'RB', x: 76, y: 74 },
    { id: 'LM', label: 'LM', x: 30, y: 55 },
    { id: 'RM', label: 'RM', x: 70, y: 55 },
    { id: 'LF', label: 'LF', x: 26, y: 32 },
    { id: 'CF', label: 'CF', x: 50, y: 28 },
    { id: 'RF', label: 'RF', x: 74, y: 32 },
  ],
};

// ── 8v8  O10 — portrait half field (45.7×55m), GK BOTTOM (y≈92), FWD TOP (y≈28)
// The full-field sidelines become the goal lines; played bottom to top.
export const POSITIONS_8: Record<string, FieldPositionConfig[]> = {
  '3-3-1': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 18, y: 70 },
    { id: 'CB',  label: 'CB', x: 50, y: 70 },
    { id: 'RB',  label: 'RB', x: 82, y: 70 },
    { id: 'LM',  label: 'LM', x: 20, y: 50 },
    { id: 'CM',  label: 'CM', x: 50, y: 50 },
    { id: 'RM',  label: 'RM', x: 80, y: 50 },
    { id: 'CF',  label: 'CF', x: 50, y: 28 },
  ],
  '2-3-2': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 30, y: 70 },
    { id: 'RB',  label: 'RB', x: 70, y: 70 },
    { id: 'LM',  label: 'LM', x: 20, y: 50 },
    { id: 'CM',  label: 'CM', x: 50, y: 50 },
    { id: 'RM',  label: 'RM', x: 80, y: 50 },
    { id: 'LF',  label: 'LF', x: 32, y: 28 },
    { id: 'RF',  label: 'RF', x: 68, y: 28 },
  ],
  '2-4-1': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 30, y: 70 },
    { id: 'RB',  label: 'RB', x: 70, y: 70 },
    { id: 'LM',  label: 'LM', x: 16, y: 50 },
    { id: 'CM1', label: 'CM', x: 38, y: 50 },
    { id: 'CM2', label: 'CM', x: 62, y: 50 },
    { id: 'RM',  label: 'RM', x: 84, y: 50 },
    { id: 'CF',  label: 'CF', x: 50, y: 28 },
  ],
  '3-2-2': [
    { id: 'GK',  label: 'GK', x: 50, y: 92 },
    { id: 'LB',  label: 'LB', x: 20, y: 70 },
    { id: 'CB',  label: 'CB', x: 50, y: 70 },
    { id: 'RB',  label: 'RB', x: 80, y: 70 },
    { id: 'LM',  label: 'LM', x: 32, y: 50 },
    { id: 'RM',  label: 'RM', x: 68, y: 50 },
    { id: 'LF',  label: 'LF', x: 32, y: 28 },
    { id: 'RF',  label: 'RF', x: 68, y: 28 },
  ],
};

// ── 6v6  O9 — portrait small field (43×25m), GK bottom, FWD top ──────────────
export const POSITIONS_6: Record<string, FieldPositionConfig[]> = {
  '2-2-1': [
    { id: 'GK', label: 'GK', x: 50, y: 92 },
    { id: 'LB', label: 'LB', x: 28, y: 74 },
    { id: 'RB', label: 'RB', x: 72, y: 74 },
    { id: 'LM', label: 'LM', x: 28, y: 50 },
    { id: 'RM', label: 'RM', x: 72, y: 50 },
    { id: 'CF', label: 'CF', x: 50, y: 24 },
  ],
  '1-3-1': [
    { id: 'GK', label: 'GK', x: 50, y: 92 },
    { id: 'LB', label: 'LB', x: 22, y: 73 },
    { id: 'CB', label: 'CB', x: 50, y: 75 },
    { id: 'RB', label: 'RB', x: 78, y: 73 },
    { id: 'CM', label: 'CM', x: 50, y: 48 },
    { id: 'CF', label: 'CF', x: 50, y: 24 },
  ],
  '2-1-2': [
    { id: 'GK', label: 'GK', x: 50, y: 92 },
    { id: 'LB', label: 'LB', x: 28, y: 74 },
    { id: 'RB', label: 'RB', x: 72, y: 74 },
    { id: 'CM', label: 'CM', x: 50, y: 50 },
    { id: 'LF', label: 'LF', x: 28, y: 24 },
    { id: 'RF', label: 'RF', x: 72, y: 24 },
  ],
};

// ── 3v3  O8 — square mini field (23×23m), NO GK, 3 goals per back line ───────
export const POSITIONS_3: Record<string, FieldPositionConfig[]> = {
  'vrij': [
    // Free formation — 3 players spread evenly
    { id: 'L',  label: 'L',  x: 22, y: 55 },
    { id: 'C',  label: 'C',  x: 50, y: 38 },
    { id: 'R',  label: 'R',  x: 78, y: 55 },
  ],
  'driehoek': [
    { id: 'L',  label: 'L',  x: 25, y: 62 },
    { id: 'R',  label: 'R',  x: 75, y: 62 },
    { id: 'C',  label: 'C',  x: 50, y: 28 },
  ],
};

export const FORMATIONS_BY_COUNT: Record<PlayerCount, Record<string, FieldPositionConfig[]>> = {
  11: POSITIONS_11,
  9:  POSITIONS_9,
  8:  POSITIONS_8,
  6:  POSITIONS_6,
  3:  POSITIONS_3,
};

export const DEFAULT_FORMATIONS: Record<PlayerCount, string> = {
  11: '4-3-3',
  9:  '3-3-2',
  8:  '3-3-1',
  6:  '2-2-1',
  3:  'vrij',
};

export function getPositions(playerCount: PlayerCount, formation: string): FieldPositionConfig[] {
  const formations = FORMATIONS_BY_COUNT[playerCount];
  return formations[formation] ?? formations[DEFAULT_FORMATIONS[playerCount]];
}

// ── Preferred-position matching ───────────────────────────────────────────────
export const POSITION_CATEGORY_MAP: Record<string, string[]> = {
  GK:  ['GK'],
  DEF: ['LB', 'CB', 'CB1', 'CB2', 'RB', 'DEF'],
  MID: ['LM', 'CM', 'CM1', 'CM2', 'RM', 'MID'],
  FWD: ['LF', 'CF', 'RF', 'FWD'],
};

export function matchesPreferred(posLabel: string, preferred: string[]): boolean {
  if (!preferred.length) return false;
  return preferred.some((pp) => {
    if (pp === posLabel) return true;
    if (pp.startsWith(posLabel) || posLabel.startsWith(pp)) return true;
    return (POSITION_CATEGORY_MAP[pp] ?? []).includes(posLabel);
  });
}
