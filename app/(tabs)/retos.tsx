import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/authStore';
import { Challenge, acceptChallenge, rejectChallenge } from '../../services/challenge';
import { AVATARS } from '../../components/AvatarPicker';
import { getRankInfo } from '../../services/ranking';
import { COLORS } from '../../constants/theme';

export default function RetosScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [, setTick] = useState(0); // Para forzar re-render del contador cada segundo

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'challenges'),
      where('to', '==', user.uid),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(q, (snap) => {
      setChallenges(snap.docs.map((d) => d.data() as Challenge));
    });
    return () => unsub();
  }, [user]);

  // Actualizar el contador de tiempo cada segundo
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const handleAccept = async (challenge: Challenge) => {
    if (!user) return;
    if (Date.now() > challenge.expiresAt) {
      Alert.alert('Reto expirado', 'Este reto ya no está disponible.');
      return;
    }
    try {
      const gameId = await acceptChallenge(challenge.challengeId, challenge, user.username, user.avatar);
      router.push(`/game/${gameId}`);
    } catch {
      Alert.alert('Error', 'No se pudo aceptar el reto. Intenta de nuevo.');
    }
  };

  const handleReject = async (challenge: Challenge) => {
    if (!user) return;
    try {
      await rejectChallenge(challenge.challengeId, challenge.from, user.uid);
    } catch {
      Alert.alert('Error', 'No se pudo rechazar el reto.');
    }
  };

  const renderItem = ({ item }: { item: Challenge }) => {
    const rankInfo = getRankInfo(item.fromRank);
    const avatarSource = item.fromPhotoURL
      ? { uri: item.fromPhotoURL }
      : AVATARS[item.fromAvatar] || AVATARS['avatar_1'];
    const secondsLeft = Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000));

    return (
      <View style={styles.card}>
        <Image source={avatarSource} style={styles.avatar} />
        <View style={styles.info}>
          <Text style={styles.username}>{item.fromUsername}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>
            {rankInfo.icon} {item.fromRank} · {item.fromPoints} pts
          </Text>
          <Text style={[styles.time, secondsLeft <= 5 && styles.timeCritical]}>
            ⏱ {secondsLeft}s restantes
          </Text>
        </View>
        <View style={styles.buttons}>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item)}>
            <Text style={styles.acceptText}>✅ ACEPTAR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item)}>
            <Text style={styles.rejectText}>✗</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚔️ RETOS</Text>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.challengeId}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>😴 Sin retos pendientes</Text>
            <Text style={styles.emptySubtext}>Cuando alguien te rete, aparecerá aquí</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  title: {
    fontSize: 24, fontWeight: '900', color: COLORS.primary,
    letterSpacing: 4, marginBottom: 20, textAlign: 'center',
  },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 16,
    padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: COLORS.primary,
  },
  avatar: { width: 56, height: 56, borderRadius: 28, marginRight: 12 },
  info: { flex: 1 },
  username: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  rank: { fontSize: 12, marginTop: 2 },
  time: { color: COLORS.warning, fontSize: 12, marginTop: 2 },
  timeCritical: { color: COLORS.danger, fontWeight: 'bold' },
  buttons: { gap: 8 },
  acceptBtn: {
    backgroundColor: COLORS.primary, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  acceptText: { color: COLORS.background, fontWeight: 'bold', fontSize: 12 },
  rejectBtn: {
    borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    alignItems: 'center',
  },
  rejectText: { color: COLORS.danger, fontWeight: 'bold' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8, textAlign: 'center' },
});
