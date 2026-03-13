import '../i18n';
import React, { useEffect, useRef } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { onAuthChanged } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants/theme';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile } from '../services/auth';

async function requestPushPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  // Token disponible para uso futuro con FCM
}

export default function RootLayout() {
  const { setUser, setLoading } = useAuthStore();
  const profileUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    requestPushPermissions();

    const unsub = onAuthChanged((firebaseUser) => {
      // Cancelar suscripción anterior si existía
      if (profileUnsubRef.current) {
        profileUnsubRef.current();
        profileUnsubRef.current = null;
      }

      if (firebaseUser) {
        // Suscripción en tiempo real al perfil del usuario
        // Esto garantiza que user.status, points, rank, etc. siempre estén actualizados
        const profileUnsub = onSnapshot(
          doc(db, 'users', firebaseUser.uid),
          (snap) => {
            if (snap.exists()) {
              setUser(snap.data() as UserProfile);
            } else {
              setUser(null);
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
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsub();
      if (profileUnsubRef.current) profileUnsubRef.current();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={COLORS.background} />
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
      </Stack>
    </>
  );
}
