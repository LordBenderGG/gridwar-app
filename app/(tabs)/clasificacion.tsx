import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
  Dimensions,
} from 'react-native';
import { subscribeToTopPlayers, getWinnerTitle, getRankInfo } from '../../services/ranking';
import { UserProfile } from '../../services/auth';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS } from '../../constants/theme';

const { width } = Dimensions.get('window');

const PODIUM_COLORS = ['#FFD600', '#B0BEC5', '#FF6D00'];
const PODIUM_GLOW   = ['rgba(255,214,0,0.25)', 'rgba(176,190,197,0.15)', 'rgba(255,109,0,0.2)'];
const PODIUM_LABELS = ['🥇 CAMPEÓN', '🥈 SUBCAMPEÓN', '🥉 TERCER LUGAR'];

const TopThreeCard: React.FC<{ player: UserProfile; position: number }> = ({ player, position }) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const accentColor = PODIUM_COLORS[position - 1];
  const glowColor = PODIUM_GLOW[position - 1];
  const label = PODIUM_LABELS[position - 1];
  const title = getWinnerTitle(position);
  const winRate = player.gamesPlayed > 0
    ? Math.round((player.wins / player.gamesPlayed) * 100)
    : 0;

  return (
    <View style={[styles.topCard, { borderColor: accentColor, backgroundColor: glowColor }]}>
      {/* Posición crown */}
      <Text style={[styles.topCardLabel, { color: accentColor }]}>{label}</Text>

      {/* Avatar */}
      <View style={styles.topAvatarWrapper}>
        <Image source={avatarSource} style={[styles.topAvatar, { borderColor: accentColor }]} />
        <View style={[styles.topAvatarGlow, { shadowColor: accentColor }]} />
        <View style={[styles.positionBadge, { backgroundColor: accentColor }]}>
          <Text style={styles.positionBadgeText}>#{position}</Text>
        </View>
      </View>

      <Text style={[styles.topUsername, { color: accentColor }]}>{player.username}</Text>
      <Text style={styles.topTitle} numberOfLines={1}>{title}</Text>
      <Text style={[styles.topRank, { color: rankInfo.color }]}>{rankInfo.icon} {player.rank}</Text>

      <View style={styles.topStats}>
        <View style={styles.topStatItem}>
          <Text style={[styles.topStatValue, { color: accentColor }]}>{player.points}</Text>
          <Text style={styles.topStatLabel}>PTS</Text>
        </View>
        <View style={styles.topStatDivider} />
        <View style={styles.topStatItem}>
          <Text style={[styles.topStatValue, { color: COLORS.success }]}>{player.wins}</Text>
          <Text style={styles.topStatLabel}>WINS</Text>
        </View>
        <View style={styles.topStatDivider} />
        <View style={styles.topStatItem}>
          <Text style={[styles.topStatValue, { color: COLORS.primary }]}>{winRate}%</Text>
          <Text style={styles.topStatLabel}>RATIO</Text>
        </View>
      </View>
    </View>
  );
};

const RankRow: React.FC<{ player: UserProfile; position: number }> = ({ player, position }) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const winRate = player.gamesPlayed > 0
    ? Math.round((player.wins / player.gamesPlayed) * 100)
    : 0;

  return (
    <View style={styles.row}>
      <Text style={styles.rowPosition}>#{position}</Text>
      <Image source={avatarSource} style={styles.rowAvatar} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowUsername}>{player.username}</Text>
        <Text style={[styles.rowRank, { color: rankInfo.color }]}>{rankInfo.icon} {player.rank}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowPoints}>{player.points} pts</Text>
        <Text style={styles.rowStats}>{player.wins}W · {winRate}%</Text>
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

  const top3 = topPlayers.slice(0, 3);
  const rest = topPlayers.slice(3);

  const ListHeader = () => (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>🏆</Text>
        <Text style={styles.headerTitle}>CLASIFICACIÓN</Text>
        <Text style={styles.headerSub}>Los mejores guerreros del tablero</Text>
      </View>

      {/* Top 3 podium */}
      {top3.map((player, i) => (
        <TopThreeCard key={player.uid} player={player} position={i + 1} />
      ))}

      {rest.length > 0 && (
        <Text style={styles.restTitle}>RESTO DEL RANKING</Text>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={rest}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => (
          <RankRow player={item} position={index + 4} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.empty}>Aún no hay jugadores clasificados</Text>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { alignItems: 'center', marginBottom: 20 },
  headerEmoji: { fontSize: 48, marginBottom: 6 },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: 4,
    textShadowColor: COLORS.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 4,
  },
  headerSub: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 1 },
  topCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  topCardLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 12,
  },
  topAvatarWrapper: { position: 'relative', marginBottom: 10 },
  topAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  topAvatarGlow: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 44,
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  positionBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  positionBadgeText: { color: COLORS.background, fontSize: 10, fontWeight: '900' },
  topUsername: { fontSize: 20, fontWeight: '900', marginBottom: 2 },
  topTitle: { color: COLORS.textSecondary, fontSize: 11, fontStyle: 'italic', marginBottom: 4 },
  topRank: { fontSize: 13, fontWeight: '600', marginBottom: 14 },
  topStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 12,
    padding: 10,
    gap: 0,
  },
  topStatItem: { flex: 1, alignItems: 'center' },
  topStatValue: { fontSize: 18, fontWeight: '900' },
  topStatLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 1 },
  topStatDivider: { width: 1, backgroundColor: COLORS.border },
  restTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 8,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rowPosition: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: 'bold',
    width: 32,
    textAlign: 'center',
  },
  rowAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 10,
  },
  rowInfo: { flex: 1 },
  rowUsername: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  rowRank: { fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowPoints: { color: COLORS.success, fontWeight: 'bold', fontSize: 14 },
  rowStats: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  empty: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 60,
    fontSize: 14,
  },
});
