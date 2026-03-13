// Algoritmo Minimax para IA de 3 en raya
import { CellValue } from '../services/game';

const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const checkWinnerMinimax = (board: CellValue[]): CellValue | null => {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
};

const minimax = (
  board: CellValue[],
  isMaximizing: boolean,
  depth: number
): number => {
  const winner = checkWinnerMinimax(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (board.every((c) => c !== '')) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') {
        const newBoard = [...board];
        newBoard[i] = 'O';
        best = Math.max(best, minimax(newBoard, false, depth + 1));
      }
    }
    return best;
  } else {
    let best = Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === '') {
        const newBoard = [...board];
        newBoard[i] = 'X';
        best = Math.min(best, minimax(newBoard, true, depth + 1));
      }
    }
    return best;
  }
};

export const getBestMove = (board: CellValue[]): number => {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === '') {
      const newBoard = [...board];
      newBoard[i] = 'O';
      const score = minimax(newBoard, false, 0);
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
};

export const getEasyMove = (board: CellValue[]): number => {
  const empty = board.map((v, i) => ({ v, i })).filter(({ v }) => v === '');
  return empty[Math.floor(Math.random() * empty.length)]?.i ?? -1;
};

export const getMediumMove = (board: CellValue[]): number => {
  // 50% optimo, 50% aleatorio
  return Math.random() > 0.5 ? getBestMove(board) : getEasyMove(board);
};
