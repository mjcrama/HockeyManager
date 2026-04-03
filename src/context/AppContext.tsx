import React, { createContext, useContext, useReducer, useEffect } from 'react';
import type { AppState, AppAction, Match, LineupEntry } from '../types';
import { DEFAULT_FORMATIONS, getPositions } from '../data/formations';
import { useTeam } from './TeamContext';

const STORAGE_KEY = 'hockey-manager-state';

/** UUID v4 that works in non-secure (HTTP) contexts where randomUUID() is unavailable */
function generateId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b).map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10).join('')}`;
}

function createDefaultMatch(): Match {
  const playerCount = 11;
  const formation = DEFAULT_FORMATIONS[playerCount];
  const positions = getPositions(playerCount, formation);
  const lineup: LineupEntry[] = positions.map((p) => ({ positionId: p.id, playerId: null }));

  return {
    id: generateId(),
    date: new Date().toISOString().split('T')[0],
    fieldSize: 'full',
    playerCount,
    formation,
    lineup,
    substitutions: [],
    shootouts: [],
    timerSeconds: 0,
    timerStartedAt: null,
    timerRunning: false,
    timerDuration: 25 * 60,
    timerCountDown: false,
    timerBeep: 'loud',
    homeScore: 0,
    awayScore: 0,
  };
}

const defaultState: AppState = {
  players: [],
  currentMatch: createDefaultMatch(),
  activeTab: 'roster',
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as AppState;
    parsed.currentMatch.timerRunning = false;
    parsed.currentMatch.timerStartedAt = null;
    if (!parsed.currentMatch.shootouts) parsed.currentMatch.shootouts = [];
    if (parsed.currentMatch.timerDuration == null) parsed.currentMatch.timerDuration = 25 * 60;
    if (parsed.currentMatch.timerCountDown == null) parsed.currentMatch.timerCountDown = false;
    if (parsed.currentMatch.timerBeep == null) parsed.currentMatch.timerBeep = 'loud';
    if (parsed.currentMatch.homeScore == null) parsed.currentMatch.homeScore = 0;
    if (parsed.currentMatch.awayScore == null) parsed.currentMatch.awayScore = 0;
    // Migrate old field sizes / player counts to KNHB format
    const fs = parsed.currentMatch.fieldSize as string;
    if (fs === 'quarter') {
      parsed.currentMatch.fieldSize = 'small';
      parsed.currentMatch.playerCount = 6;
    }
    const pc = parsed.currentMatch.playerCount as number;
    if (pc === 7 || pc === 5) {
      // Remap to nearest KNHB count
      parsed.currentMatch.playerCount = pc === 7 ? 8 : 6;
    }
    return parsed;
  } catch {
    return defaultState;
  }
}


function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'ADD_PLAYER': {
      const newPlayer = {
        ...action.payload,
        id: generateId(),
      };
      return { ...state, players: [...state.players, newPlayer] };
    }

    case 'UPDATE_PLAYER': {
      return {
        ...state,
        players: state.players.map((p) => (p.id === action.payload.id ? action.payload : p)),
      };
    }

    case 'DELETE_PLAYER': {
      // Also remove from lineup
      const newLineup = state.currentMatch.lineup.map((entry) =>
        entry.playerId === action.payload ? { ...entry, playerId: null } : entry
      );
      return {
        ...state,
        players: state.players.filter((p) => p.id !== action.payload),
        currentMatch: { ...state.currentMatch, lineup: newLineup },
      };
    }

    case 'TOGGLE_AVAILABILITY': {
      const player = state.players.find((p) => p.id === action.payload);
      if (!player) return state;
      const newAvailable = !player.available;
      // If making unavailable, remove from lineup
      let newLineup = state.currentMatch.lineup;
      if (!newAvailable) {
        newLineup = newLineup.map((entry) =>
          entry.playerId === action.payload ? { ...entry, playerId: null } : entry
        );
      }
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.payload ? { ...p, available: newAvailable } : p
        ),
        currentMatch: { ...state.currentMatch, lineup: newLineup },
      };
    }

    case 'SET_FIELD_SIZE': {
      const fieldSize = action.payload;
      const playerCountMap: Record<string, 11 | 9 | 8 | 6 | 3> = {
        full:           11,
        'three-quarter': 9,
        half:            8,
        small:           6,
        mini:            3,
      };
      const playerCount = playerCountMap[fieldSize];
      const formation = DEFAULT_FORMATIONS[playerCount];
      const positions = getPositions(playerCount, formation);
      const lineup: LineupEntry[] = positions.map((p) => ({ positionId: p.id, playerId: null }));
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          fieldSize,
          playerCount,
          formation,
          lineup,
        },
      };
    }

    case 'SET_PLAYER_COUNT': {
      const playerCount = action.payload;
      const formation = DEFAULT_FORMATIONS[playerCount];
      const positions = getPositions(playerCount, formation);
      const lineup: LineupEntry[] = positions.map((p) => ({ positionId: p.id, playerId: null }));
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          playerCount,
          formation,
          lineup,
        },
      };
    }

    case 'SET_FORMATION': {
      const formation = action.payload;
      const positions = getPositions(state.currentMatch.playerCount, formation);
      const lineup: LineupEntry[] = positions.map((p) => ({ positionId: p.id, playerId: null }));
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          formation,
          lineup,
        },
      };
    }

    case 'UPDATE_LINEUP': {
      return {
        ...state,
        currentMatch: { ...state.currentMatch, lineup: action.payload },
      };
    }

    case 'ASSIGN_PLAYER_TO_POSITION': {
      const { positionId, playerId } = action.payload;
      // Remove player from any existing position first
      const clearedLineup = state.currentMatch.lineup.map((entry) =>
        entry.playerId === playerId && playerId !== null ? { ...entry, playerId: null } : entry
      );
      const newLineup = clearedLineup.map((entry) =>
        entry.positionId === positionId ? { ...entry, playerId } : entry
      );
      return {
        ...state,
        currentMatch: { ...state.currentMatch, lineup: newLineup },
      };
    }

    case 'SET_ACTIVE_TAB': {
      return { ...state, activeTab: action.payload };
    }

    case 'ADD_SUBSTITUTION': {
      const sub = { ...action.payload, id: generateId() };
      // Update lineup: replace playerOff with playerOn at position
      const newLineup = state.currentMatch.lineup.map((entry) =>
        entry.positionId === sub.positionId ? { ...entry, playerId: sub.playerOnId } : entry
      );
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          lineup: newLineup,
          substitutions: [...state.currentMatch.substitutions, sub],
        },
      };
    }

    case 'START_TIMER': {
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          timerRunning: true,
          timerStartedAt: Date.now(),
        },
      };
    }

    case 'STOP_TIMER': {
      const elapsed = state.currentMatch.timerStartedAt != null
        ? Math.floor((Date.now() - state.currentMatch.timerStartedAt) / 1000)
        : 0;
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          timerSeconds: state.currentMatch.timerSeconds + elapsed,
          timerStartedAt: null,
          timerRunning: false,
        },
      };
    }

    case 'RESET_TIMER': {
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          timerSeconds: 0,
          timerStartedAt: null,
          timerRunning: false,
        },
      };
    }

    case 'RESET_SCORE': {
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          homeScore: 0,
          awayScore: 0,
        },
      };
    }

    case 'SET_TIMER_DURATION': {
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          timerDuration: action.payload,
          timerSeconds: 0,
          timerStartedAt: null,
          timerRunning: false,
        },
      };
    }

    case 'SET_TIMER_COUNTDOWN': {
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          timerCountDown: action.payload,
          timerSeconds: 0,
          timerStartedAt: null,
          timerRunning: false,
        },
      };
    }

    case 'SET_TIMER_BEEP': {
      return {
        ...state,
        currentMatch: { ...state.currentMatch, timerBeep: action.payload },
      };
    }

    case 'RESET_MATCH': {
      return {
        ...state,
        currentMatch: createDefaultMatch(),
      };
    }

    case 'ADD_SHOOTOUT': {
      const entry = { ...action.payload, timestamp: Date.now() };
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          shootouts: [...state.currentMatch.shootouts, entry],
        },
      };
    }

    case 'UNDO_LAST_SHOOTOUT': {
      const { playerId } = action.payload;
      let removed = false;
      const shootouts = [...state.currentMatch.shootouts]
        .reverse()
        .filter((e) => {
          if (!removed && e.playerId === playerId) { removed = true; return false; }
          return true;
        })
        .reverse();
      return {
        ...state,
        currentMatch: { ...state.currentMatch, shootouts },
      };
    }

    case 'RESET_SHOOTOUTS': {
      return {
        ...state,
        currentMatch: { ...state.currentMatch, shootouts: [] },
      };
    }

    case 'RESET_SUBSTITUTIONS': {
      return {
        ...state,
        currentMatch: { ...state.currentMatch, substitutions: [] },
      };
    }

    case 'SCORE_GOAL': {
      const { team } = action.payload;
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          homeScore: team === 'home' ? state.currentMatch.homeScore + 1 : state.currentMatch.homeScore,
          awayScore: team === 'away' ? state.currentMatch.awayScore + 1 : state.currentMatch.awayScore,
        },
      };
    }

    case 'UNDO_GOAL': {
      const { team } = action.payload;
      return {
        ...state,
        currentMatch: {
          ...state.currentMatch,
          homeScore: team === 'home' ? Math.max(0, state.currentMatch.homeScore - 1) : state.currentMatch.homeScore,
          awayScore: team === 'away' ? Math.max(0, state.currentMatch.awayScore - 1) : state.currentMatch.awayScore,
        },
      };
    }

    case 'LOAD_REMOTE_STATE': {
      const m = action.payload.currentMatch;
      return {
        ...state,
        players: action.payload.players,
        currentMatch: {
          ...m,
          lineup:        m.lineup        ?? state.currentMatch.lineup,
          substitutions: m.substitutions ?? [],
          shootouts:     m.shootouts     ?? [],
        },
      };
    }

    default:
      return state;
  }
}

interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { isViewer } = useTeam();
  const [state, dispatch] = useReducer(appReducer, undefined, loadState);

  // Only coaches persist state; viewers must not overwrite their own localStorage
  useEffect(() => {
    if (!isViewer) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [state, isViewer]);

  const value = { state, dispatch };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function useAppDispatch(): React.Dispatch<AppAction> {
  return useApp().dispatch;
}

export function useAppState(): AppState {
  return useApp().state;
}

// Selector hook for available players (not on field)
export function useAvailableBenchPlayers(): ReturnType<typeof useApp>['state']['players'] {
  const { state } = useApp();
  const onFieldIds = new Set(
    state.currentMatch.lineup.filter((e) => e.playerId !== null).map((e) => e.playerId as string)
  );
  return state.players.filter((p) => p.available && !onFieldIds.has(p.id));
}

