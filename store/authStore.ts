import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { UserProfile } from '../services/auth';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  updateUser: (data: Partial<UserProfile>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      loading: true,
      setUser: (user) =>
        set((state) => {
          if (!user) return { user: null };
          const safeUid = user.uid || state.user?.uid || '';
          return { user: { ...state.user, ...user, uid: safeUid } as UserProfile };
        }),
      setLoading: (loading) => set({ loading }),
      updateUser: (data) =>
        set((state) => ({
          user: state.user
            ? ({ ...state.user, ...data, uid: (data as any)?.uid || state.user.uid } as UserProfile)
            : null,
        })),
    }),
    {
      name: 'gridwar-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Solo persistimos el perfil de usuario; loading siempre arranca en true
      partialize: (state) => ({ user: state.user }),
    }
  )
);
