import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../store/authStore';
import { formatCountdown } from '../constants/messages';
import { useColors } from '../hooks/useColors';
import '../i18n';

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1, backgroundColor: '#0D0308',
    justifyContent: 'center', alignItems: 'center', padding: 28,
  },
  title: {
    color: COLORS.danger, fontSize: 32, fontWeight: '900',
    letterSpacing: 4, marginBottom: 32,
    textShadowColor: COLORS.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
  },
  timerContainer: {
    backgroundColor: 'rgba(255,59,48,0.1)', borderWidth: 2,
    borderColor: COLORS.danger, borderRadius: 20,
    padding: 24, alignItems: 'center', marginBottom: 24,
    width: '80%',
  },
  timerLabel: {
    color: COLORS.danger, fontSize: 11,
    fontWeight: 'bold', letterSpacing: 2, marginBottom: 8,
  },
  timer: {
    color: COLORS.danger, fontSize: 52,
    fontWeight: '900', letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  message: {
    color: COLORS.textSecondary, fontSize: 15,
    textAlign: 'center', lineHeight: 22,
    marginBottom: 24, paddingHorizontal: 8,
    fontStyle: 'italic',
  },
  divider: {
    width: '60%', height: 1,
    backgroundColor: COLORS.border, marginBottom: 24,
  },
  hint: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 16 },
  iaBtn: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12,
  },
  iaBtnText: { color: COLORS.text, fontWeight: 'bold', fontSize: 15 },
  backBtn: { padding: 8 },
  backText: { color: COLORS.textSecondary, fontSize: 13 },
});

export default function BlockedScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [timeLeft, setTimeLeft] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Previene doble updateDoc/navegación si useEffect re-corre por cambio de user
  const hasNavigatedRef = useRef(false);

  // Seleccionar mensaje aleatorio del array i18n una sola vez
  const messages: string[] = t('blocked.messages', { returnObjects: true }) as string[];
  const [message] = useState(() => messages[Math.floor(Math.random() * messages.length)]);

  useEffect(() => {
    // isMounted: previene navegación post-unmount si el usuario salió manualmente
    // mientras updateDoc estaba en vuelo
    let isMounted = true;

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    intervalRef.current = setInterval(() => {
      // Bail si desmontado o si ya iniciamos navegación (evita doble disparo
      // cuando onSnapshot actualiza user y useEffect re-corre con challengeBlockedUntil: 0)
      if (!isMounted || hasNavigatedRef.current) return;

      const blockUntil = user?.challengeBlockedUntil || 0;
      const left = Math.max(0, blockUntil - Date.now());
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(intervalRef.current!);
        hasNavigatedRef.current = true;
        // Limpiar status y bloqueo en Firestore ANTES de navegar
        if (user?.uid) {
          updateDoc(doc(db, 'users', user.uid), {
            status: 'available',
            challengeBlockedUntil: 0,
          })
            .then(() => { if (isMounted) router.replace('/(tabs)/home'); })
            .catch(() => { if (isMounted) router.replace('/(tabs)/home'); });
        } else {
          router.replace('/(tabs)/home');
        }
      }
    }, 1000);

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user]);

  const formattedTime = formatCountdown(timeLeft);
  const finalMessage = message.replace('{tiempo}', formattedTime);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('blocked.title')}</Text>

      <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.timerLabel}>{t('blocked.timeLabel')}</Text>
        <Text style={styles.timer}>{formattedTime}</Text>
      </Animated.View>

      <Text style={styles.message}>{finalMessage}</Text>

      <View style={styles.divider} />

      <Text style={styles.hint}>{t('blocked.hint')}</Text>

      <TouchableOpacity
        style={styles.iaBtn}
        onPress={() => router.push('/game/vs-ia')}
      >
        <Text style={styles.iaBtnText}>{t('blocked.playIA')}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.replace('/(tabs)/perfil')}
      >
        <Text style={styles.backText}>{t('blocked.viewProfile')}</Text>
      </TouchableOpacity>
    </View>
  );
}
