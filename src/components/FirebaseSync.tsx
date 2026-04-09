import { useEffect, useRef } from 'react';
import { ref, update, set, remove, onValue, onDisconnect } from 'firebase/database';
import { db } from '../firebase';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';

const DEBOUNCE_MS = 400;
// Safety: release write lock after this many ms if no ACK received (e.g. offline)
const LOCK_TIMEOUT_MS = 8000;

export function FirebaseSync() {
  const { teamId, deviceId, isViewer, allTeams, switchTeam, _notifyTeamDeleted } = useTeam();
  const state    = useAppState();
  const dispatch = useAppDispatch();

  const writeTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimeoutTimer         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReceivedRef          = useRef<string>('');
  const prevTeamIdRef            = useRef<string>(teamId);
  const isSwitchingRef           = useRef<boolean>(false);
  const hasReceivedFirstUpdateRef = useRef<boolean>(false);
  // Stores the exact JSON we sent to Firebase; null = no pending write
  const pendingWriteRef          = useRef<string | null>(null);

  const allTeamsRef = useRef(allTeams);
  useEffect(() => { allTeamsRef.current = allTeams; }, [allTeams]);

  function clearWriteLock() {
    pendingWriteRef.current = null;
    if (lockTimeoutTimer.current) {
      clearTimeout(lockTimeoutTimer.current);
      lockTimeoutTimer.current = null;
    }
  }

  function setWriteLock(data: string) {
    pendingWriteRef.current = data;
    if (lockTimeoutTimer.current) clearTimeout(lockTimeoutTimer.current);
    lockTimeoutTimer.current = setTimeout(() => {
      // Safety release: if no ACK after LOCK_TIMEOUT_MS, unblock reads
      pendingWriteRef.current = null;
      lockTimeoutTimer.current = null;
    }, LOCK_TIMEOUT_MS);
  }

  function writeTeamState(id: string, players: unknown, currentMatch: unknown) {
    update(ref(db, `teams/${id}`), {
      _writtenBy: deviceId,
      state: { players, currentMatch },
      lastActive: Date.now(),
    });
  }

  // Presence: register this device as active; Firebase auto-removes on disconnect
  useEffect(() => {
    if (isViewer) return;
    const presenceRef = ref(db, `teams/${teamId}/presence/${deviceId}`);
    set(presenceRef, { lastSeen: Date.now() });
    const dc = onDisconnect(presenceRef);
    dc.remove();
    return () => {
      dc.cancel();
      remove(presenceRef);
    };
  }, [teamId, deviceId, isViewer]);

  // On team switch: flush pending write for old team, reset all state
  useEffect(() => {
    if (prevTeamIdRef.current === teamId) return;

    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
      writeTeamState(prevTeamIdRef.current, state.players, state.currentMatch);
    }

    prevTeamIdRef.current = teamId;
    lastReceivedRef.current = '';
    isSwitchingRef.current = true;
    hasReceivedFirstUpdateRef.current = false;
    clearWriteLock();
    dispatch({ type: 'RESET_TO_DEFAULT' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Listen for changes from Firebase
  useEffect(() => {
    const teamRef = ref(db, `teams/${teamId}`);
    const unsubscribe = onValue(teamRef, (snapshot) => {
      const data = snapshot.val();

      if (data?.deleted) {
        _notifyTeamDeleted();
        isSwitchingRef.current = true;
        clearWriteLock();
        dispatch({ type: 'RESET_TO_DEFAULT' });
        const other = allTeamsRef.current.find((t) => t.id !== teamId);
        if (other) switchTeam(other.id);
        return;
      }

      if (!data?.state?.players || !data?.state?.currentMatch) {
        isSwitchingRef.current = false;
        hasReceivedFirstUpdateRef.current = true;
        return;
      }

      const incoming = JSON.stringify({ p: data.state.players, m: data.state.currentMatch });

      if (!isViewer && !isSwitchingRef.current) {
        if (pendingWriteRef.current !== null) {
          // Write lock active — only release when Firebase confirms our exact write
          if (data._writtenBy === deviceId && incoming === pendingWriteRef.current) {
            lastReceivedRef.current = incoming;
            hasReceivedFirstUpdateRef.current = true;
            clearWriteLock();
          }
          // Ignore all other incoming updates while locked
          return;
        }

        // No write lock: skip our own echoes
        if (data._writtenBy === deviceId) {
          lastReceivedRef.current = incoming;
          hasReceivedFirstUpdateRef.current = true;
          return;
        }
      }

      // Skip identical data
      if (incoming === lastReceivedRef.current) {
        isSwitchingRef.current = false;
        hasReceivedFirstUpdateRef.current = true;
        return;
      }

      lastReceivedRef.current = incoming;
      isSwitchingRef.current = false;
      hasReceivedFirstUpdateRef.current = true;

      dispatch({
        type: 'LOAD_REMOTE_STATE',
        payload: { players: data.state.players, currentMatch: data.state.currentMatch },
      });
    });
    return () => unsubscribe();
  }, [teamId, deviceId, isViewer, dispatch, switchTeam, _notifyTeamDeleted]);

  // Coaches: debounced write on every state change
  useEffect(() => {
    if (isViewer) return;
    if (!hasReceivedFirstUpdateRef.current) return;
    if (isSwitchingRef.current) return;

    const current = JSON.stringify({ p: state.players, m: state.currentMatch });
    if (current === lastReceivedRef.current) return;

    // Lock reads immediately — don't wait for the debounce to fire
    setWriteLock(current);

    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeTimer.current = null;
      // Update pendingWriteRef to what we actually send (state may have changed during debounce)
      const toWrite = JSON.stringify({ p: state.players, m: state.currentMatch });
      setWriteLock(toWrite);
      writeTeamState(teamId, state.players, state.currentMatch);
    }, DEBOUNCE_MS);

    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [state, teamId, deviceId, isViewer]);

  return null;
}
