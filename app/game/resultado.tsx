import React, { useEffect, useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { doc, getDoc } from 'firebase/firestore';
import { useColors } from '../../hooks/useColors';
import { POINTS_WIN, POINTS_LOSS } from '../../constants/theme';
import { getUserProfile } from '../../services/auth';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/authStore';
import { flushPendingWildcardDebits } from '../../services/wildcards';
import '../../i18n';

const createStyles = (COLORS: any) => StyleSheet.create({
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
  tournamentBtn: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  tournamentBtnText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  autoBackText: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
});

export default function ResultadoScreen() {
  const { gameId, winnerId, myUid, endReason } = useLocalSearchParams<{
    gameId: string;
    winnerId: string;
    myUid: string;
    endReason?: string;
  }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, setUser } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const [pointsDelta, setPointsDelta] = useState<number | null>(null);
  const [gemsDelta, setGemsDelta] = useState<number | null>(null);
  const [tournamentId, setTournamentId] = useState<string | null>(null);
  const [isLocalTournamentMatch, setIsLocalTournamentMatch] = useState(false);
  const [loserScoreAtEnd, setLoserScoreAtEnd] = useState<number | null>(null);

  const isIdlePenalty = endReason === 'idle_penalty';
  const isWinner = !isIdlePenalty && winnerId === myUid;

  useEffect(() => {
    if (!gameId) return;
    getDoc(doc(db, 'games', gameId)).then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      const p1 = data.player1 as string | undefined;
      const p2 = data.player2 as string | undefined;
      const loserUid = winnerId === p1 ? p2 : p1;
      if (loserUid && data?.score) {
        setLoserScoreAtEnd(Number(data.score[loserUid] ?? 0));
      }
      if (data.type === 'tournament' && data.tournamentId) {
        setTournamentId(data.tournamentId);
        getDoc(doc(db, 'tournaments', data.tournamentId)).then((tSnap) => {
          if (!tSnap.exists()) return;
          const tData = tSnap.data() as any;
          setIsLocalTournamentMatch(tData?.type === 'local');
        }).catch(() => {});
      }
    }).catch(() => {});
  }, [gameId]);

  useEffect(() => {
    if (!tournamentId) return;
    const timer = setTimeout(() => {
      router.replace(`/tournament/${tournamentId}`);
    }, 2000);
    return () => clearTimeout(timer);
  }, [tournamentId, router]);

  useEffect(() => {
    // Capturar puntos antes de recargar para calcular el delta real
    const pointsBefore = user?.points ?? null;
    const gemsBefore = user?.gems ?? null;

    if (myUid) {
      flushPendingWildcardDebits(myUid).catch(() => {});
    }

    // Recargar perfil actualizado desde Firestore (puntos, gemas, rango)
    if (myUid) {
      getUserProfile(myUid).then((profile) => {
        if (profile) {
          setUser(profile);
          if (pointsBefore !== null) {
            const delta = profile.points - pointsBefore;
            setPointsDelta(delta);

            // Safety net: si ganó pero delta es 0, los puntos aún no se escribieron.
            // Reintentar después de 1.5s para dar tiempo a finishMatch.
            if (delta === 0 && isWinner) {
              setTimeout(() => {
                getUserProfile(myUid).then((retryProfile) => {
                  if (retryProfile) {
                    setUser(retryProfile);
                    if (pointsBefore !== null) {
                      setPointsDelta(retryProfile.points - pointsBefore);
                    }
                    if (gemsBefore !== null) {
                      setGemsDelta(retryProfile.gems - gemsBefore);
                    }
                  }
                }).catch(() => {});
              }, 1500);
            }
          }
          if (gemsBefore !== null) {
            setGemsDelta(profile.gems - gemsBefore);
          }
        }
      }).catch(() => { /* ignorar error de red */ });
    }

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

  // Seleccionar mensaje aleatorio del array i18n
  const messages: string[] = isWinner
    ? (t('result.victoryMessages', { returnObjects: true }) as string[])
    : (t('result.defeatMessages', { returnObjects: true }) as string[]);
  const message = messages[Math.floor(Math.random() * messages.length)];

  const expectedGemsDelta = useMemo(() => {
    if (!isWinner) return -5;
    if (loserScoreAtEnd === null) return 15;
    return loserScoreAtEnd === 0 ? 20 : 15;
  }, [isWinner, loserScoreAtEnd]);

  const displayedGemsDelta = useMemo(() => {
    if (gemsDelta === null) return null;
    if (gemsDelta !== 0) return gemsDelta;
    return expectedGemsDelta;
  }, [gemsDelta, expectedGemsDelta]);

  const displayedPointsDelta = useMemo(() => {
    if (isIdlePenalty) return 0;
    if (isLocalTournamentMatch) return 0;
    if (pointsDelta === null) return isWinner ? POINTS_WIN : POINTS_LOSS;
    if (pointsDelta !== 0) return pointsDelta;
    return isWinner ? POINTS_WIN : POINTS_LOSS;
  }, [isIdlePenalty, isLocalTournamentMatch, pointsDelta, isWinner]);

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
            {isIdlePenalty ? t('result.noCombatTitle') : message}
          </Text>

        <View style={styles.pointsBox}>
          <Text style={[styles.points, isWinner ? styles.winPoints : styles.lossPoints]}>
            {displayedGemsDelta !== null
              ? (displayedGemsDelta > 0 ? ` +${displayedGemsDelta}` : displayedGemsDelta < 0 ? ` ${displayedGemsDelta}` : ' 0')
              : ' ...'}
          </Text>
          <Text style={styles.blockedText}>
            {isLocalTournamentMatch
              ? t('result.noPointsChange', { defaultValue: 'Sin cambios de puntos' })
              : isIdlePenalty
                ? t('result.noCombatSubtitle')
              : (displayedPointsDelta > 0
                  ? t('result.pointsEarned', { points: displayedPointsDelta })
                  : displayedPointsDelta < 0
                    ? t('result.pointsLost', { points: Math.abs(displayedPointsDelta) })
                    : t('result.noPointsChange', { defaultValue: 'Sin cambios de puntos' }))}
          </Text>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.homeBtn} onPress={() => router.replace('/(tabs)/home')}>
        <Text style={styles.homeBtnText}>{t('result.goHome')}</Text>
      </TouchableOpacity>

      {tournamentId && (
        <>
          <TouchableOpacity
            style={styles.tournamentBtn}
            onPress={() => router.replace(`/tournament/${tournamentId}`)}
          >
            <Text style={styles.tournamentBtnText}>Volver al torneo</Text>
          </TouchableOpacity>
          <Text style={styles.autoBackText}>Volviendo al torneo automaticamente...</Text>
        </>
      )}
    </Animated.View>
  );
}
