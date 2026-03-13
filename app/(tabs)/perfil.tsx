import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Alert, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { logoutUser, uploadProfilePhoto, updateUserProfile } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { getRankInfo } from '../../services/ranking';
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
        // Sin historial todavía o fallo de red — no bloquea la pantalla
      }
    };
    fetchHistory();
  }, [user]);

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
        'Para cambiar tu foto necesitamos acceso a la galería. Ve a Ajustes > Permisos y activa el acceso a fotos.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1, // La optimización la hace uploadProfilePhoto con expo-image-manipulator
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarContainer}>
        <Image source={avatarSource} style={styles.avatar} />
        <View style={styles.editBadge}><Text style={styles.editBadgeText}>📷</Text></View>
      </TouchableOpacity>

      <Text style={styles.username}>{user.username}</Text>
      <Text style={[styles.rank, { color: rankInfo.color }]}>
        {rankInfo.icon} {user.rank}
      </Text>

      {/* Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user.points}</Text>
          <Text style={styles.statLabel}>Puntos</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: '#FFD700' }]}>{user.gems}</Text>
          <Text style={styles.statLabel}>💎 Gemas</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{user.wins}</Text>
          <Text style={styles.statLabel}>Victorias</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.danger }]}>{user.losses}</Text>
          <Text style={styles.statLabel}>Derrotas</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user.gamesPlayed}</Text>
          <Text style={styles.statLabel}>Jugadas</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{winRate}%</Text>
          <Text style={styles.statLabel}>Win Rate</Text>
        </View>
      </View>

      {/* Historial */}
      <Text style={styles.sectionTitle}>HISTORIAL</Text>
      {history.length === 0 ? (
        <Text style={styles.emptyHistory}>Aún no has jugado ninguna partida</Text>
      ) : (
        history.map((item) => (
          <View key={item.gameId} style={[styles.historyItem, item.result === 'win' ? styles.winItem : styles.lossItem]}>
            <Text style={[styles.resultBadge, item.result === 'win' ? styles.winBadge : styles.lossBadge]}>
              {item.result === 'win' ? 'VICTORIA' : 'DERROTA'}
            </Text>
            <View style={styles.historyInfo}>
              <Text style={styles.historyOpponent}>vs {item.opponentUsername}</Text>
              <Text style={styles.historyScore}>{item.score}</Text>
            </View>
            <Text style={styles.historyType}>{item.type === 'global' ? '🌍' : item.type === 'tournament' ? '🏆' : '📡'}</Text>
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
  content: { alignItems: 'center', padding: 20, paddingTop: 50, paddingBottom: 40 },
  avatarContainer: { position: 'relative', marginBottom: 12 },
  avatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: COLORS.primary,
  },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: COLORS.surface, borderRadius: 14,
    width: 28, height: 28, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primary,
  },
  editBadgeText: { fontSize: 14 },
  username: { color: COLORS.text, fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  rank: { fontSize: 16, fontWeight: '600', marginBottom: 20 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 10, width: '100%', marginBottom: 24,
  },
  statBox: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 14, alignItems: 'center', width: '30%',
    borderWidth: 1, borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: 'bold' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: 12, fontWeight: 'bold',
    letterSpacing: 1, alignSelf: 'flex-start', marginBottom: 10, width: '100%',
  },
  emptyHistory: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 20 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 10, padding: 10, marginBottom: 8, width: '100%',
    borderWidth: 1,
  },
  winItem: { backgroundColor: 'rgba(52,199,89,0.08)', borderColor: COLORS.success },
  lossItem: { backgroundColor: 'rgba(255,59,48,0.08)', borderColor: COLORS.danger },
  resultBadge: {
    fontSize: 10, fontWeight: 'bold',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginRight: 10,
  },
  winBadge: { backgroundColor: COLORS.success, color: '#fff' },
  lossBadge: { backgroundColor: COLORS.danger, color: '#fff' },
  historyInfo: { flex: 1 },
  historyOpponent: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  historyScore: { color: COLORS.textSecondary, fontSize: 12 },
  historyType: { fontSize: 18 },
  logoutBtn: {
    marginTop: 24, borderWidth: 1, borderColor: COLORS.danger,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
  },
  logoutText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 15 },
});
