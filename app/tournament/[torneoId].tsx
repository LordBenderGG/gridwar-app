import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  subscribeToTournament, joinTournament, startTournament,
  Tournament,
} from '../../services/tournament';
import { useAuthStore } from '../../store/authStore';
import BracketView from '../../components/BracketView';
import { COLORS } from '../../constants/theme';

export default function TorneoScreen() {
  const router = useRouter();
  const { torneoId } = useLocalSearchParams<{ torneoId: string }>();
  const { user } = useAuthStore();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!torneoId) return;
    const unsub = subscribeToTournament(torneoId, (t) => {
      setTournament(t);
      setLoading(false);
    });
    return () => unsub();
  }, [torneoId]);

  const handleJoin = async () => {
    if (!tournament || !user) return;
    if (tournament.players.includes(user.uid)) {
      Alert.alert('Ya inscrito', 'Ya estás en este torneo.');
      return;
    }
    if (tournament.players.length >= tournament.maxPlayers) {
      Alert.alert('Torneo lleno', 'Ya no hay plazas disponibles.');
      return;
    }
    await joinTournament(torneoId, user.uid, user.username, user.avatar);
  };

  const handleStart = async () => {
    if (!tournament || !user) return;
    if (tournament.players.length < 4) {
      Alert.alert('Faltan jugadores', `Necesitas al menos 4 jugadores. Actualmente: ${tournament.players.length}`);
      return;
    }
    Alert.alert(
      'Iniciar torneo',
      `¿Iniciar con ${tournament.players.length} jugadores? No se podrán unir más.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar', onPress: async () => {
            setStarting(true);
            try {
              await startTournament(torneoId);
            } catch (e) {
              Alert.alert('Error', 'No se pudo iniciar el torneo.');
            }
            setStarting(false);
          },
        },
      ]
    );
  };

  const handleShare = () => {
    Share.share({
      message: `¡Únete al torneo "${tournament?.name}" en TIKTAK! Código: ${torneoId}`,
    });
  };

  if (loading || !tournament) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const isCreator = tournament.createdBy === user?.uid;
  const isJoined = tournament.players.includes(user?.uid || '');
  const isFull = tournament.players.length >= tournament.maxPlayers;
  const isWaiting = tournament.status === 'waiting';
  const isActive = tournament.status === 'active';
  const isFinished = tournament.status === 'finished';

  const statusColor = isActive
    ? COLORS.success
    : isFinished
    ? COLORS.textSecondary
    : COLORS.warning;

  const statusLabel = isWaiting
    ? '⏳ Esperando jugadores'
    : isActive
    ? '⚔️ En progreso'
    : '🏁 Finalizado';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Torneos</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{tournament.name}</Text>

      <View style={styles.statusRow}>
        <Text style={[styles.statusBadge, { color: statusColor, borderColor: statusColor }]}>
          {statusLabel}
        </Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareBtn}>📤 Compartir</Text>
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tournament.players.length}/{tournament.maxPlayers}</Text>
          <Text style={styles.statLabel}>Jugadores</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{tournament.prize} 💎</Text>
          <Text style={styles.statLabel}>Premio</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tournament.currentRound}</Text>
          <Text style={styles.statLabel}>Ronda actual</Text>
        </View>
      </View>

      {/* Winner banner */}
      {isFinished && tournament.winner && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerLabel}>🏆 CAMPEÓN</Text>
          <Text style={styles.winnerName}>
            {tournament.playerUsernames[tournament.winner] || tournament.winner}
          </Text>
        </View>
      )}

      {/* Players list */}
      {isWaiting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>JUGADORES INSCRITOS ({tournament.players.length}/{tournament.maxPlayers})</Text>
          {tournament.players.map((uid) => (
            <View key={uid} style={styles.playerRow}>
              <View style={[styles.playerDot, uid === tournament.createdBy && styles.creatorDot]} />
              <Text style={styles.playerName}>
                {tournament.playerUsernames[uid] || uid}
                {uid === tournament.createdBy && ' 👑'}
                {uid === user?.uid && ' (tú)'}
              </Text>
            </View>
          ))}
          {/* Placeholder slots */}
          {Array.from({ length: tournament.maxPlayers - tournament.players.length }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.playerRow, styles.playerRowEmpty]}>
              <View style={styles.playerDotEmpty} />
              <Text style={styles.playerNameEmpty}>Esperando...</Text>
            </View>
          ))}
        </View>
      )}

      {/* Bracket */}
      {(isActive || isFinished) && Object.keys(tournament.bracket).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BRACKET</Text>
          <BracketView
            bracket={tournament.bracket}
            currentRound={tournament.currentRound}
            currentUserId={user?.uid}
          />
        </View>
      )}

      {/* Action buttons */}
      <View style={styles.actions}>
        {isWaiting && !isJoined && !isFull && (
          <TouchableOpacity style={styles.joinBtn} onPress={handleJoin}>
            <Text style={styles.joinBtnText}>⚔️ UNIRSE AL TORNEO</Text>
          </TouchableOpacity>
        )}

        {isWaiting && isJoined && isCreator && (
          <TouchableOpacity
            style={[styles.startBtn, (starting || tournament.players.length < 4) && styles.btnDisabled]}
            onPress={handleStart}
            disabled={starting || tournament.players.length < 4}
          >
            {starting ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.startBtnText}>
                🚀 INICIAR TORNEO {tournament.players.length < 4 ? `(necesitas ${4 - tournament.players.length} más)` : ''}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {isWaiting && isJoined && !isCreator && (
          <View style={styles.waitingMsg}>
            <Text style={styles.waitingText}>
              ✅ Inscrito · Esperando que el creador inicie el torneo
            </Text>
          </View>
        )}

        {isWaiting && !isJoined && isFull && (
          <View style={styles.waitingMsg}>
            <Text style={styles.waitingText}>🚫 Torneo lleno</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  backBtn: { marginBottom: 16 },
  backText: { color: COLORS.primary, fontSize: 15 },
  title: {
    color: COLORS.text, fontSize: 24, fontWeight: '900',
    textAlign: 'center', marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  statusBadge: {
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 4, fontSize: 12, fontWeight: 'bold',
  },
  shareBtn: { color: COLORS.primary, fontSize: 13 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  winnerBanner: {
    backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 20,
    borderWidth: 2, borderColor: COLORS.warning,
  },
  winnerLabel: { color: COLORS.warning, fontSize: 12, fontWeight: 'bold', letterSpacing: 2 },
  winnerName: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: 4 },
  section: { marginBottom: 24 },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: 11,
    fontWeight: 'bold', letterSpacing: 1, marginBottom: 12,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10,
    padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: COLORS.border,
  },
  playerRowEmpty: { opacity: 0.4 },
  playerDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.success, marginRight: 10,
  },
  creatorDot: { backgroundColor: COLORS.warning },
  playerDotEmpty: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.border, marginRight: 10,
  },
  playerName: { color: COLORS.text, fontSize: 14 },
  playerNameEmpty: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },
  actions: { gap: 10 },
  joinBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  joinBtnText: { color: COLORS.background, fontWeight: '900', fontSize: 15, letterSpacing: 1 },
  startBtn: {
    backgroundColor: COLORS.success, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  startBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  waitingMsg: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  waitingText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
});
