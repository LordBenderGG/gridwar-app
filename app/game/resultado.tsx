import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS } from '../../constants/theme';
import { getRandomMessage, VICTORY_MESSAGES_ES, DEFEAT_MESSAGES_ES } from '../../constants/messages';

export default function ResultadoScreen() {
  const { gameId, winnerId, myUid } = useLocalSearchParams<{
    gameId: string;
    winnerId: string;
    myUid: string;
  }>();
  const router = useRouter();
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const isWinner = winnerId === myUid;

  useEffect(() => {
    if (isWinner) {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50 }).start();
    } else {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 15, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -15, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]).start();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
    }
  }, []);

  const message = isWinner
    ? getRandomMessage(VICTORY_MESSAGES_ES)
    : getRandomMessage(DEFEAT_MESSAGES_ES);

  return (
    <Animated.View
      style={[
        styles.container,
        isWinner ? styles.winContainer : styles.lossContainer,
        { transform: [{ translateX: shakeAnim }] },
      ]}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Text style={styles.emoji}>{isWinner ? '🏆' : '💀'}</Text>
        <Text style={[styles.title, isWinner ? styles.winTitle : styles.lossTitle]}>
          {message}
        </Text>

        <View style={styles.pointsBox}>
          <Text style={[styles.points, isWinner ? styles.winPoints : styles.lossPoints]}>
            {isWinner ? '+100 pts · +🎯' : '-30 pts'}
          </Text>
          {!isWinner && (
            <Text style={styles.blockedText}>⏳ Bloqueado para retar durante 3 horas</Text>
          )}
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)/home')}>
        <Text style={styles.homeBtnText}>Ir al Inicio</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28 },
  winContainer: { backgroundColor: '#0A1A0A' },
  lossContainer: { backgroundColor: '#1A0A0A' },
  emoji: { fontSize: 80, textAlign: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 20, letterSpacing: 2 },
  winTitle: { color: COLORS.success },
  lossTitle: { color: COLORS.danger },
  pointsBox: { alignItems: 'center', marginBottom: 32 },
  points: { fontSize: 22, fontWeight: 'bold' },
  winPoints: { color: COLORS.success },
  lossPoints: { color: COLORS.danger },
  blockedText: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' },
  homeBtn: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 40,
    borderWidth: 1, borderColor: COLORS.border,
  },
  homeBtnText: { color: COLORS.text, fontWeight: 'bold', fontSize: 15 },
});
