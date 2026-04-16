import { matchesPreferred, POSITION_CATEGORY_MAP } from '../data/formations';

export interface SubstitutionCandidate {
  benchPlayerId: string;
  fieldPlayerId: string;   // '' when isEmptySlot
  positionId: string;
  positionLabel: string;
  score: number;
  reasons: string[];
  fieldTimeSec: number;
  benchTimeSec: number;
  isEmptySlot: boolean;
}

interface BenchPlayer {
  id: string;
  name: string;
  jerseyNumber: number;
  preferredPositions: string[];
}

interface FieldEntry {
  positionId: string;
  positionLabel: string;
  playerId: string;
  playerName: string;
  playerJersey: number;
}

interface EmptyPosition {
  positionId: string;
  positionLabel: string;
}

export interface AdvisorInput {
  benchPlayers: BenchPlayer[];
  fieldEntries: FieldEntry[];
  emptyPositions: EmptyPosition[];
  currentSeconds: number;
  substitutions: { playerOnId: string; playerOffId: string; positionId: string; minute: number }[];
  subCounts: Map<string, number>;
  benchEntryMap: Record<string, number>;
}

/** Get the category (DEF/MID/FWD/GK) for a position label. */
function getCategory(posLabel: string): string | null {
  for (const [cat, labels] of Object.entries(POSITION_CATEGORY_MAP)) {
    if (labels.includes(posLabel)) return cat;
  }
  return null;
}

/** For each field player, compute seconds since they last entered the field. */
function getFieldTime(
  fieldEntries: FieldEntry[],
  substitutions: AdvisorInput['substitutions'],
  currentSeconds: number,
): Map<string, number> {
  const lastOnTime = new Map<string, number>();

  for (const e of fieldEntries) {
    lastOnTime.set(e.playerId, 0);
  }
  for (const s of substitutions) {
    lastOnTime.set(s.playerOnId, s.minute);
  }

  const result = new Map<string, number>();
  for (const e of fieldEntries) {
    const onAt = lastOnTime.get(e.playerId) ?? 0;
    result.set(e.playerId, currentSeconds - onAt);
  }
  return result;
}

