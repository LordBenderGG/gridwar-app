/**
 * localNetwork.ts
 * WiFi local player discovery using react-native-zeroconf (mDNS).
 *
 * When a user switches to "local" mode, they:
 *  1. Start broadcasting their presence on the local network via _tiktak._tcp
 *  2. Scan for other TIKTAK players on the same network
 *
 * This enables local WiFi matches without needing an internet connection.
 */

import Zeroconf from 'react-native-zeroconf';

export interface LocalPlayer {
  uid: string;
  username: string;
  avatar: string;
  rank: string;
  points: number;
  host: string;
  port: number;
}

const SERVICE_TYPE = '_tiktak';
const SERVICE_PROTOCOL = '_tcp';
const SERVICE_PORT = 9898;

let zeroconf: Zeroconf | null = null;
let localListeners: ((players: LocalPlayer[]) => void)[] = [];
const discoveredPlayers: Map<string, LocalPlayer> = new Map();

function getZeroconf(): Zeroconf {
  if (!zeroconf) {
    zeroconf = new Zeroconf();
  }
  return zeroconf;
}

function notifyListeners() {
  const playerList = Array.from(discoveredPlayers.values());
  localListeners.forEach((cb) => cb(playerList));
}

/**
 * Start broadcasting this player's presence on the local network.
 */
export const startBroadcast = (
  uid: string,
  username: string,
  avatar: string,
  rank: string,
  points: number
): void => {
  try {
    const zc = getZeroconf();
    zc.publishService(
      SERVICE_TYPE,
      SERVICE_PROTOCOL,
      'local.',
      `tiktak_${uid}`,
      SERVICE_PORT,
      { uid, username, avatar, rank, points: String(points) }
    );
  } catch (e) {
    console.warn('[LocalNetwork] Failed to broadcast:', e);
  }
};

/**
 * Stop broadcasting this player's presence.
 */
export const stopBroadcast = (): void => {
  try {
    const zc = getZeroconf();
    zc.unpublishService(`tiktak_`);
  } catch (e) {
    console.warn('[LocalNetwork] Failed to stop broadcast:', e);
  }
};

/**
 * Start scanning for other TIKTAK players on the local network.
 * Returns an unsubscribe function.
 */
export const startDiscovery = (
  onPlayersUpdated: (players: LocalPlayer[]) => void
): (() => void) => {
  localListeners.push(onPlayersUpdated);

  try {
    const zc = getZeroconf();

    zc.on('resolved', (service: any) => {
      if (!service.txt?.uid) return;
      const player: LocalPlayer = {
        uid: service.txt.uid,
        username: service.txt.username || 'Jugador',
        avatar: service.txt.avatar || 'avatar_1',
        rank: service.txt.rank || 'Novato',
        points: parseInt(service.txt.points || '0', 10),
        host: service.host,
        port: service.port,
      };
      discoveredPlayers.set(player.uid, player);
      notifyListeners();
    });

    zc.on('remove', (serviceName: string) => {
      // serviceName is like "tiktak_<uid>"
      const uid = serviceName.replace('tiktak_', '');
      discoveredPlayers.delete(uid);
      notifyListeners();
    });

    zc.on('error', (err: any) => {
      console.warn('[LocalNetwork] Zeroconf error:', err);
    });

    zc.scan(SERVICE_TYPE, SERVICE_PROTOCOL, 'local.');
  } catch (e) {
    console.warn('[LocalNetwork] Discovery failed to start:', e);
  }

  return () => {
    localListeners = localListeners.filter((cb) => cb !== onPlayersUpdated);
    if (localListeners.length === 0) {
      try {
        const zc = getZeroconf();
        zc.stop();
        zc.removeDeviceListeners();
      } catch (err) {
        // ignore
      }
    }
  };
};

/**
 * Stop all discovery and clear state.
 */
export const stopDiscovery = (): void => {
  try {
    const zc = getZeroconf();
    zc.stop();
    zc.removeDeviceListeners();
  } catch (e) {
    // ignore
  }
  discoveredPlayers.clear();
  localListeners = [];
};
