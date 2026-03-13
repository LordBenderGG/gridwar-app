import { update, ref } from 'firebase/database';
import { doc, updateDoc, runTransaction } from 'firebase/firestore';
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
    description: 'Reduce el tiempo del rival a 15 segundos este turno',
    descriptionEn: "Reduces opponent's time to 15 seconds this turn",
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
    description: 'Oculta el tablero al rival por 5 segundos',
    descriptionEn: "Hides the board from the opponent for 5 seconds",
    cost: 2,
    icon: '🙈',
    color: '#9B59B6',
  },
  {
    id: 'turbo',
    name: 'Turbo',
    nameEn: 'Turbo',
    description: 'Agrega 15 segundos extra a tu turno',
    descriptionEn: 'Adds 15 extra seconds to your turn',
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
    description: 'Mueve una ficha tuya a otra celda libre',
    descriptionEn: 'Move one of your pieces to a free cell',
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
    icon: '🌀',
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
  if (playerGems < wildcardCost) return false;
  return true;
};

export const applyWildcard = async (
  gameId: string,
  wildcardId: string,
  playerUid: string,
  opponentUid: string,
  board: CellValue[],
  playerGems: number
): Promise<void> => {
  const wildcard = getWildcard(wildcardId);
  if (!wildcard) return;

  const newGems = playerGems - wildcard.cost;
  await updateDoc(doc(db, 'users', playerUid), { gems: newGems });

  const updates: Record<string, any> = { wildcardUsed: true };

  switch (wildcardId) {
    case 'time_reduce':
      updates['rivalTimerReduced'] = true;
      break;

    case 'sabotage': {
      const opponentSymbol = board.includes('X') ? 'O' : 'X';
      const lastOpponentCell = [...board]
        .map((v, i) => ({ v, i }))
        .reverse()
        .find(({ v }) => v === opponentSymbol);
      if (lastOpponentCell !== undefined) {
        const freeCells = board
          .map((v, i) => ({ v, i }))
          .filter(({ v, i }) => v === '' && i !== lastOpponentCell.i)
          .map(({ i }) => i);
        if (freeCells.length > 0) {
          const newBoard = [...board];
          const randomCell = freeCells[Math.floor(Math.random() * freeCells.length)];
          newBoard[randomCell] = newBoard[lastOpponentCell.i];
          newBoard[lastOpponentCell.i] = '';
          updates['board'] = newBoard;
        }
      }
      break;
    }

    case 'freeze':
      updates['frozenPlayer'] = opponentUid;
      break;

    case 'blind':
      updates['blindActive'] = true;
      updates['blindTarget'] = opponentUid;
      setTimeout(async () => {
        await update(ref(rtdb, `games/${gameId}`), {
          blindActive: false,
          blindTarget: null,
        });
      }, 5000);
      break;

    case 'turbo':
      updates['turboActive'] = true;
      updates['turboPlayer'] = playerUid;
      break;

    case 'shield':
      updates['shieldActive'] = true;
      updates['shieldPlayer'] = playerUid;
      break;

    case 'teleport':
      updates['teleportPending'] = true;
      updates['teleportPlayer'] = playerUid;
      break;

    case 'confusion':
      updates['confusionActive'] = true;
      updates['confusionTarget'] = opponentUid;
      break;
  }

  await update(ref(rtdb, `games/${gameId}`), updates);
};
