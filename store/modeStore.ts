import { create } from 'zustand';

type GameMode = 'global' | 'local';

interface ModeStore {
  mode: GameMode;
  setMode: (mode: GameMode) => void;
}

export const useModeStore = create<ModeStore>((set) => ({
  mode: 'global',
  setMode: (mode) => set({ mode }),
}));
