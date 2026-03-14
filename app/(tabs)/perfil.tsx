import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { logoutUser, uploadProfilePhoto, updateUserProfile } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { getRankInfo, RANKS } from '../../services/ranking';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS } from '../../constants/theme';

interface HistoryItem {
  gameId: string;
  opponentUsername: string;
  result: 'win' | 'loss';
  score: string;
  date: any;
  type: string;
}

export default function PerfilScreen() {
  const router = useRouter();
  const { user, setUser, updateUser } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'history'),
          orderBy('date', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        setHistory(snap.docs.map((d) => d.data() as HistoryItem));
      } catch {
        // Sin historial todavía
      }
    };
    fetchHistory();
  }, [user?.uid]);

  const handleLogout = async () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive', onPress: async () => {
          await logoutUser();
          setUser(null);
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handleChangePhoto = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso denegado',
        'Para cambiar tu foto necesitamos acceso a la galería.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!result.canceled) {
        const photoURL = await uploadProfilePhoto(user.uid, result.assets[0].uri);
        updateUser({ photoURL });
      }
    } catch {
      Alert.alert('Error', 'No se pudo cambiar la foto. Intenta de nuevo.');
    }
  };

  if (!user) return null;

  const rankInfo = getRankInfo(user.rank);
  const avatarSource = user.photoURL
    ? { uri: user.photoURL }
    : AVATARS[user.avatar] || AVATARS['avatar_1'];

  const winRate = user.gamesPlayed > 0
    ? Math.round((user.wins / user.gamesPlayed) * 100)
    : 0;

  // Calcular progreso hacia el siguiente rango
  const currentRankIndex = RANKS.findIndex((r) => r.name === user.rank);
  const nextRank = currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;
  const currentRankData = RANKS[currentRankIndex];
  const progressPct = nextRank
    ? Math.min(1, (user.points - currentRankData.min) / (nextRank.min - currentRankData.min))
    : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Fondo decorativo del hero */}
      <View style={[styles.heroBg, { backgroundColor: rankInfo.color + '12' }]} />

      {/* Avatar */}
      <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarContainer}>
        <View style={[styles.avatarRing, { borderColor: rankInfo.color }]}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>📷</Text>
        </View>
      </TouchableOpacity>

      {/* Nombre y rango */}
      <Text style={styles.username}>{user.username}</Text>
      <View style={styles.rankPill}>
        <Text style={styles.rankPillIcon}>{rankInfo.icon}</Text>
        <Text style={[styles.rankPillText, { color: rankInfo.color }]}>{user.rank}</Text>
      </View>

      {/* Progreso de rango */}
      {nextRank && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{rankInfo.icon} {user.rank}</Text>
            <Text style={styles.progressPoints}>{user.points} / {nextRank.min} pts</Text>
            <Text style={styles.progressLabel}>{nextRank.icon} {nextRank.name}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              { width: `${progressPct * 100}%`, backgroundColor: rankInfo.color },
            ]} />
          </View>
        </View>
      )}

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{user.points}</Text>
          <Text style={styles.statLabel}>PUNTOS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.accent }]}>{user.gems}</Text>
          <Text style={styles.statLabel}>💎 GEMAS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{user.wins}</Text>
          <Text style={styles.statLabel}>VICTORIAS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.danger }]}>{user.losses}</Text>
          <Text style={styles.statLabel}>DERROTAS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user.gamesPlayed}</Text>
          <Text style={styles.statLabel}>PARTIDAS</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{winRate}%</Text>
          <Text style={styles.statLabel}>WIN RATE</Text>
        </View>
      </View>

      {/* Historial */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>HISTORIAL</Text>
        <Text style={styles.sectionCount}>{history.length} partidas</Text>
      </View>

      {history.length === 0 ? (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryEmoji}>🎮</Text>
          <Text style={styles.emptyHistoryText}>Aún no has jugado ninguna partida</Text>
        </View>
      ) : (
        history.map((item) => (
          <View
            key={item.gameId}
            style={[styles.historyItem, item.result === 'win' ? styles.winItem : styles.lossItem]}
          >
            <View style={[styles.resultBadge, item.result === 'win' ? styles.winBadge : styles.lossBadge]}>
              <Text style={styles.resultBadgeText}>
                {item.result === 'win' ? '✓ WIN' : '✗ LOSE'}
              </Text>
            </View>
            <View style={styles.historyInfo}>
              <Text style={styles.historyOpponent}>vs {item.opponentUsername}</Text>
              <Text style={styles.historyScore}>{item.score}</Text>
            </View>
            <Text style={styles.historyTypeIcon}>
              {item.type === 'global' ? '🌍' : item.type === 'tournament' ? '🏆' : '📡'}
            </Text>
          </View>
        ))
      )}

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { alignItems: 'center', padding: 20, paddingTop: 50, paddingBottom: 48 },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  avatarContainer: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    padding: 3,
    backgroundColor: COLORS.background,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  editBadgeText: { fontSize: 16 },
  username: { color: COLORS.text, fontSize: 26, fontWeight: '900', marginBottom: 6 },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  rankPillIcon: { fontSize: 16 },
  rankPillText: { fontSize: 14, fontWeight: '700' },
  progressSection: { width: '100%', marginBottom: 24 },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: { color: COLORS.textSecondary, fontSize: 11 },
  progressPoints: { color: COLORS.text, fontSize: 12, fontWeight: 'bold' },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 28,
  },
  statBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    width: '30%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginTop: 3 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  sectionCount: { color: COLORS.textMuted, fontSize: 11 },
  emptyHistory: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyHistoryEmoji: { fontSize: 36 },
  emptyHistoryText: { color: COLORS.textSecondary, fontSize: 13 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    gap: 10,
  },
  winItem: { backgroundColor: 'rgba(0,230,118,0.06)', borderColor: COLORS.success },
  lossItem: { backgroundColor: 'rgba(255,23,68,0.06)', borderColor: COLORS.danger },
  resultBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  winBadge: { backgroundColor: COLORS.success },
  lossBadge: { backgroundColor: COLORS.danger },
  resultBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  historyInfo: { flex: 1 },
  historyOpponent: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  historyScore: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  historyTypeIcon: { fontSize: 18 },
  logoutBtn: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  logoutText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 15 },
});
