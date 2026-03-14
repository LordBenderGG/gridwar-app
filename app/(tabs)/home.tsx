import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  RefreshControl, TextInput, Alert, ActivityIndicator,
  Animated as RNAnimated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection, query, onSnapshot, limit, doc, updateDoc,
  onSnapshot as fsOnSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile } from '../../services/auth';
import { sendChallenge, subscribeToIncomingChallenges, acceptChallenge, rejectChallenge, Challenge } from '../../services/challenge';
import { subscribeToAllPresence } from '../../services/presence';
import { useAuthStore } from '../../store/authStore';
import PlayerCard from '../../components/PlayerCard';
import ChallengeModal from '../../components/ChallengeModal';
import { COLORS } from '../../constants/theme';

const { width } = Dimensions.get('window');

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [onlineMap, setOnlineMap] = useState<Map<string, boolean>>(new Map());
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [sentChallengeId, setSentChallengeId] = useState<string | null>(null);
  const [sentChallengeTo, setSentChallengeTo] = useState<string | null>(null);
  const challengeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  // Pulsación en el botón de retar
  useEffect(() => {
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.04, duration: 800, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Suscripción a la lista de jugadores (Firestore)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as UserProfile)
        .filter((p) => p.uid !== user.uid);
      setPlayers(list);
    });
    return () => unsub();
  }, [user?.uid]);

  // Suscripción a presencia online (Realtime Database)
  // Solo los usuarios con la app abierta aparecen en el mapa con online: true
  useEffect(() => {
    const unsub = subscribeToAllPresence((map) => {
      setOnlineMap(new Map(map));
    });
    return () => unsub();
  }, []);

  // Suscripción a retos entrantes
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToIncomingChallenges(user.uid, (challenges) => {
      if (challenges.length > 0) setIncomingChallenge(challenges[0]);
      else setIncomingChallenge(null);
    });
    return () => unsub();
  }, [user?.uid]);

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
          router.push(`/game/${data.gameId}`);
        } else if (data.status === 'rejected' || data.status === 'expired') {
          clearPendingChallenge();
          Alert.alert('Reto sin respuesta', 'El jugador rechazó tu reto o no respondió a tiempo.');
        }
      }
    );
    return () => unsub();
  }, [sentChallengeId]);

  const clearPendingChallenge = () => {
    if (challengeTimeoutRef.current) clearTimeout(challengeTimeoutRef.current);
    setChallenging(null);
    setSentChallengeId(null);
    setSentChallengeTo(null);
  };

  const handleChallenge = async (target: UserProfile) => {
    if (!user) return;

    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) {
      router.push('/blocked');
      return;
    }

    if (user.status !== 'available') {
      Alert.alert(
        'No disponible',
        user.status === 'in_game'
          ? 'Estás en una partida activa.'
          : user.status === 'challenged'
          ? 'Ya tienes un reto pendiente.'
          : 'No puedes retar ahora mismo.'
      );
      return;
    }

    if (target.status !== 'available') {
      Alert.alert(
        'Jugador no disponible',
        target.status === 'in_game'
          ? `${target.username} está en una partida.`
          : target.status === 'challenged'
          ? `${target.username} ya tiene un reto pendiente.`
          : `${target.username} no puede recibir retos ahora.`
      );
      return;
    }

    setChallenging(target.uid);
    try {
      const challengeId = await sendChallenge(
        user.uid,
        user.username,
        user.avatar,
        user.photoURL,
        user.rank,
        user.points,
        target.uid
      );
      setSentChallengeId(challengeId);
      setSentChallengeTo(target.uid);

      challengeTimeoutRef.current = setTimeout(() => {
        clearPendingChallenge();
      }, 35000);
    } catch (e: any) {
      setChallenging(null);
      Alert.alert('Error', e?.message || 'No se pudo enviar el reto. Intenta de nuevo.');
    }
  };

  const handleCancelChallenge = async () => {
    if (!sentChallengeId || !user || !sentChallengeTo) return;
    try {
      await updateDoc(doc(db, 'challenges', sentChallengeId), { status: 'expired' });
      await updateDoc(doc(db, 'users', user.uid), { status: 'available' });
      await updateDoc(doc(db, 'users', sentChallengeTo), { status: 'available' });
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
        user.avatar
      );
      setIncomingChallenge(null);
      router.push(`/game/${gameId}`);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo aceptar el reto.');
    }
  };

  const handleRejectChallenge = async () => {
    if (!incomingChallenge || !user) return;
    if (Date.now() > incomingChallenge.expiresAt) {
      setIncomingChallenge(null);
      return;
    }
    try {
      await rejectChallenge(incomingChallenge.challengeId, incomingChallenge.from, user.uid);
    } catch (_) {}
    setIncomingChallenge(null);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  // ── Lógica de filtrado ──────────────────────────────────────────────────────
  // myMode: 'global' solo ve a jugadores globales; 'local' ve a todos
  const myMode = user?.mode ?? 'global';

  // rtdbLoaded: el mapa de presencia ya recibió al menos un dato de RTDB.
  // Si aún no cargó, usamos solo Firestore (status='available') para no
  // mostrar la lista vacía mientras RTDB inicializa.
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
    if (challenging !== null) return false;
    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) return false;
    return true;
  };

  const myStatus = user?.status || 'available';
  const statusColor = myStatus === 'available' ? COLORS.success : myStatus === 'in_game' ? COLORS.warning : COLORS.danger;
  const statusLabel = myStatus === 'available' ? '● EN LÍNEA' : myStatus === 'in_game' ? '● EN PARTIDA' : '● OCUPADO';

  const handleToggleMode = async () => {
    if (!user) return;
    const newMode = myMode === 'global' ? 'local' : 'global';
    try {
      await updateDoc(doc(db, 'users', user.uid), { mode: newMode });
    } catch {
      Alert.alert('Error', 'No se pudo cambiar el modo.');
    }
  };

  // Pantalla de "esperando respuesta al reto"
  if (sentChallengeId && sentChallengeTo) {
    const targetPlayer = players.find((p) => p.uid === sentChallengeTo);
    return (
      <View style={styles.waitingContainer}>
        <RNAnimated.Text style={[styles.logo, { transform: [{ scale: pulseAnim }] }]}>
          TIKTAK
        </RNAnimated.Text>
        <View style={styles.waitingCard}>
          <Text style={styles.waitingEmoji}>⚔️</Text>
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 16 }} />
          <Text style={styles.waitingTitle}>RETO ENVIADO</Text>
          <Text style={styles.waitingSubtitle}>
            Esperando respuesta de{'\n'}
            <Text style={styles.waitingName}>{targetPlayer?.username || '...'}</Text>
          </Text>
          <Text style={styles.waitingHint}>⏱ El reto expira en 30 segundos</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelChallenge}>
            <Text style={styles.cancelBtnText}>✕ CANCELAR RETO</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>TIKTAK</Text>
          <Text style={styles.logoSub}>3 en Raya · Sin piedad</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.statusPill, { borderColor: statusColor }]}>
            <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {/* Botón modo global / local */}
          <TouchableOpacity
            style={[styles.modePill, { borderColor: myMode === 'global' ? COLORS.primary : COLORS.accent }]}
            onPress={handleToggleMode}
          >
            <Text style={[styles.modePillText, { color: myMode === 'global' ? COLORS.primary : COLORS.accent }]}>
              {myMode === 'global' ? '🌍 GLOBAL' : '📍 LOCAL'}
            </Text>
          </TouchableOpacity>
          <View style={styles.gemsBadge}>
            <Text style={styles.gemsText}>💎 {user?.gems || 0}</Text>
          </View>
        </View>
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.points || 0}</Text>
          <Text style={styles.statLabel}>PUNTOS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{user?.wins || 0}</Text>
          <Text style={[styles.statLabel, { color: COLORS.success }]}>VICTORIAS</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{user?.rank}</Text>
          <Text style={styles.statLabel}>RANGO</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{filtered.length}</Text>
          <Text style={styles.statLabel}>EN LÍNEA</Text>
        </View>
      </View>

      {/* Buscador */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar jugador online..."
          placeholderTextColor={COLORS.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Título sección */}
      <View style={styles.sectionHeader}>
        <View style={styles.onlineDot} />
        <Text style={styles.sectionTitle}>JUGADORES EN LÍNEA</Text>
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{filtered.length}</Text>
        </View>
      </View>

      <FlatList
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
            <Text style={styles.emptyTitle}>Sin rivales en línea</Text>
            <Text style={styles.emptyText}>
              Nadie más tiene la app abierta ahora.{'\n'}¡Compártela con tus amigos!
            </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'flex-start',
    marginBottom: 16,
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
  logoSub: {
    color: COLORS.textSecondary,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: -2,
  },
  headerRight: { alignItems: 'flex-end', gap: 6 },
  statusPill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  statusPillText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  modePill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  modePillText: { fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  gemsBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  gemsText: { color: '#FFD700', fontSize: 12, fontWeight: 'bold' },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  statLabel: { color: COLORS.textSecondary, fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: COLORS.border },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 14,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
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
    paddingTop: 60,
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
});
