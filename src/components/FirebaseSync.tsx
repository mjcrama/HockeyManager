import { useEffect } from 'react';
import { ref, set, onValue, onDisconnect } from 'firebase/database';
import { db } from '../firebase';
import { useAppState, useAppDispatch } from '../context/AppContext';
import { useSession } from '../context/SessionContext';

export function FirebaseSync() {
  const { sessionId, token, isCoach, isViewer } = useSession();
  const state = useAppState();
  const dispatch = useAppDispatch();

  // Coach: schrijf state naar Firebase bij elke wijziging
  useEffect(() => {
    if (!isCoach || !sessionId || !token) return;
    const sessionRef = ref(db, `sessions/${sessionId}`);
    onDisconnect(sessionRef).remove();
    set(sessionRef, {
      token,
      players: state.players,
      currentMatch: state.currentMatch,
      lastActive: Date.now(),
    });
  }, [state, isCoach, sessionId, token]);

  // Viewer: luister naar Firebase en update lokale state
  useEffect(() => {
    if (!isViewer || !sessionId) return;
    const sessionRef = ref(db, `sessions/${sessionId}`);
    const unsubscribe = onValue(sessionRef, (snapshot) => {
      const data = snapshot.val();
      if (!data?.players || !data?.currentMatch) return;
      dispatch({
        type: 'LOAD_REMOTE_STATE',
        payload: { players: data.players, currentMatch: data.currentMatch },
      });
    });
    return () => unsubscribe();
  }, [isViewer, sessionId, dispatch]);

  return null;
}
