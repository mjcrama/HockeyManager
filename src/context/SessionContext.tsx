import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface SessionContextValue {
  sessionId: string | null;
  token: string | null;
  isCoach: boolean;
  isViewer: boolean;
  startSession: () => void;
  stopSession: () => void;
  getViewerUrl: () => string;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function randomString(len: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(len)))
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, len)
    .toUpperCase();
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const params = new URLSearchParams(window.location.search);
  const urlSessionId = params.get('session');
  const storedToken = urlSessionId
    ? localStorage.getItem(`hockey-token-${urlSessionId}`)
    : null;

  const [sessionId, setSessionId] = useState<string | null>(urlSessionId);
  const [token, setToken] = useState<string | null>(storedToken);

  const isCoach = Boolean(sessionId && token);
  const isViewer = Boolean(sessionId && !token);

  function startSession() {
    const newId = randomString(6);
    const newToken = randomString(16);
    localStorage.setItem(`hockey-token-${newId}`, newToken);
    const url = new URL(window.location.href);
    url.searchParams.set('session', newId);
    window.history.replaceState({}, '', url.toString());
    setSessionId(newId);
    setToken(newToken);
  }

  function stopSession() {
    if (!sessionId) return;
    localStorage.removeItem(`hockey-token-${sessionId}`);
    const url = new URL(window.location.href);
    url.searchParams.delete('session');
    window.history.replaceState({}, '', url.toString());
    setSessionId(null);
    setToken(null);
  }

  function getViewerUrl() {
    if (!sessionId) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('session', sessionId);
    return url.toString();
  }

  return (
    <SessionContext.Provider value={{ sessionId, token, isCoach, isViewer, startSession, stopSession, getViewerUrl }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}
