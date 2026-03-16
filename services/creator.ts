/**
 * services/creator.ts
 * Sistema de royalty para el creador de la app.
 * Completamente invisible para los demás jugadores.
 * El 2% de cada transacción de gemas va al creador.
 */

import { doc, getDoc, setDoc, increment, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { auth } from './firebase';

const CREATOR_EMAIL = 'carlosbetancur1205@gmail.com';
const META_DOC = doc(db, 'meta', 'app');

type RoyaltySource =
  | 'match'
  | 'rewarded_ad'
  | 'global_entry'
  | 'shop_purchase'
  | 'tournament_prize'
  | 'manual';

interface RoyaltyOptions {
  source?: RoyaltySource;
  eventId?: string;
}

const SOURCE_MAX_AMOUNT: Record<RoyaltySource, number> = {
  match: 40,
  rewarded_ad: 25,
  global_entry: 100,
  shop_purchase: 500,
  tournament_prize: 10000,
  manual: 100,
};

const sanitizeAmountBySource = (amount: number, source: RoyaltySource): number => {
  if (!Number.isFinite(amount)) return 0;
  const safe = Math.floor(amount);
  if (safe < 1) return 0;
  return Math.min(safe, SOURCE_MAX_AMOUNT[source]);
};

const safeEventKey = (source: RoyaltySource, eventId?: string): string | null => {
  if (!eventId) return null;
  const cleaned = eventId.trim();
  if (!cleaned) return null;
  const normalized = cleaned.replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 80);
  if (!normalized) return null;
  return `${source}:${normalized}`;
};

/**
 * Registra el UID del creador en /meta/app si el usuario actual
 * es el creador de la app. Llamar al iniciar sesión.
 */
export const registerCreatorIfNeeded = async (uid: string, email: string): Promise<void> => {
  if (email?.toLowerCase().trim() !== CREATOR_EMAIL) return;
  try {
    await setDoc(META_DOC, { creatorUid: uid }, { merge: true });
  } catch {
    // silencioso
  }
};

/**
 * Obtiene el UID del creador de /meta/app.
 * Cacheable: se llama raramente.
 */
let _cachedCreatorUid: string | null = null;
let _cacheTs = 0;

export const getCreatorUid = async (): Promise<string | null> => {
  // Cache 5 minutos
  const now = Date.now();
  if (_cachedCreatorUid && now - _cacheTs < 5 * 60 * 1000) return _cachedCreatorUid;
  try {
    const snap = await getDoc(META_DOC);
    if (snap.exists()) {
      _cachedCreatorUid = snap.data().creatorUid ?? null;
      _cacheTs = now;
    }
  } catch {
    // silencioso
  }
  return _cachedCreatorUid;
};

/**
 * Añade el 2% de una transacción de gemas al creador.
 * @param amount Número de gemas gastadas/generadas en la transacción
 * Llamar de forma no bloqueante (no await obligatorio en flujo principal).
 */
export const addCreatorRoyalty = async (amount: number): Promise<void> => {
  await addCreatorRoyaltySafe(amount, { source: 'manual' });
};

/**
 * Versión con protección por fuente + deduplicación por evento.
 */
export const addCreatorRoyaltySafe = async (
  amount: number,
  options: RoyaltyOptions = {}
): Promise<void> => {
  const source = options.source ?? 'manual';
  const safeAmount = sanitizeAmountBySource(amount, source);
  if (!safeAmount) return;
  const royalty = Math.max(1, Math.floor(safeAmount * 0.02));
  const eventKey = safeEventKey(source, options.eventId);

  try {
    const creatorUid = await getCreatorUid();
    if (!creatorUid) return;

    const actorUid = auth.currentUser?.uid ?? null;
    await runTransaction(db, async (tx) => {
      if (eventKey) {
        const eventRef = doc(db, 'meta', 'royaltyEvents', 'events', eventKey);
        const eventSnap = await tx.get(eventRef);
        if (eventSnap.exists()) return;
        tx.set(eventRef, {
          source,
          amount: safeAmount,
          royalty,
          actorUid,
          createdAt: serverTimestamp(),
        });
      }

      tx.update(doc(db, 'users', creatorUid), {
        gems: increment(royalty),
      });
    });
  } catch {
    // silencioso — nunca bloquear flujo principal
  }
};
