import { useEffect, useRef } from 'react';
import { ref, update, set, remove, onValue, onDisconnect } from 'firebase/database';
import { db } from '../firebase';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';

const DEBOUNCE_MS = 400;

export function FirebaseSync() {
  const { teamId, deviceId, isViewer, teamName, allTeams, switchTeam, _notifyTeamDeleted } = useTeam();
  const state    = useAppState();
  const dispatch = useAppDispatch();

  const writeTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReceivedRef          = useRef<string>('');
  const prevTeamIdRef            = useRef<string>(teamId);
  const isSwitchingRef           = useRef<boolean>(false);
  const hasReceivedFirstUpdateRef = useRef<boolean>(false);
  // Keep a stable ref to allTeams for use inside callbacks without adding to deps
  const allTeamsRef     = useRef(allTeams);
  useEffect(() => { allTeamsRef.current = allTeams; }, [allTeams]);

  function writeTeamState(id: string, name: string, players: unknown, currentMatch: unknown) {
    update(ref(db, `teams/${id}`), {
      _writtenBy: deviceId,
      state: { players, currentMatch },
      lastActive: Date.now(),
    });
    set(ref(db, `teamIndex/${id}`), name || `Team ${id.slice(0, 4).toUpperCase()}`);
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

  // On team switch: flush pending write for old team, block writes until new state loads
  useEffect(() => {
    if (prevTeamIdRef.current === teamId) return;

    if (writeTimer.current) {
      clearTimeout(writeTimer.current);
      writeTimer.current = null;
      writeTeamState(prevTeamIdRef.current, teamName, state.players, state.currentMatch);
    }

    prevTeamIdRef.current = teamId;
    lastReceivedRef.current = '';
    isSwitchingRef.current = true;
    hasReceivedFirstUpdateRef.current = false;
    dispatch({ type: 'RESET_TO_DEFAULT' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  // Listen for changes from Firebase (including deletion)
  useEffect(() => {
    const teamRef = ref(db, `teams/${teamId}`);
    const unsubscribe = onValue(teamRef, (snapshot) => {
      const data = snapshot.val();

      // Team was deleted by another coach
      if (data?.deleted) {
        _notifyTeamDeleted();
        isSwitchingRef.current = true;
        dispatch({ type: 'RESET_TO_DEFAULT' });
        // Auto-switch to the first available other team
        const other = allTeamsRef.current.find((t) => t.id !== teamId);
        if (other) switchTeam(other.id);
        return;
      }

      if (!data?.state?.players || !data?.state?.currentMatch) {
        isSwitchingRef.current = false;
        hasReceivedFirstUpdateRef.current = true;
        return;
      }

      if (!isViewer) {
        if (!isSwitchingRef.current) {
          if (data._writtenBy === deviceId) return;
          if (writeTimer.current !== null) return;
        }
      }

      const incoming = JSON.stringify({ p: data.state.players, m: data.state.currentMatch });
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

    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeTimer.current = null;
      writeTeamState(teamId, teamName, state.players, state.currentMatch);
    }, DEBOUNCE_MS);

    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [state, teamId, deviceId, isViewer]);

  return null;
}
