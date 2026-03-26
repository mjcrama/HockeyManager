export type Position =
  | 'GK'
  | 'LB'
  | 'CB'
  | 'CB1'
  | 'CB2'
  | 'RB'
  | 'LM'
  | 'CM'
  | 'CM1'
  | 'CM2'
  | 'RM'
  | 'LF'
  | 'CF'
  | 'RF'
  | 'DEF'
  | 'MID'
  | 'FWD';

/** KNHB field sizes:
 *  full          = 91.4×55m  — O12+  11v11
 *  three-quarter = 68×55m    — O11    9v9
 *  half          = 55×45.7m  — O10    8v8  (landscape, side-to-side)
 *  small         = 43×25m    — O9     6v6  (portrait, with GK)
 *  mini          = 23×23m    — O8     3v3  (square, no GK, 3 goals per line)
 */
export type FieldSize = 'full' | 'three-quarter' | 'half' | 'small' | 'mini';

export type PlayerCount = 11 | 9 | 8 | 6 | 3;

export interface Player {
  id: string;
  name: string;
  jerseyNumber: number;
  preferredPositions: Position[];
  available: boolean;
}

export interface FieldPositionConfig {
  id: string;
  label: string;
  x: number; // percentage 0-100 from left
  y: number; // percentage 0-100 from top (0 = attacking end, 100 = GK end)
}

export interface LineupEntry {
  positionId: string;
  playerId: string | null;
}

export interface Substitution {
  id: string;
  playerOnId: string;
  playerOffId: string;
  positionId: string;
  minute: number;
  timestamp: number;
}

export interface ShootoutEntry {
  playerId: string;
  scored: boolean;
  timestamp: number;
}

export interface Match {
  id: string;
  date: string;
  fieldSize: FieldSize;
  playerCount: PlayerCount;
  formation: string;
  lineup: LineupEntry[];
  substitutions: Substitution[];
  shootouts: ShootoutEntry[];
  timerSeconds: number;
  timerRunning: boolean;
  homeScore: number;
  awayScore: number;
}

export interface AppState {
  players: Player[];
  currentMatch: Match;
  activeTab: 'home' | 'roster' | 'setup' | 'matchday' | 'shootout';
}

export type AppAction =
  | { type: 'ADD_PLAYER'; payload: Omit<Player, 'id'> }
  | { type: 'UPDATE_PLAYER'; payload: Player }
  | { type: 'DELETE_PLAYER'; payload: string }
  | { type: 'TOGGLE_AVAILABILITY'; payload: string }
  | { type: 'SET_FIELD_SIZE'; payload: FieldSize }
  | { type: 'SET_PLAYER_COUNT'; payload: PlayerCount }
  | { type: 'SET_FORMATION'; payload: string }
  | { type: 'UPDATE_LINEUP'; payload: LineupEntry[] }
  | { type: 'ASSIGN_PLAYER_TO_POSITION'; payload: { positionId: string; playerId: string | null } }
  | { type: 'SET_ACTIVE_TAB'; payload: AppState['activeTab'] }
  | { type: 'ADD_SUBSTITUTION'; payload: Omit<Substitution, 'id'> }
  | { type: 'TICK_TIMER' }
  | { type: 'START_TIMER' }
  | { type: 'STOP_TIMER' }
  | { type: 'RESET_TIMER' }
  | { type: 'RESET_MATCH' }
  | { type: 'ADD_SHOOTOUT'; payload: { playerId: string; scored: boolean } }
  | { type: 'UNDO_LAST_SHOOTOUT'; payload: { playerId: string } }
  | { type: 'RESET_SHOOTOUTS' }
  | { type: 'RESET_SUBSTITUTIONS' }
  | { type: 'SCORE_GOAL'; payload: { team: 'home' | 'away' } }
  | { type: 'UNDO_GOAL'; payload: { team: 'home' | 'away' } };
