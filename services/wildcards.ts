import { update, ref } from 'firebase/database';
import { doc, updateDoc, increment, runTransaction } from 'firebase/firestore';
import { rtdb, db } from './firebase';
import { CellValue } from './game';

export interface Wildcard {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  cost: number;
  icon: string;
  color: string;
}

export const WILDCARDS: Wildcard[] = [
  {
    id: 'turbo',
    name: 'Turbo',
    nameEn: 'Turbo',
    description: 'Te da 30 segundos completos para pensar tu jugada',
    descriptionEn: 'Gives you a full 30 seconds to make your move',
    cost: 8,
    icon: '⚡',
    color: '#FFD700',
  },
  {
    id: 'time_reduce',
    name: 'Tiempo Reducido',
    nameEn: 'Time Cut',
    description: 'El rival solo tendrá 15 segundos para hacer su próxima jugada',
    descriptionEn: 'Opponent only gets 15 seconds for their next move',
    cost: 12,
    icon: '⏱️',
    color: '#FF6B35',
  },
  {
    id: 'teleport',
    name: 'Teletransporte',
    nameEn: 'Teleport',
    description: 'Mueve una de tus fichas a cualquier celda vacía sin perder tu turno',
    descriptionEn: 'Move one of your pieces to any empty cell without losing your turn',
    cost: 12,
    icon: '🌀',
    color: '#00F5FF',
  },
  {
    id: 'shield',
    name: 'Escudo',
    nameEn: 'Shield',
    description: 'Bloquea el próximo comodín que intente usarte el rival',
    descriptionEn: "Blocks the next wildcard your opponent tries to use on you",
    cost: 15,
    icon: '🛡️',
    color: '#34C759',
  },
  {
    id: 'confusion',
    name: 'Confusión',
    nameEn: 'Confusion',
    description: 'Las fichas X y O del rival aparecen al revés en su tablero por 1 jugada',
    descriptionEn: "Opponent's X and O pieces appear swapped on their board for 1 move",
    cost: 15,
    icon: '😵',
    color: '#FF69B4',
  },
  {
    id: 'sabotage',
    name: 'Sabotaje',
    nameEn: 'Sabotage',
    description: 'Tu última ficha colocada por el rival se mueve a un lugar aleatorio',
    descriptionEn: "The opponent's last placed piece moves to a random spot",
    cost: 18,
    icon: '💣',
    color: '#FF3B30',
  },
  {
    id: 'freeze',
    name: 'Congelación',
    nameEn: 'Freeze',
    description: 'El rival se queda sin poder jugar en su próximo turno',
    descriptionEn: 'Opponent cannot make a move on their next turn',
    cost: 20,
    icon: '❄️',
    color: '#00BFFF',
  },
  {
    id: 'earthquake',
    name: 'Terremoto',
    nameEn: 'Earthquake',
    description: 'Todas las fichas del rival se reubican al azar en el tablero',
    descriptionEn: "All of the opponent's pieces are randomly repositioned on the board",
    cost: 20,
    icon: '💥',
    color: '#FF8C00',
  },
];

export const getWildcard = (id: string): Wildcard | undefined => {
  return WILDCARDS.find((w) => w.id === id);
};

export const canUseWildcard = (
  wildcardCount: number,
  wildcardUsed: boolean,
  shieldActive: boolean
): boolean => {
  if (wildcardUsed) return false;
  if (shieldActive) return false;
  if (wildcardCount <= 0) return false;
  return true;
};

/**
 * Aplica un comodín en la partida.
 *
 * Reglas de diseño:
 * - El jugador usa el comodín en SU turno ANTES de hacer su movimiento.
 * - Los efectos se activan con flags en RTDB.
 * - makeMove / skipTurn limpian TODOS los flags al cambiar de turno,
 *   garantizando que cada efecto dura exactamente 1 turno del afectado.
 * - Turbo es excepción: afecta al jugador actual, no al rival.
 * - Teleport: activa modo selección en el cliente; no cambia el turno.
 *
 * @param gameId        ID de la partida en RTDB/Firestore
 * @param wildcardId    ID del comodín a aplicar
 * @param playerUid     UID del jugador que lo usa
 * @param opponentUid   UID del rival
 * @param board         Estado actual del tablero
 * @param mySymbol      Símbolo del jugador que usa el comodín ('X' u 'O')
 * @returns true si el comodín fue aplicado exitosamente, false si no se pudo aplicar
 */
