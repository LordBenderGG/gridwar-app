import { update, ref } from 'firebase/database';
import { doc, updateDoc } from 'firebase/firestore';
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
    id: 'time_reduce',
    name: 'Tiempo Reducido',
    nameEn: 'Time Cut',
    description: 'Reduce el tiempo del rival a 15 segundos en su próximo turno',
    descriptionEn: "Reduces opponent's time to 15 seconds next turn",
    cost: 2,
    icon: '⏱️',
    color: '#FF6B35',
  },
  {
    id: 'sabotage',
    name: 'Sabotaje',
    nameEn: 'Sabotage',
    description: 'Mueve la última ficha del rival a una celda aleatoria libre',
    descriptionEn: "Moves opponent's last piece to a random free cell",
    cost: 3,
    icon: '💣',
    color: '#FF3B30',
  },
  {
    id: 'freeze',
    name: 'Congelación',
    nameEn: 'Freeze',
    description: 'El rival pierde su siguiente turno',
    descriptionEn: 'Opponent skips their next turn',
    cost: 2,
    icon: '❄️',
    color: '#00BFFF',
  },
  {
    id: 'blind',
    name: 'Visión Bloqueada',
    nameEn: 'Blind',
    description: 'Oculta el tablero al rival en su próximo turno',
    descriptionEn: "Hides the board from the opponent for their next turn",
    cost: 2,
    icon: '🙈',
    color: '#9B59B6',
  },
  {
    id: 'turbo',
    name: 'Turbo',
    nameEn: 'Turbo',
    description: 'Reinicia tu timer a 30 segundos',
    descriptionEn: 'Resets your timer to 30 seconds',
    cost: 1,
    icon: '⚡',
    color: '#FFD700',
  },
  {
    id: 'shield',
    name: 'Escudo',
    nameEn: 'Shield',
    description: 'Bloquea el próximo comodín del rival',
    descriptionEn: "Blocks the opponent's next wildcard",
    cost: 2,
    icon: '🛡️',
    color: '#34C759',
  },
  {
    id: 'teleport',
    name: 'Teletransporte',
    nameEn: 'Teleport',
    description: 'Mueve una ficha tuya a otra celda libre (y conservas tu turno)',
    descriptionEn: 'Move one of your pieces to a free cell (keep your turn)',
    cost: 3,
    icon: '🌀',
    color: '#00F5FF',
  },
  {
    id: 'confusion',
    name: 'Confusión',
    nameEn: 'Confusion',
    description: 'Invierte X y O en el tablero del rival por 1 turno',
    descriptionEn: "Swaps X and O visually on opponent's board for 1 turn",
    cost: 2,
    icon: '😵',
    color: '#FF69B4',
  },
];

export const getWildcard = (id: string): Wildcard | undefined => {
  return WILDCARDS.find((w) => w.id === id);
};

export const canUseWildcard = (
  playerGems: number,
  wildcardCost: number,
  wildcardUsed: boolean,
  shieldActive: boolean
): boolean => {
  if (wildcardUsed) return false;
  if (shieldActive) return false;
  if (playerGems < wildcardCost) return false;
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
 * @param playerGems    Gems actuales del jugador (para descontar)
 * @param mySymbol      Símbolo del jugador que usa el comodín ('X' u 'O')
 */
export const applyWildcard = async (
  gameId: string,
  wildcardId: string,
  playerUid: string,
  opponentUid: string,
  board: CellValue[],
  playerGems: number,
  mySymbol: 'X' | 'O'
): Promise<void> => {
  const wildcard = getWildcard(wildcardId);
  if (!wildcard) return;

  // Descontar gems del jugador
  const newGems = Math.max(0, playerGems - wildcard.cost);
  await updateDoc(doc(db, 'users', playerUid), { gems: newGems });

  // Marcar que ya usó un comodín este turno
  const updates: Record<string, any> = { wildcardUsed: true };

  const opponentSymbol: CellValue = mySymbol === 'X' ? 'O' : 'X';

  switch (wildcardId) {
    // ── ⏱️ TIEMPO REDUCIDO ──────────────────────────────────────────────
    // Activa el flag; makeMove lo limpiará cuando el turno reducido termine.
    case 'time_reduce':
      updates['rivalTimerReduced'] = true;
      break;

    // ── 💣 SABOTAJE ──────────────────────────────────────────────────────
    // Busca la ÚLTIMA ficha del rival y la mueve a una celda libre aleatoria.
    // Usa mySymbol para derivar el símbolo del rival correctamente.
    case 'sabotage': {
      // Buscar la última ficha del rival (recorriendo el array al revés)
      const lastOpponentIdx = [...board]
        .map((v, i) => ({ v, i }))
        .reverse()
        .find(({ v }) => v === opponentSymbol)?.i;

      if (lastOpponentIdx !== undefined) {
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
        }
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

    // ── 🙈 VISIÓN BLOQUEADA ──────────────────────────────────────────────
    // El rival llega a su turno con blindActive=true → ve overlay.
    // makeMove lo limpia cuando el rival hace su movimiento.
    // (Ya no usamos setTimeout en el cliente — el cleanup lo hace el servidor)
    case 'blind':
      updates['blindActive'] = true;
      updates['blindTarget'] = opponentUid;
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
