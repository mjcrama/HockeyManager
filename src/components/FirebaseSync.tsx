import { useEffect, useRef } from 'react';
import { ref, set, onValue } from 'firebase/database';
import { db } from '../firebase';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useTeam } from '../context/TeamContext';

const DEBOUNCE_MS = 400;

export function FirebaseSync() {
  const { teamId, deviceId, isViewer } = useTeam();
  const state = useAppState();
  const dispatch = useAppDispatch();

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last state we received from Firebase to avoid echoing it back
  const lastReceivedRef = useRef<string>('');

  // Always listen for changes from other coaches
  useEffect(() => {
    const teamRef = ref(db, `teams/${teamId}`);
    const unsubscribe = onValue(teamRef, (snapshot) => {
      const data = snapshot.val();
      if (!data?.state?.players || !data?.state?.currentMatch) return;
      // Viewers always accept data; coaches skip their own writes to avoid echo
      if (!isViewer && data._writtenBy === deviceId) return;
      // Don't overwrite local changes that are still waiting to be written
      if (!isViewer && writeTimer.current !== null) return;

      const incoming = JSON.stringify({ p: data.state.players, m: data.state.currentMatch });
      lastReceivedRef.current = incoming;

      dispatch({
        type: 'LOAD_REMOTE_STATE',
        payload: { players: data.state.players, currentMatch: data.state.currentMatch },
      });
    });
    return () => unsubscribe();
  }, [teamId, deviceId, isViewer, dispatch]);

  // Coaches: debounced write on every state change
  useEffect(() => {
    if (isViewer) return;

    // Don't echo back what we just received
    const current = JSON.stringify({ p: state.players, m: state.currentMatch });
    if (current === lastReceivedRef.current) return;

    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      const teamRef = ref(db, `teams/${teamId}`);
      set(teamRef, {
        _writtenBy: deviceId,
        state: {
          players: state.players,
          currentMatch: state.currentMatch,
        },
        lastActive: Date.now(),
      });
    }, DEBOUNCE_MS);

    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [state, teamId, deviceId, isViewer]);

  return null;
}
