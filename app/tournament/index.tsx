import React, { useEffect, useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getActiveTournaments, Tournament } from '../../services/tournament';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants/theme';

export default function TournamentListScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveTournaments().then((t) => {
      setTournaments(t);
      setLoading(false);
    });
  }, []);

  const renderItem = ({ item }: { item: Tournament }) => {
    const isFull = item.players.length >= item.maxPlayers;
    const isJoined = item.players.includes(user?.uid || '');
    const statusColor = item.status === 'active' ? COLORS.success : item.status === 'finished' ? COLORS.textSecondary : COLORS.warning;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/tournament/${item.tournamentId}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.tournamentName}>{item.name}</Text>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {item.status === 'waiting' ? 'Esperando' : item.status === 'active' ? 'En curso' : 'Finalizado'}
            </Text>
          </View>
        </View>
        <Text style={styles.info}>
          👥 {item.players.length}/{item.maxPlayers} jugadores
        </Text>
        <Text style={styles.prize}>🏆 Premio: {item.prize} gemas</Text>
        {isJoined && <Text style={styles.joined}>✅ Ya estás inscrito</Text>}
        {!isJoined && !isFull && item.status === 'waiting' && (
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => router.push(`/tournament/${item.tournamentId}`)}
          >
            <Text style={styles.joinBtnText}>UNIRSE</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏆 TORNEOS</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/tournament/crear')}
        >
          <Text style={styles.createBtnText}>+ Crear</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.tournamentId}
          renderItem={renderItem}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>🏟️ No hay torneos activos</Text>
              <Text style={styles.emptySubtext}>¡Crea el primero!</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: COLORS.primary, fontSize: 24, fontWeight: '900', letterSpacing: 4 },
  createBtn: { backgroundColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 },
  createBtnText: { color: COLORS.background, fontWeight: 'bold' },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  tournamentName: { color: COLORS.text, fontSize: 17, fontWeight: 'bold' },
  statusBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: 'bold' },
  info: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  prize: { color: COLORS.warning, fontSize: 13, marginBottom: 8 },
  joined: { color: COLORS.success, fontSize: 12 },
  joinBtn: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 6 },
  joinBtnText: { color: COLORS.background, fontWeight: 'bold' },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
});
