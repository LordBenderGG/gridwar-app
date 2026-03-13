import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import {
  BLOCK_MESSAGES_ES, getRandomMessage, formatCountdown,
} from '../constants/messages';
import { COLORS } from '../constants/theme';

export default function BlockedScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [timeLeft, setTimeLeft] = useState(0);
  const [message] = useState(() => getRandomMessage(BLOCK_MESSAGES_ES, ''));
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    intervalRef.current = setInterval(() => {
      const blockUntil = user?.challengeBlockedUntil || 0;
      const left = Math.max(0, blockUntil - Date.now());
      setTimeLeft(left);
      if (left === 0) {
        clearInterval(intervalRef.current!);
        router.replace('/(tabs)/home');
      }
    }, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [user]);

  const formattedTime = formatCountdown(timeLeft);
  const finalMessage = message.replace('{tiempo}', formattedTime);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔒 BLOQUEADO</Text>

      <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.timerLabel}>TIEMPO RESTANTE</Text>
        <Text style={styles.timer}>{formattedTime}</Text>
      </Animated.View>

      <Text style={styles.message}>{finalMessage}</Text>

      <View style={styles.divider} />

      <Text style={styles.hint}>Mientras esperas, puedes jugar contra la IA</Text>

      <TouchableOpacity
        style={styles.iaBtn}
        onPress={() => router.push('/game/vs-ia')}
      >
        <Text style={styles.iaBtnText}>🤖 Jugar vs IA</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.replace('/(tabs)/home')}
      >
        <Text style={styles.backText}>Ver perfil</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
