/**
 * Sistema de presencia en tiempo real usando Firebase Realtime Database.
 *
 * Cómo funciona:
 * - Al abrir la app: escribe { online: true, lastSeen: now } en /presence/{uid}
 * - Al cerrar la app / perder conexión: Firebase activa onDisconnect
 *   y escribe { online: false, lastSeen: now } automáticamente desde el servidor.
 * - El home solo muestra jugadores con online: true en RTDB.
 *
 * Esto garantiza que SOLO los usuarios con la app abierta aparezcan como disponibles.
 */
import { ref, onValue, onDisconnect, set, serverTimestamp, off } from 'firebase/database';
import { doc, updateDoc } from 'firebase/firestore';
import { rtdb, db } from './firebase';

export interface PresenceData {
  online: boolean;
  lastSeen: number | null;
}

/**
 * Registra presencia del usuario actual.
 * Llámalo una vez cuando el usuario inicia sesión (en _layout.tsx).
 * Devuelve una función para limpiar (marcar offline manualmente si es necesario).
 */
export const registerPresence = (uid: string): (() => void) => {
  const presenceRef = ref(rtdb, `presence/${uid}`);

  // Configurar qué pasa cuando se desconecta (lo ejecuta el servidor de Firebase)
  onDisconnect(presenceRef).set({
    online: false,
    lastSeen: serverTimestamp(),
  });

  // Marcar como online ahora en RTDB
  set(presenceRef, {
    online: true,
    lastSeen: serverTimestamp(),
  });

  // Resetear status a 'available' en Firestore al abrir la app.
  // Esto corrige el caso donde el usuario cerró la app mientras estaba
  // in_game/challenged y el status quedó persistido en AsyncStorage.
  updateDoc(doc(db, 'users', uid), { status: 'available' }).catch(() => {
    // Ignorar errores silenciosamente (ej: sin conexión al arrancar)
  });

  // Devolver función de cleanup (marca offline de forma explícita al hacer logout)
  return () => {
    set(presenceRef, {
      online: false,
      lastSeen: serverTimestamp(),
    });
  };
};

/**
 * Suscribirse a la presencia de un usuario específico.
 */
export const subscribeToPresence = (
  uid: string,
  callback: (data: PresenceData) => void
): (() => void) => {
  const presenceRef = ref(rtdb, `presence/${uid}`);
  onValue(presenceRef, (snap) => {
    if (snap.exists()) {
      callback(snap.val() as PresenceData);
    } else {
      callback({ online: false, lastSeen: null });
    }
  });
  return () => off(presenceRef);
};

/**
 * Suscribirse a la presencia de múltiples usuarios.
 * Devuelve un Map<uid, online: boolean>.
 */
export const subscribeToAllPresence = (
  callback: (presence: Map<string, boolean>) => void
): (() => void) => {
  const presenceRef = ref(rtdb, 'presence');
  onValue(presenceRef, (snap) => {
    const map = new Map<string, boolean>();
    if (snap.exists()) {
      const data = snap.val() as Record<string, PresenceData>;
      for (const [uid, val] of Object.entries(data)) {
        map.set(uid, val.online === true);
      }
    }
    callback(map);
  });
  return () => off(presenceRef);
};
