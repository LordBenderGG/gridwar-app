import '../i18n';
import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { onAuthChanged, normalizeUserProfile, normalizeWildcardInventory, ensureUserProfile } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { DARK_COLORS, LIGHT_COLORS } from '../constants/theme';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../services/auth';
import { registerPresence } from '../services/presence';
import { preloadSounds, unloadSounds } from '../services/sound';
import { registerPushToken, scheduleDailyBonusReminder } from '../services/notifications';
import { flushPendingWildcardDebits } from '../services/wildcards';

export default function RootLayout() {
  const { setUser, setLoading } = useAuthStore();
  const isDark = useThemeStore((s) => s.isDark);
  const COLORS = isDark ? DARK_COLORS : LIGHT_COLORS;
  const profileUnsubRef = useRef<(() => void) | null>(null);
  const presenceCleanupRef = useRef<(() => void) | null>(null);
  const currentUidRef = useRef<string | null>(null);
  const router = useRouter();

  // Manejar navegación al tocar notificación
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'challenge') {
        // Navegar al home donde está el modal de reto
        router.replace('/(tabs)/home');
      } else if (data?.type === 'daily_bonus') {
        router.replace('/(tabs)/home');
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    preloadSounds();

    const unsub = onAuthChanged((firebaseUser) => {
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }
      if (presenceCleanupRef.current) {
        presenceCleanupRef.current();
        presenceCleanupRef.current = null;
      }

        if (firebaseUser) {
          currentUidRef.current = firebaseUser.uid;
          presenceCleanupRef.current = registerPresence(firebaseUser.uid);
          flushPendingWildcardDebits(firebaseUser.uid).catch(() => {});

        // Registrar push token y programar recordatorio de bono
        registerPushToken(firebaseUser.uid).catch(() => {});
        scheduleDailyBonusReminder().catch(() => {});

        const profileUnsub = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              const raw = snap.data() as any;
              setUser(normalizeUserProfile(raw, firebaseUser.uid));

              const legacy = raw?.wildcards || {};
              const hasLegacyKeys =
                legacy.tiempo !== undefined
                || legacy.escudo !== undefined
                || legacy.bomba !== undefined
                || legacy.ciego !== undefined;
              if (hasLegacyKeys) {
                updateDoc(doc(db, 'users', firebaseUser.uid), {
                  wildcards: normalizeWildcardInventory(legacy),
                }).catch(() => {});
              }
            } else {
              ensureUserProfile(firebaseUser)
                .then((profile) => setUser(profile))
                .catch(() => setUser(null));
            }
            setLoading(false);
          },
          () => {
            setUser(null);
            setLoading(false);
          }
        );
        profileUnsubRef.current = profileUnsub;
      } else {
        currentUidRef.current = null;
        setUser(null);
        setLoading(false);
      }
    });

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && currentUidRef.current) {
        if (presenceCleanupRef.current) presenceCleanupRef.current();
        presenceCleanupRef.current = registerPresence(currentUidRef.current);
        scheduleDailyBonusReminder().catch(() => {});
        flushPendingWildcardDebits(currentUidRef.current).catch(() => {});
      }
    });

    return () => {
      unsub();
      appStateSub.remove();
      if (profileUnsubRef.current) profileUnsubRef.current();
      if (presenceCleanupRef.current) presenceCleanupRef.current();
      unloadSounds();
    };
  }, []);

  return (
    <>
      <StatusBar
        style={isDark ? 'light' : 'dark'}
        backgroundColor={COLORS.background}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="auth/login" options={{ headerShown: false }} />
        <Stack.Screen name="auth/register" options={{ headerShown: false }} />
        <Stack.Screen name="game/[gameId]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="game/resultado" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="game/vs-ia" options={{ headerShown: false }} />
        <Stack.Screen name="tournament/index" options={{ headerShown: false }} />
        <Stack.Screen name="tournament/crear" options={{ headerShown: false }} />
        <Stack.Screen name="blocked" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </>
  );
}