export function getSubstitutionAdvice(input: AdvisorInput): SubstitutionCandidate[] {
  const { benchPlayers, fieldEntries, emptyPositions, currentSeconds, substitutions, subCounts, benchEntryMap } = input;

  if (!benchPlayers.length) return [];

  const fieldTimeMap = getFieldTime(fieldEntries, substitutions, currentSeconds);

  const maxFieldTime  = Math.max(...[...fieldTimeMap.values()], 1);
  const maxSubCount   = Math.max(...fieldEntries.map((e) => subCounts.get(e.playerId) ?? 0), 1);
  const benchTimes    = benchPlayers.map((p) => currentSeconds - (benchEntryMap[p.id] ?? 0));
  const maxBenchTime  = Math.max(...benchTimes, 1);

  const candidates: SubstitutionCandidate[] = [];

  for (const bench of benchPlayers) {
    const benchTime  = currentSeconds - (benchEntryMap[bench.id] ?? 0);
    const hasGKPref  = bench.preferredPositions.includes('GK');
    const benchWait  = benchTime / maxBenchTime;

    // ── 1. Empty positions (always preferred over swaps) ──────────────────
    for (const empty of emptyPositions) {
      if (empty.positionLabel === 'GK' && !hasGKPref) continue;

      const posMatch = matchesPreferred(empty.positionLabel, bench.preferredPositions);
      const fieldCat = getCategory(empty.positionLabel);
      const benchCats = bench.preferredPositions.map(getCategory).filter(Boolean);
      const catMatch  = !posMatch && fieldCat && benchCats.includes(fieldCat);

      // Empty slots score 300+ so they always outrank any swap candidate (max ~100)
      const score = 300 + (posMatch ? 50 : catMatch ? 20 : 0) + benchWait * 5;

      const reasons: string[] = ['Lege positie'];
      if (posMatch) reasons.push('Voorkeurspos.');
      else if (catMatch) reasons.push('Zelfde zone');

      candidates.push({
        benchPlayerId: bench.id,
        fieldPlayerId: '',
        positionId: empty.positionId,
        positionLabel: empty.positionLabel,
        score,
        reasons,
        fieldTimeSec: 0,
        benchTimeSec: benchTime,
        isEmptySlot: true,
      });
    }

    // ── 2. Swap candidates ─────────────────────────────────────────────────
    if (!fieldEntries.length) continue;

    for (const field of fieldEntries) {
      if (field.positionLabel === 'GK' && !hasGKPref) continue;

      const fieldTime  = fieldTimeMap.get(field.playerId) ?? 0;
      const fieldSubs  = subCounts.get(field.playerId) ?? 0;

      // Primary: how long on field (40%) + how rarely subbed (35%)
      const fieldTimeScore   = fieldTime / maxFieldTime;
      const subFairnessScore = 1 - fieldSubs / maxSubCount;

      // Secondary: position match (15% exact, 7% category)
      const posMatch  = matchesPreferred(field.positionLabel, bench.preferredPositions);
      const fieldCat  = getCategory(field.positionLabel);
      const benchCats = bench.preferredPositions.map(getCategory).filter(Boolean);
      const catMatch  = !posMatch && fieldCat && benchCats.includes(fieldCat);

      // Tertiary: bench wait (3%)
      const score =
        fieldTimeScore   * 40 +
        subFairnessScore * 35 +
        (posMatch ? 1 : 0) * 15 +
        (catMatch ? 1 : 0) * 7  +
        benchWait        * 3;

      const reasons: string[] = [];
      if (fieldTimeScore >= 0.7)  reasons.push('Langst op veld');
      if (fieldSubs === 0)        reasons.push('Nog niet gewisseld');
      if (posMatch)               reasons.push('Voorkeurspos.');
      else if (catMatch)          reasons.push('Zelfde zone');
      if (benchWait >= 0.7)       reasons.push('Langst op bank');

      candidates.push({
        benchPlayerId: bench.id,
        fieldPlayerId: field.playerId,
        positionId: field.positionId,
        positionLabel: field.positionLabel,
        score,
        reasons,
        fieldTimeSec: fieldTime,
        benchTimeSec: benchTime,
        isEmptySlot: false,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}

/** For a specific field player, find the best bench player to swap in. */
export function getBestBenchPlayerForFieldPlayer(
  fieldPlayerId: string,
  input: AdvisorInput,
): string | null {
  const { benchPlayers, fieldEntries, currentSeconds, subCounts, benchEntryMap } = input;
  if (!benchPlayers.length) return null;

  const posLabel = fieldEntries.find((e) => e.playerId === fieldPlayerId)?.positionLabel ?? '';
  const isGKPos  = posLabel === 'GK';

  const maxBenchTime = Math.max(...benchPlayers.map((p) => currentSeconds - (benchEntryMap[p.id] ?? 0)), 1);
  const maxSubCount  = Math.max(...benchPlayers.map((p) => subCounts.get(p.id) ?? 0), 1);

  let best: { playerId: string; score: number } | null = null;

  for (const bench of benchPlayers) {
    if (isGKPos && !bench.preferredPositions.includes('GK')) continue;

    const benchTime = currentSeconds - (benchEntryMap[bench.id] ?? 0);
    const benchSubs = subCounts.get(bench.id) ?? 0;
    const posMatch  = posLabel ? matchesPreferred(posLabel, bench.preferredPositions) : false;
    const fieldCat  = getCategory(posLabel);
    const benchCats = bench.preferredPositions.map(getCategory).filter(Boolean);
    const catMatch  = !posMatch && fieldCat && benchCats.includes(fieldCat);

    const score =
      (benchTime / maxBenchTime)   * 45 +
      (1 - benchSubs / maxSubCount) * 35 +
      (posMatch ? 1 : 0)           * 15 +
      (catMatch ? 1 : 0)           * 5;

    if (!best || score > best.score) best = { playerId: bench.id, score };
  }

  return best?.playerId ?? null;
}

/** For a specific bench player, find the best field position to swap into (or fill). */
export function getBestPositionForBenchPlayer(
  benchPlayerId: string,
  input: AdvisorInput,
): string | null {
  const { fieldEntries, emptyPositions, currentSeconds, substitutions, subCounts, benchEntryMap, benchPlayers } = input;
  const bench = benchPlayers.find((p) => p.id === benchPlayerId);
  if (!bench) return null;

  const hasGKPref = bench.preferredPositions.includes('GK');

  // ── Prefer filling an empty position ──────────────────────────────────────
  const validEmpty = emptyPositions.filter((e) => !(e.positionLabel === 'GK' && !hasGKPref));
  if (validEmpty.length > 0) {
    // Pick empty position with best match; fall back to first
    const scored = validEmpty.map((e) => {
      const posMatch = matchesPreferred(e.positionLabel, bench.preferredPositions);
      const fieldCat = getCategory(e.positionLabel);
      const benchCats = bench.preferredPositions.map(getCategory).filter(Boolean);
      const catMatch  = !posMatch && fieldCat && benchCats.includes(fieldCat);
      return { positionId: e.positionId, score: posMatch ? 2 : catMatch ? 1 : 0 };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored[0].positionId;
  }

  // ── Otherwise find best swap ───────────────────────────────────────────────
  if (!fieldEntries.length) return null;

  const fieldTimeMap  = getFieldTime(fieldEntries, substitutions, currentSeconds);
  const maxFieldTime  = Math.max(...[...fieldTimeMap.values()], 1);
  const maxSubCount   = Math.max(...fieldEntries.map((e) => subCounts.get(e.playerId) ?? 0), 1);
  const benchTime     = currentSeconds - (benchEntryMap[bench.id] ?? 0);

  let best: { positionId: string; score: number } | null = null;

  for (const field of fieldEntries) {
    if (field.positionLabel === 'GK' && !hasGKPref) continue;

    const fieldTime  = fieldTimeMap.get(field.playerId) ?? 0;
    const fieldSubs  = subCounts.get(field.playerId) ?? 0;
    const posMatch   = matchesPreferred(field.positionLabel, bench.preferredPositions);
    const fieldCat   = getCategory(field.positionLabel);
    const benchCats  = bench.preferredPositions.map(getCategory).filter(Boolean);
    const catMatch   = !posMatch && fieldCat && benchCats.includes(fieldCat);

    const score =
      (fieldTime / maxFieldTime) * 40 +
      (1 - fieldSubs / maxSubCount) * 35 +
      (posMatch ? 1 : 0) * 15 +
      (catMatch ? 1 : 0) * 7  +
      (benchTime / Math.max(benchTime, 1)) * 3;

    if (!best || score > best.score) {
      best = { positionId: field.positionId, score };
    }
  }

  return best?.positionId ?? null;
}
