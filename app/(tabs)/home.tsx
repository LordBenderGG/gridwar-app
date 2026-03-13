import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Switch, RefreshControl, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, onSnapshot, where, limit } from 'firebase/firestore';
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
  const { user, updateUser } = useAuthStore();
  const { mode, setMode } = useModeStore();
  const [players, setPlayers] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [incomingChallenge, setIncomingChallenge] = useState<Challenge | null>(null);
  const [challenging, setChallenging] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Limitar a 50 jugadores para no descargar toda la colección
    const q = query(collection(db, 'users'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => d.data() as UserProfile)
        .filter((p) => p.uid !== user.uid);
      setPlayers(list);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToIncomingChallenges(user.uid, (challenges) => {
      if (challenges.length > 0) setIncomingChallenge(challenges[0]);
      else setIncomingChallenge(null);
    });
    return () => unsub();
  }, [user]);

  const handleChallenge = async (target: UserProfile) => {
    if (!user) return;
    if (user.challengeBlockedUntil && Date.now() < user.challengeBlockedUntil) {
      router.push('/blocked');
      return;
    }
    setChallenging(target.uid);
    try {
      await sendChallenge(
        user.uid,
        user.username,
        user.avatar,
        user.photoURL,
        user.rank,
        user.points,
        target.uid
      );
      // Reset después de enviar con éxito (el listener de retos reacciona desde el otro lado)
      setChallenging(null);
    } catch (e) {
      setChallenging(null);
    }
  };

  const handleAcceptChallenge = async () => {
    if (!incomingChallenge || !user) return;
    const gameId = await acceptChallenge(
      incomingChallenge.challengeId,
      incomingChallenge,
      user.username,
      user.avatar
    );
    setIncomingChallenge(null);
    router.push(`/game/${gameId}`);
  };

  const handleRejectChallenge = async () => {
    if (!incomingChallenge || !user) return;
    await rejectChallenge(incomingChallenge.challengeId, incomingChallenge.from, user.uid);
    setIncomingChallenge(null);
  };

  const onRefresh = useCallback(() => {
    // Los datos ya se actualizan via onSnapshot; solo reseteamos el estado visual
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const toggleMode = async (val: boolean) => {
    const newMode = val ? 'local' : 'global';
    setMode(newMode);
    if (user) await updateUserProfile(user.uid, { mode: newMode });
  };

  const canChallenge = (target: UserProfile) => {
    if (!user) return false;
    if (user.status !== 'available') return false;
    if (target.status !== 'available') return false;
    if (target.mode === 'local' && mode === 'global') return false;
    return true;
  };

  const filtered = players.filter((p) =>
    p.username.toLowerCase().includes(search.toLowerCase())
  );

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
            challengeDisabled={!canChallenge(item) || challenging === item.uid}
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
    gap: 16,
    marginBottom: 12,
  },
  stat: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
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