export const applyWildcard = async (
  gameId: string,
  wildcardId: string,
  playerUid: string,
  opponentUid: string,
  board: CellValue[],
  mySymbol: 'X' | 'O'
): Promise<boolean> => {
  const wildcard = getWildcard(wildcardId);
  if (!wildcard) return false;

  // Marcar que ya usó un comodín este turno
  const updates: Record<string, any> = { wildcardUsed: true };

  const opponentSymbol: CellValue = mySymbol === 'X' ? 'O' : 'X';

  switch (wildcardId) {
    // ── ⏱️ TIEMPO REDUCIDO ──────────────────────────────────────────────
    // Activa el flag; makeMove lo limpiará cuando el turno reducido termine.
    case 'time_reduce':
      updates['rivalTimerReduced'] = true;
      updates['rivalTimerReducedTarget'] = opponentUid;
      break;

    // ── 💣 SABOTAJE ──────────────────────────────────────────────────────
    // Busca la ÚLTIMA ficha del rival y la mueve a una celda libre aleatoria.
    // Si el rival no tiene fichas aún, retorna false (no cobrar gems).
    case 'sabotage': {
      const lastOpponentIdx = [...board]
        .map((v, i) => ({ v, i }))
        .reverse()
        .find(({ v }) => v === opponentSymbol)?.i;

      if (lastOpponentIdx === undefined) {
        // No hay fichas del rival — no aplicar ni cobrar
        return false;
      }

      const freeCells = board
        .map((v, i) => ({ v, i }))
        .filter(({ v, i }) => v === '' && i !== lastOpponentIdx)
        .map(({ i }) => i);

      if (freeCells.length > 0) {
        const newBoard = [...board];
        const randomCell = freeCells[Math.floor(Math.random() * freeCells.length)];
        newBoard[randomCell] = opponentSymbol;
        newBoard[lastOpponentIdx] = '';
        updates['board'] = newBoard;
      } else {
        // Tablero casi lleno: no hay celdas libres para mover la ficha — no cobrar
        return false;
      }
      break;
    }

    // ── ❄️ CONGELACIÓN ───────────────────────────────────────────────────
    // Marca al rival como congelado. handleCellPress detecta esto cuando el
    // rival intenta mover y llama skipTurn en lugar de makeMove.
    // IMPORTANTE: NO sobreescribir wildcardUsed=true aquí de forma que bloquee
    // el movimiento del propio jugador — wildcardUsed solo bloquea otro comodín.
    case 'freeze':
      updates['frozenPlayer'] = opponentUid;
      break;

    // ── 💥 TERREMOTO ─────────────────────────────────────────────────────
    // Al inicio del turno del rival, sus fichas se reubican aleatoriamente.
    // La animación de sacudida la ejecuta gameId.tsx al detectar earthquakeActive.
    case 'earthquake':
      updates['earthquakeActive'] = true;
      updates['earthquakeTarget'] = opponentUid;
      break;

    // ── ⚡ TURBO ─────────────────────────────────────────────────────────
    // Reinicia el timerStart para que el jugador tenga 30s desde ahora.
    // También activa el flag visual para mostrar ⚡ en el Timer.
    case 'turbo':
      updates['turboActive'] = true;
      updates['turboPlayer'] = playerUid;
      updates['timerStart'] = Date.now(); // reiniciar el timer
      break;

    // ── 🛡️ ESCUDO ────────────────────────────────────────────────────────
    // Activa el flag; WildcardBar en el cliente del rival lo detecta y
    // bloquea el uso de comodines mientras esté activo.
    case 'shield':
      updates['shieldActive'] = true;
      updates['shieldPlayer'] = playerUid;
      break;

    // ── 🌀 TELETRANSPORTE ────────────────────────────────────────────────
    // Activa modo selección en el cliente. El jugador NO pierde su turno:
    // primero elige origen+destino (teleport), luego sigue con su movimiento normal.
    // El Board en gameId.tsx maneja el modo teleport localmente y luego
    // llama applyTeleportMove para ejecutar el movimiento en RTDB.
    case 'teleport':
      updates['teleportPending'] = true;
      updates['teleportPlayer'] = playerUid;
      // No marcar wildcardUsed=true aquí para no bloquear el movimiento posterior
      // (ya se marcó arriba; el Board ignora wildcardUsed durante el teleport)
      break;

    // ── 😵 CONFUSIÓN ─────────────────────────────────────────────────────
    // Invierte X y O visualmente en el tablero del rival por 1 turno.
    // Board.tsx ya maneja esto con confusionActive + confusionTarget.
    case 'confusion':
      updates['confusionActive'] = true;
      updates['confusionTarget'] = opponentUid;
      break;
  }

  await update(ref(rtdb, `games/${gameId}`), updates);

  // Descontar 1 del inventario en Firestore con runTransaction para evitar
  // inventario negativo en race conditions (doble tap simultáneo).
  const LEGACY_KEY: Record<string, string> = {
    time_reduce: 'tiempo',
    shield: 'escudo',
    sabotage: 'bomba',
    earthquake: 'ciego',
  };
  const userRef = doc(db, 'users', playerUid);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(userRef);
    if (!snap.exists()) return;
    const data = snap.data() as any;
    const current = Number(data?.wildcards?.[wildcardId] ?? 0);
    const legacyKey = LEGACY_KEY[wildcardId];
    const currentLegacy = legacyKey ? Number(data?.wildcards?.[legacyKey] ?? 0) : 0;

    if (current > 0) {
      transaction.update(userRef, { [`wildcards.${wildcardId}`]: increment(-1) });
      return;
    }
    if (currentLegacy > 0) {
      transaction.update(userRef, {
        [`wildcards.${legacyKey}`]: 0,
        [`wildcards.${wildcardId}`]: Math.max(0, currentLegacy - 1),
      });
    }
  });

  return true;
};

/**
 * Ejecuta el movimiento de teletransporte: mueve una ficha propia de `from` a `to`.
 * Se llama desde gameId.tsx cuando el jugador completa la selección origen+destino.
 * El turno NO cambia — el jugador conserva su turno para hacer su movimiento normal.
 */
export const applyTeleportMove = async (
  gameId: string,
  board: CellValue[],
  from: number,
  to: number,
  mySymbol: 'X' | 'O'
): Promise<void> => {
  if (board[from] !== mySymbol) return; // seguridad: solo mover ficha propia
  if (board[to] !== '') return;         // solo a celda vacía

  const newBoard = [...board];
  newBoard[to] = mySymbol;
  newBoard[from] = '';

  await update(ref(rtdb, `games/${gameId}`), {
    board: newBoard,
    teleportPending: false,
    teleportPlayer: null,
  });
};
