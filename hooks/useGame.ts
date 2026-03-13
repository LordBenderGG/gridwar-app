import { useEffect, useState } from 'react';
import { subscribeToGame, subscribeToGameDoc, GameState, GameDoc } from '../services/game';

interface UseGameResult {
  gameState: GameState | null;
  gameDoc: GameDoc | null;
}

/**
 * Hook that subscribes to both the Realtime Database game state
 * and the Firestore game document for a given gameId.
 * Automatically cleans up listeners on unmount.
 */
export function useGame(gameId: string | null): UseGameResult {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameDoc, setGameDoc] = useState<GameDoc | null>(null);

  useEffect(() => {
    if (!gameId) return;

    const unsubState = subscribeToGame(gameId, (state) => {
      setGameState(state);
    });

    const unsubDoc = subscribeToGameDoc(gameId, (doc) => {
      setGameDoc(doc);
    });

    return () => {
      unsubState();
      unsubDoc();
    };
  }, [gameId]);

  return { gameState, gameDoc };
}
