import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Alert, ActivityIndicator,
  Animated as RNAnimated, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  collection, query, onSnapshot, limit, doc, updateDoc,
  onSnapshot as fsOnSnapshot, increment,
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { UserProfile } from '../../services/auth';
import {
  sendChallenge,
  subscribeToIncomingChallenges,
  acceptChallenge,
  rejectChallenge,
  cancelChallenge,
  Challenge,
} from '../../services/challenge';
import { subscribeToAllPresence } from '../../services/presence';
import { useAuthStore } from '../../store/authStore';
import PlayerCard from '../../components/PlayerCard';
import ChallengeModal from '../../components/ChallengeModal';
import { useColors } from '../../hooks/useColors';
import { playSound } from '../../services/sound';
import AdBanner from '../../components/AdBanner';
import RewardedAdButton from '../../components/RewardedAdButton';
import { scheduleLocalChallengeNotification } from '../../services/notifications';
import { getDailyMissions, DailyMission } from '../../services/missions';
import { checkAndResetSeason, getCurrentSeason, daysUntilSeasonEnd } from '../../services/seasons';
import { getTranslatedRankName } from '../../services/ranking';
import { flushPendingWildcardDebits } from '../../services/wildcards';
import '../../i18n';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const actorUid = auth.currentUser?.uid || user?.uid || '';
  const { t } = useTranslation();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [onlineMap, setOnlineMap] = useState<Map<string, boolean>>(new Map());
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [sentChallengeId, setSentChallengeId] = useState<string | null>(null);
  const [sentChallengeTo, setSentChallengeTo] = useState<string | null>(null);
  // Misiones diarias
  const [dailyMissions, setDailyMissions] = useState<DailyMission[]>([]);
  const [seasonDaysLeft, setSeasonDaysLeft] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState(0);
  const [missionsExpanded, setMissionsExpanded] = useState(false);
  const [challengeNotice, setChallengeNotice] = useState<string | null>(null);
  const challengeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChallengeIdRef = useRef<string | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  // Re-suscribir presencia y datos al volver de otra pantalla (ej: blocked.tsx)
  useFocusEffect(
    useCallback(() => {
      setFocusKey(k => k + 1);
    }, [])
  );

  // ── Gemas diarias (Fase 1A) ──────────────────────────────────────────
  const gemFloatAnim = useRef(new RNAnimated.Value(0)).current;
  const gemOpacityAnim = useRef(new RNAnimated.Value(0)).current;
  const [showGemReward, setShowGemReward] = useState(false);

  useEffect(() => {
    if (!user || !actorUid) return;
    const today = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
    if ((user.lastLoginReward ?? '') === today) return;

    // Dar +10 gemas usando increment() para evitar race conditions
    updateDoc(doc(db, 'users', actorUid), {
      gems: increment(10),
      lastLoginReward: today,
    }).then(() => {
      updateUser({ gems: (user.gems || 0) + 10, lastLoginReward: today });
      // Mostrar animación flotante
      setShowGemReward(true);
      gemFloatAnim.setValue(0);
      gemOpacityAnim.setValue(1);
      RNAnimated.parallel([
        RNAnimated.timing(gemFloatAnim, { toValue: -60, duration: 1800, useNativeDriver: true }),
        RNAnimated.sequence([
          RNAnimated.delay(1000),
          RNAnimated.timing(gemOpacityAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        ]),
      ]).start(() => setShowGemReward(false));
    }).catch(() => {});
  }, [actorUid]);

  // Pulsación en el botón de retar
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  // Cargar misiones diarias
  useEffect(() => {
    if (!user || !actorUid) return;
    flushPendingWildcardDebits(actorUid).catch(() => {});
    getDailyMissions(actorUid)
      .then(setDailyMissions)
      .catch(() => {});
  }, [actorUid]);

  // Temporadas (Fase 5): verificar reset + calcular días restantes
  useEffect(() => {
    if (!user || !actorUid) return;
    checkAndResetSeason().catch(() => {});
    getCurrentSeason().then((season) => {
      if (!season) return;
      const days = daysUntilSeasonEnd(season.endDate);
      setSeasonDaysLeft(days);
    }).catch(() => {});
  }, [actorUid]);

  // Suscripción a la lista de jugadores (Firestore)
  useEffect(() => {
    if (!user || !actorUid) return;
    const q = query(collection(db, 'users'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as UserProfile)
        .filter((p) => p.uid !== actorUid);
      setPlayers(list);
    });
    return () => unsub();
  }, [actorUid, focusKey]);

  // Suscripción a presencia online (Realtime Database)
  useEffect(() => {
    const unsub = subscribeToAllPresence((map) => {
      setOnlineMap(new Map(map));
    });
    return () => unsub();
  }, [focusKey]);

  // Suscripción a retos entrantes
  useEffect(() => {
    if (!user || !actorUid) return;
    const unsub = subscribeToIncomingChallenges(actorUid, (challenges) => {
        if (challenges.length > 0) {
        const challenge = challenges[0];
        setIncomingChallenge(challenge);
        if (challenge.challengeId !== lastChallengeIdRef.current) {
          lastChallengeIdRef.current = challenge.challengeId;
          playSound('challenge');
          // Notificación local (útil cuando la app está en background parcial)
          scheduleLocalChallengeNotification(challenge.fromUsername).catch(() => {});
        }
      } else {
        setIncomingChallenge(null);
        lastChallengeIdRef.current = null;
      }
    });
    return () => unsub();
  }, [actorUid]);

  // Suscribir al reto enviado para detectar cuando es aceptado
  useEffect(() => {
    if (!sentChallengeId) return;
    const unsub = fsOnSnapshot(
      doc(db, 'challenges', sentChallengeId),
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === 'accepted' && data.gameId) {
          clearPendingChallenge();
          const navUid = auth.currentUser?.uid || actorUid;
          router.push(`/game/${data.gameId}?myUid=${navUid}`);
        } else if (data.status === 'rejected' || data.status === 'expired') {
          clearPendingChallenge();
          showChallengeNotice(t('home.challengeRejected'));
        }
      }
    );
    return () => unsub();
  }, [sentChallengeId, actorUid]);

  const clearPendingChallenge = () => {
    if (challengeTimeoutRef.current) clearTimeout(challengeTimeoutRef.current);
    setChallenging(null);
    setSentChallengeId(null);
    setSentChallengeTo(null);
  };

  const showChallengeNotice = (message: string) => {
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setChallengeNotice(message);
    noticeTimeoutRef.current = setTimeout(() => setChallengeNotice(null), 2200);
  };

  const handleChallenge = async (target: UserProfile) => {
    if (!user) return;
    if (!actorUid) {
      Alert.alert('Error', 'Sesion invalida. Cierra sesion e inicia de nuevo.');
      return;
    }

    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) {
      router.push('/blocked');
      return;
    }

    if (user.status !== 'available') {
      Alert.alert(
        t('home.notAvailable'),
        user.status === 'in_game'
          ? t('home.youInGame')
          : user.status === 'challenged'
          ? t('home.youChallenged')
          : t('home.youBusy')
      );
      return;
    }

    if (target.status !== 'available') {
      showChallengeNotice(
        target.status === 'in_game'
          ? t('home.playerInGame', { username: target.username })
          : target.status === 'challenged'
            ? t('home.playerChallenged', { username: target.username })
            : t('home.playerBusy', { username: target.username })
      );
      return;
    }

    setChallenging(target.uid);
    try {
      const challengeId = await sendChallenge(
        actorUid,
        user.username,
        user.avatar,
        user.photoURL,
        user.rank,
        user.points,
        target.uid,
        user.inventory?.active_frame ?? null,
        user.inventory?.active_name_color ?? null,
        user.inventory?.active_theme ?? null
      );
      setSentChallengeId(challengeId);
      setSentChallengeTo(target.uid);

      challengeTimeoutRef.current = setTimeout(() => {
        clearPendingChallenge();
      }, 35000);
    } catch (e: any) {
      setChallenging(null);
      const raw = String(e?.message || e || '').toLowerCase();
      if (raw.includes('target_not_available') || raw.includes('target_not_avaliable') || raw.includes('target_already_challenged')) {
        showChallengeNotice(t('home.playerNotAvailable'));
      } else if (raw.includes('from_not_available') || raw.includes('from_already_challenged')) {
        showChallengeNotice(t('home.notAvailable'));
      } else {
        showChallengeNotice(t('home.challengeError'));
      }
    }
  };

  const handleCancelChallenge = async () => {
    if (!sentChallengeId || !user || !sentChallengeTo || !actorUid) return;
    try {
      await cancelChallenge(sentChallengeId, actorUid, sentChallengeTo);
    } catch (_) {}
    clearPendingChallenge();
  };

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge || !user) return;
    try {
      const gameId = await acceptChallenge(
        incomingChallenge.challengeId,
        incomingChallenge,
        user.username,
        user.avatar,
        user.photoURL ?? null,
        user.inventory?.active_frame ?? null,
        user.inventory?.active_name_color ?? null
      );
      setIncomingChallenge(null);
      const navUid = auth.currentUser?.uid || actorUid;
      router.push(`/game/${gameId}?myUid=${navUid}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || t('home.challengeError'));
    }
  };

  const handleRejectChallenge = async () => {
    if (!incomingChallenge || !user || !actorUid) return;
    if (Date.now() > incomingChallenge.expiresAt) {
      setIncomingChallenge(null);
      return;
    }
    try {
      await rejectChallenge(incomingChallenge.challengeId, incomingChallenge.from, actorUid);
    } catch (_) {}
    setIncomingChallenge(null);
  };

  const handleSetMode = async (newMode: 'global' | 'local') => {
    if (!user || !actorUid) return;
    if (user.mode === newMode) return;
    try {
      await updateDoc(doc(db, 'users', actorUid), { mode: newMode });
    } catch {
      Alert.alert('Error', t('home.modeChangeError'));
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Lógica de filtrado ──────────────────────────────────────────────────────
  const myMode = user?.mode ?? 'global';
  const rtdbLoaded = onlineMap.size > 0;

  const filteredByMode = players.filter((p) =>
    myMode === 'global' ? p.mode === 'global' : true
  );

  const onlinePlayers = filteredByMode.filter((p) => {
    const availableInFirestore = p.status === 'available';
    if (!rtdbLoaded) return availableInFirestore;
    return availableInFirestore && onlineMap.get(p.uid) === true;
  });

  const filtered = onlinePlayers.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  const canChallenge = (target: UserProfile): boolean => {
    if (!user) return false;
    if (user.status !== 'available') return false;
    if (target.status !== 'available') return false;
    if ((user as any).activeChallengeId) return false;
    if ((target as any).activeChallengeId) return false;
    if (challenging !== null) return false;
    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) return false;
    return true;
  };

  const myStatus = user?.status || 'available';
  const statusColor = myStatus === 'available' ? COLORS.success : myStatus === 'in_game' ? COLORS.warning : COLORS.danger;
  const statusLabel = myStatus === 'available'
    ? t('home.statusOnline')
    : myStatus === 'in_game'
    ? t('home.statusInGame')
    : t('home.statusBusy');

  // Pantalla de "esperando respuesta al reto"
  if (sentChallengeId && sentChallengeTo) {
    const targetPlayer = players.find((p) => p.uid === sentChallengeTo);
    return (
      <View style={styles.waitingContainer}>
        <RNAnimated.Text style={[styles.logo, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={{ color: '#FFFFFF' }}>GRID</Text>
          <Text style={{ color: '#FF3B30' }}>WAR</Text>
        </RNAnimated.Text>
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>⚔️</Text>
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.waitingTitle}>{t('home.challengeSent')}</Text>
          <Text style={styles.waitingSubtitle}>
            {t('home.challengeWaiting')}{'\n'}
            <Text style={styles.waitingName}>{targetPlayer?.username || '...'}</Text>
          </Text>
          <Text style={styles.waitingHint}>{t('home.challengeExpires')}</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelChallenge}>
            <Text style={styles.cancelBtnText}>{t('home.cancelChallenge')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.logo, { color: COLORS.primary, textShadowColor: COLORS.primary }]}>{t('home.title')}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.helpBtn} onPress={() => router.push('/guia')}>
            <Text style={styles.helpBtnText}>?</Text>
          </TouchableOpacity>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      {challengeNotice && (
        <View style={styles.challengeNoticeBox}>
          <Text style={styles.challengeNoticeText}>{challengeNotice}</Text>
        </View>
      )}

      {/* Stats bar — 5 columnas: Puntos / Victorias / Rango / En línea / Gemas */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.points || 0}</Text>
          <Text style={styles.statLabel}>{t('home.points')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.wins || 0}</Text>
          <Text style={[styles.statLabel, { color: COLORS.success }]}>{t('home.wins')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.warning, fontSize: 12 }]}>{user?.rank ? getTranslatedRankName(user.rank) : ''}</Text>
          <Text style={styles.statLabel}>{t('home.rank')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{filtered.length}</Text>
          <Text style={styles.statLabel}>{t('home.online')}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>💎 {user?.gems || 0}</Text>
          <Text style={styles.statLabel}>{t('home.gems')}</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Botones de modo — 2 columnas */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeBtn, myMode === 'global' && styles.modeBtnActive]}
          onPress={() => handleSetMode('global')}
        >
          <Text style={[styles.modeBtnText, myMode === 'global' && styles.modeBtnTextActive]}>
            {t('home.globalMode')}
          </Text>
          <Text style={styles.modeBtnDesc}>{t('home.globalModeDesc')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeBtn, myMode === 'local' && styles.modeBtnActive]}
          onPress={() => handleSetMode('local')}
        >
          <Text style={[styles.modeBtnText, myMode === 'local' && styles.modeBtnTextActive]}>
            {t('home.localMode')}
          </Text>
          <Text style={styles.modeBtnDesc}>{t('home.localModeDesc')}</Text>
        </TouchableOpacity>
      </View>

      {/* Banner fin de temporada (Fase 5) */}
      {seasonDaysLeft !== null && seasonDaysLeft <= 3 && (
        <View style={styles.seasonBanner}>
          <Text style={styles.seasonBannerTitle}>{t('home.seasonEndTitle')}</Text>
          <Text style={styles.seasonBannerText}>
            {seasonDaysLeft === 0
              ? t('home.seasonEndToday')
              : t('home.seasonEndDays', { days: seasonDaysLeft })}
          </Text>
        </View>
      )}

      {/* Misiones diarias — colapsable */}
      {dailyMissions.length > 0 && (
        <View style={styles.missionsCard}>
          <TouchableOpacity style={styles.missionCardHeader} onPress={() => setMissionsExpanded(e => !e)}>
            <Text style={styles.missionCardTitle}>{t('home.dailyMissions')}</Text>
            <View style={styles.missionCardRight}>
              <Text style={styles.missionCardCount}>
                {dailyMissions.filter(m => m.completed).length}/{dailyMissions.length}
              </Text>
              <Text style={styles.missionChevron}>{missionsExpanded ? '▲' : '▼'}</Text>
            </View>
          </TouchableOpacity>
          {missionsExpanded && <View style={{ height: 10 }} />}
          {missionsExpanded && dailyMissions.map((m) => {
            const pct = Math.min(1, m.progress / m.target);
            return (
              <View key={m.id} style={styles.missionRow}>
                <View style={styles.missionInfo}>
                  <Text style={[styles.missionLabel, m.completed && styles.missionLabelDone]}>
                    {m.completed ? '✓ ' : ''}{t('missions.' + m.id) || m.label}
                  </Text>
                  <Text style={styles.missionDesc}>{t('missions.' + m.id + '_desc') || m.description}</Text>
                  <View style={styles.missionBarBg}>
                    <View style={[styles.missionBarFill, { width: `${pct * 100}%` }]} />
                  </View>
                </View>
                <Text style={[styles.missionReward, m.completed && styles.missionRewardDone]}>
                  +{m.reward}💎
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Banner AdMob */}
      <AdBanner placement="home" style={{ marginBottom: 8 }} />

      {/* Video recompensado */}
      <RewardedAdButton
        label="▶ Ver video y ganar 10 💎 GRATIS"
        gemAmount={10}
      />

      {/* Título sección */}
      <View style={styles.sectionHeader}>
        <View style={styles.onlineDot} />
        <Text style={styles.sectionTitle}>{t('home.onlinePlayers')}</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{filtered.length}</Text>
        </View>
      </View>
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <PlayerCard
            player={item}
            onChallenge={() => handleChallenge(item)}
            challengeDisabled={!canChallenge(item)}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎮</Text>
            <Text style={styles.emptyTitle}>{t('home.noPlayers')}</Text>
            <Text style={styles.emptyText}>{t('home.noPlayersMsg')}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />

      <ChallengeModal
        challenge={incomingChallenge}
        onAccept={handleAcceptChallenge}
        onReject={handleRejectChallenge}
      />

      {/* Animación gemas diarias */}
      {showGemReward && (
        <RNAnimated.View
          style={[
            styles.gemFloatBadge,
            {
              opacity: gemOpacityAnim,
              transform: [{ translateY: gemFloatAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.gemFloatText}>+10 💎</Text>
        </RNAnimated.View>
      )}
    </View>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 50,
  },
  waitingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  waitingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  waitingEmoji: { fontSize: 48, marginBottom: 12 },
  waitingTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: 12,
  },
  waitingSubtitle: {
    color: COLORS.text,
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  waitingName: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  waitingHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 24,
  },
  cancelBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cancelBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logo: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 6,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  challengeNoticeBox: {
    marginBottom: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warning + '1A',
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  challengeNoticeText: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  statLabel: { color: COLORS.textSecondary, fontSize: 8, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: COLORS.border },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  helpBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary + '14',
  },
  helpBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '900',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  modeBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  modeBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '12',
  },
  modeBtnText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    fontSize: 13,
  },
  modeBtnTextActive: {
    color: COLORS.primary,
  },
  modeBtnDesc: {
    color: COLORS.textMuted,
    fontSize: 9,
    marginTop: 3,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    flex: 1,
  },
  sectionBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sectionBadgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  gemFloatBadge: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#FFD700',
    zIndex: 999,
  },
  gemFloatText: {
    color: '#FFD700',
    fontWeight: '900',
    fontSize: 22,
    letterSpacing: 1,
  },
  seasonBanner: {
    backgroundColor: COLORS.warning + '18',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.warning,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  seasonBannerTitle: {
    color: COLORS.warning,
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  seasonBannerText: {
    color: COLORS.accent,
    fontSize: 12,
    textAlign: 'center',
  },
  missionsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 10,
  },
  missionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 0,
  },
  missionCardTitle: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  missionCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  missionCardCount: {
    color: COLORS.primary,
    fontSize: 9,
    fontWeight: 'bold',
  },
  missionChevron: {
    color: COLORS.textMuted,
    fontSize: 9,
  },
  missionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  missionInfo: {
    flex: 1,
  },
  missionLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
  },
  missionLabelDone: {
    color: COLORS.success,
  },
  missionDesc: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 1,
    marginBottom: 3,
  },
  missionBarBg: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  missionBarFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  missionReward: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 12,
    minWidth: 44,
    textAlign: 'right',
  },
  missionRewardDone: {
    color: COLORS.success,
    textDecorationLine: 'line-through',
  },
});
