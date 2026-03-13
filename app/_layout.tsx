import '../i18n';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { onAuthChanged, getUserProfile } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import { COLORS } from '../constants/theme';

async function requestPushPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') return;
  // Token disponible para uso futuro con FCM
}

export default function RootLayout() {
  const { setUser, setLoading } = useAuthStore();

  useEffect(() => {
    requestPushPermissions();

    const unsub = onAuthChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profile = await getUserProfile(firebaseUser.uid);
          setUser(profile);
        } catch {
          // Si Firestore falla, tratamos al usuario como no autenticado
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsub();
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
