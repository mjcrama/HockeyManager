import { matchesPreferred, POSITION_CATEGORY_MAP } from '../data/formations';

export interface SubstitutionCandidate {
  benchPlayerId: string;
  fieldPlayerId: string;
  positionId: string;
  positionLabel: string;
  score: number;
  reasons: string[];
  fieldTimeSec: number;
  benchTimeSec: number;
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

export interface AdvisorInput {
  benchPlayers: BenchPlayer[];
  fieldEntries: FieldEntry[];
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

  // Everyone who was never subbed on started at 0
  for (const e of fieldEntries) {
    lastOnTime.set(e.playerId, 0);
  }

  // Walk substitutions chronologically — track when each player last came ON
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
  const { benchPlayers, fieldEntries, currentSeconds, substitutions, subCounts, benchEntryMap } = input;

  if (!benchPlayers.length || !fieldEntries.length) return [];

  const fieldTimeMap = getFieldTime(fieldEntries, substitutions, currentSeconds);

  // Pre-compute max values for normalization
  const fieldTimes = [...fieldTimeMap.values()];
  const maxFieldTime = Math.max(...fieldTimes, 1);

  const fieldSubCounts = fieldEntries.map((e) => subCounts.get(e.playerId) ?? 0);
  const maxSubCount = Math.max(...fieldSubCounts, 1);

  const benchTimes = benchPlayers.map((p) => currentSeconds - (benchEntryMap[p.id] ?? 0));
  const maxBenchTime = Math.max(...benchTimes, 1);

  const candidates: SubstitutionCandidate[] = [];

  for (const bench of benchPlayers) {
    const benchTime = currentSeconds - (benchEntryMap[bench.id] ?? 0);
    const hasGKPref = bench.preferredPositions.includes('GK');

    for (const field of fieldEntries) {
      // Skip GK unless bench player prefers GK
      if (field.positionLabel === 'GK' && !hasGKPref) continue;

      const fieldTime = fieldTimeMap.get(field.playerId) ?? 0;
      const fieldSubs = subCounts.get(field.playerId) ?? 0;

      // Factor 1: Time on field (35%)
      const fieldTimeScore = fieldTime / maxFieldTime;

      // Factor 2: Fewer subs = higher priority to come off (25%)
      const subFairnessScore = 1 - fieldSubs / maxSubCount;

      // Factor 3: Bench wait time (20%)
      const benchWaitScore = benchTime / maxBenchTime;

      // Factor 4: Position exact match (15%)
      const posMatch = matchesPreferred(field.positionLabel, bench.preferredPositions);
      const posMatchScore = posMatch ? 1 : 0;

      // Factor 5: Category match fallback (5%)
      const fieldCat = getCategory(field.positionLabel);
      const benchCats = bench.preferredPositions.map(getCategory).filter(Boolean);
      const catMatch = !posMatch && fieldCat && benchCats.includes(fieldCat);
      const catMatchScore = catMatch ? 1 : 0;

      const score =
        fieldTimeScore * 35 +
        subFairnessScore * 25 +
        benchWaitScore * 20 +
        posMatchScore * 15 +
        catMatchScore * 5;

      // Build reason strings
      const reasons: string[] = [];
      if (fieldTimeScore >= 0.7) reasons.push('Langst op veld');
      if (fieldSubs === 0) reasons.push('Nog niet gewisseld');
      if (posMatch) reasons.push('Voorkeurspos.');
      else if (catMatch) reasons.push('Zelfde zone');
      if (benchWaitScore >= 0.7) reasons.push('Langst op bank');

      candidates.push({
        benchPlayerId: bench.id,
        fieldPlayerId: field.playerId,
        positionId: field.positionId,
        positionLabel: field.positionLabel,
        score,
        reasons,
        fieldTimeSec: fieldTime,
        benchTimeSec: benchTime,
      });
    }
  }

  // Sort descending by score, return top 3
  candidates.sort((a, b) => b.score - a.score);
  return candidates.slice(0, 3);
}

/** For a specific bench player, find the best field position to swap into. */
export function getBestPositionForBenchPlayer(
  benchPlayerId: string,
  input: AdvisorInput,
): string | null {
  const { fieldEntries, currentSeconds, substitutions, subCounts, benchEntryMap, benchPlayers } = input;
  const bench = benchPlayers.find((p) => p.id === benchPlayerId);
  if (!bench || !fieldEntries.length) return null;

  const fieldTimeMap = getFieldTime(fieldEntries, substitutions, currentSeconds);
  const fieldTimes = [...fieldTimeMap.values()];
  const maxFieldTime = Math.max(...fieldTimes, 1);
  const fieldSubCounts = fieldEntries.map((e) => subCounts.get(e.playerId) ?? 0);
  const maxSubCount = Math.max(...fieldSubCounts, 1);
  const benchTime = currentSeconds - (benchEntryMap[bench.id] ?? 0);
  const hasGKPref = bench.preferredPositions.includes('GK');

  let best: { positionId: string; score: number } | null = null;

  for (const field of fieldEntries) {
    if (field.positionLabel === 'GK' && !hasGKPref) continue;

    const fieldTime = fieldTimeMap.get(field.playerId) ?? 0;
    const fieldSubs = subCounts.get(field.playerId) ?? 0;
    const posMatch = matchesPreferred(field.positionLabel, bench.preferredPositions);
    const fieldCat = getCategory(field.positionLabel);
    const benchCats = bench.preferredPositions.map(getCategory).filter(Boolean);
    const catMatch = !posMatch && fieldCat && benchCats.includes(fieldCat);

    const score =
      (fieldTime / maxFieldTime) * 35 +
      (1 - fieldSubs / maxSubCount) * 25 +
      (benchTime / Math.max(benchTime, 1)) * 20 +
      (posMatch ? 1 : 0) * 15 +
      (catMatch ? 1 : 0) * 5;

    if (!best || score > best.score) {
      best = { positionId: field.positionId, score };
    }
  }

  return best?.positionId ?? null;
}
