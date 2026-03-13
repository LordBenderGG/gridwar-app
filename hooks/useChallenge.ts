import { useEffect, useState } from 'react';
import { subscribeToIncomingChallenges, Challenge } from '../services/challenge';

/**
 * Hook that listens for incoming challenges for the current user.
 * Returns the list of pending challenges and the first (most urgent) one.
 * Automatically cleans up the listener on unmount.
 */
export function useChallenge(uid: string | null) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    if (!uid) return;

    const unsub = subscribeToIncomingChallenges(uid, (incoming) => {
      setChallenges(incoming);
    });

    return () => unsub();
  }, [uid]);

  return {
    challenges,
    firstChallenge: challenges.length > 0 ? challenges[0] : null,
    hasChallenges: challenges.length > 0,
  };
}
