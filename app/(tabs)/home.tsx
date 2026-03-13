import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Switch, RefreshControl, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  collection, query, onSnapshot, limit, doc, updateDoc,
  where, orderBy, getDocs, onSnapshot as fsOnSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { UserProfile, updateUserProfile } from '../../services/auth';
import { sendChallenge, subscribeToIncomingChallenges, acceptChallenge, rejectChallenge, Challenge } from '../../services/challenge';
import { useAuthStore } from '../../store/authStore';
import { useModeStore } from '../../store/modeStore';
import PlayerCard from '../../components/PlayerCard';
import ChallengeModal from '../../components/ChallengeModal';
import { COLORS } from '../../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { mode, setMode } = useModeStore();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
  // null = nadie siendo retado, string = uid del jugador que se está retando
  const [challenging, setChallenging] = useState<string | null>(null);
  // Reto enviado esperando respuesta
  const [sentChallengeId, setSentChallengeId] = useState<string | null>(null);
  const [sentChallengeTo, setSentChallengeTo] = useState<string | null>(null);
  const challengeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Asegurarse de que el status del usuario sea 'available' al entrar a la pantalla
  useEffect(() => {
    if (!user) return;
    // Si el usuario llega con un status "sucio" de una sesión anterior, limpiarlo
    if (user.status === 'in_game' || user.status === 'blocked') {
      // Solo limpiar 'challenged' y estados que no deberían persistir entre sesiones
      // 'in_game' se limpia en finishMatch, 'blocked' tiene tiempo de bloqueo real
    }
  }, [user?.uid]);

  // Suscripción a la lista de jugadores
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as UserProfile)
        .filter((p) => p.uid !== user.uid);
      setPlayers(list);
    });
    return () => unsub();
  }, [user?.uid]);

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
        if (data.status === 'accepted') {
          clearPendingChallenge();
          findAndNavigateToGame(data);
        } else if (data.status === 'rejected' || data.status === 'expired') {
          clearPendingChallenge();
          Alert.alert('Reto rechazado', 'El jugador rechazó tu reto o no respondió a tiempo.');
        }
      }
    );
    return () => unsub();
  }, [sentChallengeId]);

  const findAndNavigateToGame = async (challengeData: any) => {
    try {
      const gamesQ = query(
        collection(db, 'games'),
        where('player1', 'in', [challengeData.from, challengeData.to]),
        where('status', '==', 'active'),
        orderBy('createdAt', 'desc'),
        limit(1)
      );
      const snap = await getDocs(gamesQ);
      if (!snap.empty) {
        const gameId = snap.docs[0].id;
        router.push(`/game/${gameId}`);
      }
    } catch (_) {
      // Si falla la búsqueda, el usuario puede ir a Retos para ver el estado
    }
  };

  const clearPendingChallenge = () => {
    if (challengeTimeoutRef.current) clearTimeout(challengeTimeoutRef.current);
    setChallenging(null);
    setSentChallengeId(null);
    setSentChallengeTo(null);
  };

  const handleChallenge = async (target: UserProfile) => {
    if (!user) return;

    // Verificar bloqueo
    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) {
      router.push('/blocked');
      return;
    }

    // Verificar que el usuario esté disponible
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

    // Verificar que el objetivo esté disponible
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

      // Timeout de seguridad por si el listener falla
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
    try {
      await rejectChallenge(incomingChallenge.challengeId, incomingChallenge.from, user.uid);
    } catch (_) {}
    setIncomingChallenge(null);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const toggleMode = async (val: boolean) => {
    const newMode = val ? 'local' : 'global';
    setMode(newMode);
    if (user) await updateUserProfile(user.uid, { mode: newMode });
  };

  const canChallenge = (target: UserProfile): boolean => {
    if (!user) return false;
    if (user.status !== 'available') return false;
    if (target.status !== 'available') return false;
    if (challenging !== null) return false; // ya retando a alguien
    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) return false;
    return true;
  };

  const filtered = players.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase())
  );

  // Pantalla de "esperando respuesta al reto"
  if (sentChallengeId && sentChallengeTo) {
    const targetPlayer = players.find((p) => p.uid === sentChallengeTo);
    return (
      <View style={styles.waitingContainer}>
        <Text style={styles.logo}>TIKTAK</Text>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginBottom: 24 }} />
        <Text style={styles.waitingTitle}>RETO ENVIADO</Text>
        <Text style={styles.waitingSubtitle}>
          Esperando respuesta de{'\n'}
          <Text style={styles.waitingName}>{targetPlayer?.username || '...'}</Text>
        </Text>
        <Text style={styles.waitingHint}>El reto expira en 30 segundos</Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelChallenge}>
          <Text style={styles.cancelBtnText}>CANCELAR RETO</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>TIKTAK</Text>
        <View style={styles.modeRow}>
          <Text style={styles.modeLabel}>🌍 Global</Text>
          <Switch
            value={mode === 'local'}
            onValueChange={toggleMode}
            trackColor={{ false: COLORS.primary, true: COLORS.secondary }}
            thumbColor={COLORS.text}
          />
          <Text style={styles.modeLabel}>📡 Local</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.stat}>💎 {user?.gems || 0}</Text>
        <Text style={styles.stat}>⭐ {user?.points || 0} pts</Text>
        <Text style={styles.stat}>{user?.rank}</Text>
        <View style={[styles.statusBadge, { backgroundColor: user?.status === 'available' ? COLORS.success : COLORS.warning }]}>
          <Text style={styles.statusBadgeText}>
            {user?.status === 'available' ? '● Disponible' : user?.status === 'in_game' ? '● En partida' : '● Ocupado'}
          </Text>
        </View>
      </View>

      <TextInput
        style={styles.search}
        placeholder="🔍 Buscar jugador..."
        placeholderTextColor={COLORS.textSecondary}
        value={search}
        onChangeText={setSearch}
      />

      <Text style={styles.sectionTitle}>JUGADORES ({filtered.length})</Text>

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
          <Text style={styles.empty}>No hay jugadores disponibles</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
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
  waitingTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 4,
    marginBottom: 12,
  },
  waitingSubtitle: {
    color: COLORS.text,
    fontSize: 16,
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
    marginBottom: 32,
  },
  cancelBtn: {
    backgroundColor: COLORS.danger,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
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
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 4,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  stat: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  statusBadgeText: {
    color: COLORS.background,
    fontSize: 10,
    fontWeight: 'bold',
  },
  search: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
  },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
});
