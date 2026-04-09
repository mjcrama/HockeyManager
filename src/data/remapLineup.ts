import type { FieldPositionConfig, LineupEntry } from '../types';
import { matchesPreferred } from './formations';

type Zone = 'GK' | 'DEF' | 'MID' | 'FWD';

const ZONE_ORDER: Zone[] = ['GK', 'DEF', 'MID', 'FWD'];

function classifyZone(pos: { y: number }): Zone {
  if (pos.y >= 85) return 'GK';
  if (pos.y >= 65) return 'DEF';
  if (pos.y >= 40) return 'MID';
  return 'FWD';
}

function euclidean(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

interface PlayerEntry {
  playerId: string;
  pos: FieldPositionConfig;
  preferred: string[]; // preferredPositions from Player
}

/** Does this player have a preference for any position in the given zone? */
function prefersZonePositions(player: PlayerEntry, positions: FieldPositionConfig[]): boolean {
  if (player.preferred.length === 0) return false;
  return positions.some((p) => matchesPreferred(p.label, player.preferred));
}

/** Sum of greedy spatial matching distances (players → positions). */
function greedyMatchCost(players: PlayerEntry[], positions: FieldPositionConfig[]): number {
  const pairs: { pi: number; qi: number; d: number }[] = [];
  for (let pi = 0; pi < players.length; pi++) {
    for (let qi = 0; qi < positions.length; qi++) {
      pairs.push({ pi, qi, d: euclidean(players[pi].pos, positions[qi]) });
    }
  }
  pairs.sort((a, b) => a.d - b.d);
  const usedP = new Set<number>();
  const usedQ = new Set<number>();
  let cost = 0;
  for (const { pi, qi, d } of pairs) {
    if (usedP.has(pi) || usedQ.has(qi)) continue;
    usedP.add(pi);
    usedQ.add(qi);
    cost += d;
  }
  return cost;
}

/**
 * Remap players from old formation positions to new formation positions.
 *
 * @param playerPreferences  Map of playerId → preferredPositions labels.
 *   Used to prefer cascading players who have a preference for the target zone.
 *
 * Algorithm:
 * 1. Classify old players and new positions into zones (GK/DEF/MID/FWD)
 * 2. Redistribute overflow: cascade excess players to adjacent zones.
 *    - A player never moves more than 1 zone from their origin.
 *    - Prefer to move players who have a preference for the target zone.
 *    - Among those, pick the one whose removal leaves the best remaining match.
 * 3. Post-process: swap players between zones when it improves preference alignment.
 * 4. Spatial matching within each zone (greedy nearest, preference-aware)
 */
export function remapLineup(
  oldPositions: FieldPositionConfig[],
  newPositions: FieldPositionConfig[],
  oldLineup: LineupEntry[],
  playerPreferences?: Map<string, string[]>,
): LineupEntry[] {
  const prefs = playerPreferences ?? new Map<string, string[]>();

  const oldPlayerMap = new Map<string, string>();
  for (const entry of oldLineup) {
    if (entry.playerId) oldPlayerMap.set(entry.positionId, entry.playerId);
  }

  const assignedPlayers: PlayerEntry[] = [];
  for (const oldPos of oldPositions) {
    const playerId = oldPlayerMap.get(oldPos.id);
    if (playerId) {
      assignedPlayers.push({ playerId, pos: oldPos, preferred: prefs.get(playerId) ?? [] });
    }
  }

  if (assignedPlayers.length === 0) {
    return newPositions.map((p) => ({ positionId: p.id, playerId: null }));
  }

  // Group new positions by zone
  const newByZone = new Map<Zone, FieldPositionConfig[]>();
  for (const z of ZONE_ORDER) newByZone.set(z, []);
  for (const pos of newPositions) newByZone.get(classifyZone(pos))!.push(pos);

  // Group players by their old zone
  const playersByZone = new Map<Zone, PlayerEntry[]>();
  for (const z of ZONE_ORDER) playersByZone.set(z, []);
  for (const p of assignedPlayers) playersByZone.get(classifyZone(p.pos))!.push(p);

  // ── Redistribute: cascade overflow through adjacent zones ──────────────

  function cascadeOverflow(order: Zone[]) {
    for (let i = 0; i < order.length - 1; i++) {
      const zone = order[i];
      const nextZone = order[i + 1];
      const cap = newByZone.get(zone)!.length;
      const players = playersByZone.get(zone)!;
      if (players.length <= cap) continue;

      const nextZoneIdx = ZONE_ORDER.indexOf(nextZone);
      const zonePositions = newByZone.get(zone)!;
      const nextPositions = newByZone.get(nextZone)!;

      // Only players whose origin is ≤1 zone from nextZone may cascade.
      const canMove: PlayerEntry[] = [];
      const mustStay: PlayerEntry[] = [];
      for (const p of players) {
        const origIdx = ZONE_ORDER.indexOf(classifyZone(p.pos));
        if (Math.abs(origIdx - nextZoneIdx) <= 1) {
          canMove.push(p);
        } else {
          mustStay.push(p);
        }
      }

      // Move one at a time.
      let needed = players.length - cap;
      const moved: PlayerEntry[] = [];

      while (needed > 0 && canMove.length > 0) {
        // Split candidates: those who prefer the next zone vs those who don't
        const withPref: number[] = [];
        const withoutPref: number[] = [];
        for (let ci = 0; ci < canMove.length; ci++) {
          if (prefersZonePositions(canMove[ci], nextPositions)) {
            withPref.push(ci);
          } else {
            withoutPref.push(ci);
          }
        }
        // Prefer moving players who have a preference for the next zone.
        // Among those, pick the one whose removal leaves the best remaining match.
        const candidates = withPref.length > 0 ? withPref : withoutPref.length > 0 ? withoutPref : [...canMove.keys()];

        let bestIdx = candidates[0];
        let bestCost = Infinity;
        for (const ci of candidates) {
          const remaining = [
            ...mustStay,
            ...canMove.filter((_, j) => j !== ci),
          ];
          const cost = greedyMatchCost(remaining, zonePositions);
          if (cost < bestCost) { bestCost = cost; bestIdx = ci; }
        }
        moved.push(canMove.splice(bestIdx, 1)[0]);
        needed--;
      }

      // Fallback: if not enough eligible players, move from mustStay
      while (needed > 0 && mustStay.length > 0) {
        let bestIdx = 0;
        let bestCost = Infinity;
        for (let ci = 0; ci < mustStay.length; ci++) {
          const remaining = [
            ...mustStay.filter((_, j) => j !== ci),
            ...canMove,
          ];
          const cost = greedyMatchCost(remaining, zonePositions);
          if (cost < bestCost) { bestCost = cost; bestIdx = ci; }
        }
        moved.push(mustStay.splice(bestIdx, 1)[0]);
        needed--;
      }

      playersByZone.set(zone, [...mustStay, ...canMove]);
      playersByZone.get(nextZone)!.push(...moved);
    }
  }

  // Forward: GK → DEF → MID → FWD
  cascadeOverflow(ZONE_ORDER);
  // Backward: FWD → MID → DEF → GK
  cascadeOverflow([...ZONE_ORDER].reverse());

  // ── Post-process: preference-based swaps between adjacent zones ────────
  // If player A is in zone X but prefers zone Y, and player B is in zone Y
  // but prefers zone X (or has no preference), swap them.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < ZONE_ORDER.length - 1; i++) {
      const zoneA = ZONE_ORDER[i];
      const zoneB = ZONE_ORDER[i + 1];
      const playersA = playersByZone.get(zoneA)!;
      const playersB = playersByZone.get(zoneB)!;
      const positionsA = newByZone.get(zoneA)!;
      const positionsB = newByZone.get(zoneB)!;

      // Find player in A who prefers B, and player in B who prefers A (or is neutral)
      for (let ai = 0; ai < playersA.length; ai++) {
        const pA = playersA[ai];
        if (!prefersZonePositions(pA, positionsB)) continue;
        // pA prefers zone B — look for a swap partner in B
        if (prefersZonePositions(pA, positionsA)) continue; // already happy here

        for (let bi = 0; bi < playersB.length; bi++) {
          const pB = playersB[bi];
          // pB should prefer A, or at least not prefer B
          const pBPrefersA = prefersZonePositions(pB, positionsA);
          const pBPrefersB = prefersZonePositions(pB, positionsB);
          if (!pBPrefersA && pBPrefersB) continue; // pB is happy in B, don't swap

          // Check spatial: swap should not make things much worse
          const costBefore = greedyMatchCost(playersA, positionsA) + greedyMatchCost(playersB, positionsB);
          const swappedA = [...playersA]; swappedA[ai] = pB;
          const swappedB = [...playersB]; swappedB[bi] = pA;
          const costAfter = greedyMatchCost(swappedA, positionsA) + greedyMatchCost(swappedB, positionsB);

          // Allow swap if preference improves and spatial cost doesn't increase too much
          if (costAfter <= costBefore * 1.5) {
            playersA[ai] = pB;
            playersB[bi] = pA;
            break; // move to next player in A
          }
        }
      }
    }
  }

  // If still more players than positions (e.g. 11→8), drop worst fits
  const totalCap = newPositions.length;
  const allPlaced: PlayerEntry[] = [];
  for (const z of ZONE_ORDER) allPlaced.push(...playersByZone.get(z)!);
  if (allPlaced.length > totalCap) {
    const scored = ZONE_ORDER.flatMap((zone) => {
      const zonePositions = newByZone.get(zone)!;
      return playersByZone.get(zone)!.map((p) => ({
        player: p,
        zone,
        minDist: zonePositions.length > 0
          ? Math.min(...zonePositions.map((pos) => euclidean(p.pos, pos)))
          : Infinity,
      }));
    });
    scored.sort((a, b) => a.minDist - b.minDist);
    const keepIds = new Set(scored.slice(0, totalCap).map((s) => s.player.playerId));
    for (const z of ZONE_ORDER) {
      playersByZone.set(z, playersByZone.get(z)!.filter((p) => keepIds.has(p.playerId)));
    }
  }

  // ── Spatial matching within each zone (preference-aware) ───────────────
  const result = new Map<string, string>();
  const placedPlayerIds = new Set<string>();
  const filledPositionIds = new Set<string>();

  for (const zone of ZONE_ORDER) {
    const players = playersByZone.get(zone)!;
    const positions = newByZone.get(zone)!;

    // Bonus for matching a preferred position: reduce effective distance
    const PREF_BONUS = 15;
    const pairs: { player: PlayerEntry; pos: FieldPositionConfig; d: number }[] = [];
    for (const player of players) {
      for (const pos of positions) {
        const spatial = euclidean(player.pos, pos);
        const bonus = matchesPreferred(pos.label, player.preferred) ? PREF_BONUS : 0;
        pairs.push({ player, pos, d: spatial - bonus });
      }
    }
    pairs.sort((a, b) => a.d - b.d);

    for (const { player, pos } of pairs) {
      if (placedPlayerIds.has(player.playerId) || filledPositionIds.has(pos.id)) continue;
      result.set(pos.id, player.playerId);
      placedPlayerIds.add(player.playerId);
      filledPositionIds.add(pos.id);
    }
  }

  return newPositions.map((pos) => ({
    positionId: pos.id,
    playerId: result.get(pos.id) ?? null,
  }));
}
