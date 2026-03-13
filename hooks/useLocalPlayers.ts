import { useEffect, useState } from 'react';
import { startDiscovery, startBroadcast, stopBroadcast, LocalPlayer } from '../services/localNetwork';
import { UserProfile } from '../services/auth';

/**
 * Hook for discovering and broadcasting presence to other TIKTAK players
 * on the same local WiFi network.
 *
 * Call this hook when the user switches to "local" mode.
 * Pass `active=false` to stop discovery and broadcasting.
 */
export function useLocalPlayers(user: UserProfile | null, active: boolean) {
  const [localPlayers, setLocalPlayers] = useState<LocalPlayer[]>([]);

  useEffect(() => {
    if (!active || !user) {
      stopBroadcast();
      setLocalPlayers([]);
      return;
    }

    // Broadcast our own presence
    startBroadcast(user.uid, user.username, user.avatar, user.rank, user.points);

    // Discover other players
    const unsub = startDiscovery((players) => {
      // Filter out self
      setLocalPlayers(players.filter((p) => p.uid !== user.uid));
    });

    return () => {
      unsub();
      stopBroadcast();
    };
  }, [active, user?.uid]);

  return { localPlayers };
}
