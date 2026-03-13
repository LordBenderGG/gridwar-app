import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { subscribeToTopPlayers, getWinnerTitle, getRankInfo } from '../../services/ranking';
import { UserProfile } from '../../services/auth';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS } from '../../constants/theme';

const ChampionRow: React.FC<{ player: UserProfile; position: number }> = ({
  player, position,
}) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const title = getWinnerTitle(position);

  const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
  const posColor = position <= 3 ? medalColors[position - 1] : COLORS.textSecondary;

  return (
    <View style={[styles.row, position === 1 && styles.topRow]}>
      <Text style={[styles.position, { color: posColor }]}>
        {position <= 3 ? ['🥇', '🥈', '🥉'][position - 1] : `#${position}`}
      </Text>
      <Image source={avatarSource} style={[styles.avatar, position === 1 && styles.topAvatar]} />
      <View style={styles.info}>
        <Text style={[styles.username, position === 1 && styles.topUsername]}>{player.username}</Text>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rank, { color: rankInfo.color }]}>
          {rankInfo.icon} {player.rank}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.points, position <= 3 && { color: posColor }]}>
          {player.points} pts
        </Text>
        <Text style={styles.record}>
          {player.wins}W / {player.losses}L
        </Text>
        <Text style={styles.winRate}>
          {player.gamesPlayed > 0
            ? `${Math.round((player.wins / player.gamesPlayed) * 100)}% victorias`
            : 'Sin partidas'}
        </Text>
      </View>
    </View>
  );
};

export default function ClasificacionScreen() {
  const [topPlayers, setTopPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = subscribeToTopPlayers((players) => {
      setTopPlayers(players);
      setLoading(false);
    }, 20);
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>🏆 CLASIFICACIÓN</Text>
      <Text style={styles.screenSubtitle}>Los mejores jugadores del tablero</Text>

      <FlatList
        data={topPlayers}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => (
          <ChampionRow player={item} position={index + 1} />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>Aún no hay jugadores clasificados</Text>
        }
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.warning,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 4,
    textShadowColor: COLORS.warning,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  screenSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  topRow: {
    borderColor: '#FFD700',
    borderWidth: 2,
    backgroundColor: 'rgba(255,215,0,0.05)',
  },
  position: {
    fontWeight: 'bold',
    fontSize: 20,
    width: 40,
    textAlign: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  topAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderColor: '#FFD700',
    borderWidth: 2,
  },
  info: { flex: 1 },
  username: { color: COLORS.text, fontWeight: 'bold', fontSize: 15 },
  topUsername: { fontSize: 16, color: '#FFD700' },
  title: {
    color: COLORS.primary,
    fontSize: 10,
    marginTop: 1,
    fontStyle: 'italic',
  },
  rank: { fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  points: { color: COLORS.success, fontWeight: 'bold', fontSize: 15 },
  record: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  winRate: { color: COLORS.textSecondary, fontSize: 10, marginTop: 1 },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
});
