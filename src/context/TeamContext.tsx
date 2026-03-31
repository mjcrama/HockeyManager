import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';

interface TeamContextValue {
  teamId: string;
  deviceId: string;
  isViewer: boolean;
  isOnline: boolean;
  teamName: string;
  setTeamName: (name: string) => void;
  getCoachUrl: () => string;
  getViewerUrl: () => string;
}

const TeamContext = createContext<TeamContextValue | null>(null);

// Read URL params once at module load time, before any React rendering or replaceState calls.
// This survives StrictMode double-mount because module code only runs once.
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

  const [teamId] = useState(() => {
    if (_teamId) {
      if (_isCoach) {
        // Joining as coach: persist so future visits without URL stay on this team
        localStorage.setItem('hockey-teamId', _teamId);
      }
      const url = new URL(window.location.href);
      url.searchParams.delete('team');
      url.searchParams.delete('coach');
      url.searchParams.delete('view');    // legacy
      url.searchParams.delete('session'); // legacy
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

  const [isOnline, setIsOnline] = useState(true);

  // Track Firebase connection state
  useEffect(() => {
    const connectedRef = ref(db, '.info/connected');
    const unsubscribe = onValue(connectedRef, (snapshot) => {
      setIsOnline(snapshot.val() === true);
    });
    return () => unsubscribe();
  }, []);

  const [teamName, setTeamNameState] = useState(
    () => localStorage.getItem(`hockey-teamName-${teamId}`) ?? ''
  );

  // Sync team name from Firebase (other coaches may have set it)
  useEffect(() => {
    const nameRef = ref(db, `teams/${teamId}/name`);
    const unsubscribe = onValue(nameRef, (snapshot) => {
      const name: string | null = snapshot.val();
      if (name) {
        setTeamNameState(name);
        localStorage.setItem(`hockey-teamName-${teamId}`, name);
      }
    });
    return () => unsubscribe();
  }, [teamId]);

  function setTeamName(name: string) {
    setTeamNameState(name);
    localStorage.setItem(`hockey-teamName-${teamId}`, name);
    set(ref(db, `teams/${teamId}/name`), name);
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
    <TeamContext.Provider value={{ teamId, deviceId, isViewer, isOnline, teamName, setTeamName, getCoachUrl, getViewerUrl }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}
