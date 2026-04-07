import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ref, set, get, remove, update, onValue } from 'firebase/database';
import { db } from '../firebase';

export interface TeamEntry { id: string; name: string; }

interface TeamContextValue {
  teamId: string;
  deviceId: string;
  isViewer: boolean;
  isOnline: boolean;
  teamName: string;
  teamDeleted: boolean;
  allTeams: TeamEntry[];
  setTeamName: (name: string) => void;
  switchTeam: (id: string) => void;
  createTeam: (defaultName: string) => void;
  getActiveDeviceCount: (id: string) => Promise<number>;
  deleteTeam: (id: string) => Promise<void>;
  /** Called by FirebaseSync when it detects the current team was deleted remotely */
  _notifyTeamDeleted: () => void;
  getCoachUrl: () => string;
  getViewerUrl: () => string;
}

const TeamContext = createContext<TeamContextValue | null>(null);

const _params    = new URLSearchParams(window.location.search);
const _teamId    = _params.get('team');
const _isCoach   = _params.get('coach') === '1';
const _IS_VIEWER = Boolean(_teamId) && !_isCoach;

function generateId(len = 10) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, len)
    .toUpperCase();
}

export function TeamProvider({ children }: { children: ReactNode }) {
  const [deviceId] = useState(() => {
    const stored = localStorage.getItem('hockey-deviceId');
    if (stored) return stored;
    const id = generateId(12);
    localStorage.setItem('hockey-deviceId', id);
    return id;
  });

  const [teamId, setTeamIdState] = useState<string>(() => {
    if (_teamId) {
      if (_isCoach) localStorage.setItem('hockey-teamId', _teamId);
      const url = new URL(window.location.href);
      url.searchParams.delete('team');
      url.searchParams.delete('coach');
      url.searchParams.delete('view');
      url.searchParams.delete('session');
      window.history.replaceState({}, '', url.toString());
      return _teamId;
    }
    const stored = localStorage.getItem('hockey-teamId');
    if (stored) return stored;
    const id = generateId();
    localStorage.setItem('hockey-teamId', id);
    return id;
  });

  const isViewer = _IS_VIEWER;

  const [isOnline, setIsOnline]     = useState(true);
  const [allTeams, setAllTeams]     = useState<TeamEntry[]>([]);
  const [teamDeleted, setTeamDeleted] = useState(false);

  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snap) => setIsOnline(snap.val() === true));
    return () => unsubscribe();
  }, []);

  // Listen to all teams (for the switcher dropdown)
  useEffect(() => {
    const teamsRef = ref(db, 'teams');
    const unsubscribe = onValue(
      teamsRef,
      (snapshot) => {
        const data = snapshot.val() as Record<string, { name?: string; deleted?: boolean }> | null;
        if (!data) return;
        setAllTeams(
          Object.entries(data)
            .filter(([, v]) => !v?.deleted)
            .map(([id, v]) => ({ id, name: v?.name ?? `Team ${id.slice(0, 4).toUpperCase()}` }))
        );
      },
      () => { /* read error: likely a permissions issue */ }
    );
    return () => unsubscribe();
  }, []);

  const [teamName, setTeamNameState] = useState(
    () => localStorage.getItem(`hockey-teamName-${teamId}`) ?? ''
  );

  // Sync team name from Firebase
  useEffect(() => {
    const nameRef = ref(db, `teams/${teamId}/name`);
    const unsubscribe = onValue(nameRef, (snapshot) => {
      const firebaseName: string | null = snapshot.val();
      const resolved = firebaseName || localStorage.getItem(`hockey-teamName-${teamId}`) || `Team ${teamId.slice(0, 4).toUpperCase()}`;
      if (firebaseName) {
        setTeamNameState(firebaseName);
        localStorage.setItem(`hockey-teamName-${teamId}`, firebaseName);
      }
      set(ref(db, `teamIndex/${teamId}`), resolved);
    });
    return () => unsubscribe();
  }, [teamId]);

  function setTeamName(name: string) {
    setTeamNameState(name);
    localStorage.setItem(`hockey-teamName-${teamId}`, name);
    set(ref(db, `teams/${teamId}/name`), name);
    set(ref(db, `teamIndex/${teamId}`), name);
  }

  function switchTeam(id: string) {
    setTeamIdState(id);
    localStorage.setItem('hockey-teamId', id);
    setTeamNameState(localStorage.getItem(`hockey-teamName-${id}`) ?? '');
    setTeamDeleted(false);
  }

  function createTeam(defaultName: string) {
    const newId = generateId();
    setTeamIdState(newId);
    localStorage.setItem('hockey-teamId', newId);
    setTeamNameState(defaultName);
    localStorage.setItem(`hockey-teamName-${newId}`, defaultName);
    set(ref(db, `teams/${newId}/name`), defaultName);
    set(ref(db, `teamIndex/${newId}`), defaultName);
    setTeamDeleted(false);
  }

  async function getActiveDeviceCount(id: string): Promise<number> {
    const snap = await get(ref(db, `teams/${id}/presence`));
    const presence = snap.val() as Record<string, unknown> | null;
    if (!presence) return 0;
    return Object.keys(presence).filter((d) => d !== deviceId).length;
  }

  async function deleteTeam(id: string): Promise<void> {
    // Soft-delete: mark as deleted so other devices detect it
    await update(ref(db, `teams/${id}`), { deleted: true });
    await remove(ref(db, `teamIndex/${id}`));
  }

  function _notifyTeamDeleted() {
    setTeamDeleted(true);
  }

  function getCoachUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('team', teamId);
    url.searchParams.set('coach', '1');
    return url.toString();
  }

  function getViewerUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('team', teamId);
    return url.toString();
  }

  return (
    <TeamContext.Provider value={{
      teamId, deviceId, isViewer, isOnline, teamName, teamDeleted, allTeams,
      setTeamName, switchTeam, createTeam, getActiveDeviceCount, deleteTeam,
      _notifyTeamDeleted, getCoachUrl, getViewerUrl,
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}
