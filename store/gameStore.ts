import { create } from 'zustand';
import { GameState, GameDoc, CellValue } from '../services/game';

interface GameStore {
  gameDoc: GameDoc | null;
  gameState: GameState | null;
  mySymbol: 'X' | 'O' | null;
  setGameDoc: (doc: GameDoc | null) => void;
  setGameState: (state: GameState | null) => void;
  setMySymbol: (symbol: 'X' | 'O') => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  gameDoc: null,
  gameState: null,
  mySymbol: null,
  setGameDoc: (gameDoc) => set({ gameDoc }),
  setGameState: (gameState) => set({ gameState }),
  setMySymbol: (mySymbol) => set({ mySymbol }),
  clearGame: () => set({ gameDoc: null, gameState: null, mySymbol: null }),
}));
