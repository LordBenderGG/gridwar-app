import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { subscribeToTopPlayers, subscribeToBottomPlayers, getWinnerTitle, getLoserTitle, getRankInfo } from '../../services/ranking';
import { UserProfile } from '../../services/auth';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS } from '../../constants/theme';

const PlayerRow: React.FC<{ player: UserProfile; position: number; type: 'winner' | 'loser' }> = ({
  player, position, type,
}) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const title = type === 'winner' ? getWinnerTitle(position) : getLoserTitle(position);

  return (
    <View style={[styles.row, type === 'loser' && styles.loserRow]}>
      <Text style={[styles.position, type === 'loser' && styles.loserPosition]}>
        {type === 'winner' ? `#${position}` : `💀${position}`}
      </Text>
      <Image source={avatarSource} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.username}>{player.username}</Text>
        <Text style={[styles.title, type === 'loser' && styles.loserTitle]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.rank, { color: rankInfo.color }]}>
          {rankInfo.icon} {player.rank}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.points, type === 'loser' && styles.loserPoints]}>
          {player.points} pts
        </Text>
        <Text style={styles.record}>
          {player.wins}W / {player.losses}L
        </Text>
      </View>
    </View>
  );
};

export default function ClasificacionScreen() {
  const [topPlayers, setTopPlayers] = useState<UserProfile[]>([]);
  const [bottomPlayers, setBottomPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTop = subscribeToTopPlayers((players) => {
      setTopPlayers(players);
      setLoading(false);
    });
    const unsubBottom = subscribeToBottomPlayers((players) => {
      setBottomPlayers(players);
    });
    return () => {
      unsubTop();
      unsubBottom();
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={[]}
      renderItem={null}
      ListHeaderComponent={
        <>
          <Text style={styles.screenTitle}>CLASIFICACIÓN</Text>

          {/* CAMPEONES */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🏆 CAMPEONES</Text>
              <Text style={styles.sectionSubtitle}>Los mejores del tablero</Text>
            </View>
            {topPlayers.map((p, i) => (
              <PlayerRow key={p.uid} player={p} position={i + 1} type="winner" />
            ))}
          </View>

          {/* PERDEDORES */}
          <View style={[styles.section, styles.loserSection]}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, styles.loserSectionTitle]}>💀 SALÓN DE LA VERGÜENZA</Text>
              <Text style={styles.sectionSubtitle}>Los peores... sin piedad</Text>
            </View>
            {bottomPlayers.map((p, i) => (
              <PlayerRow key={p.uid} player={p} position={i + 1} type="loser" />
            ))}
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  screenTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 20,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  loserSection: {
    borderColor: COLORS.danger,
  },
  sectionHeader: {
    backgroundColor: COLORS.surfaceLight,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionTitle: {
    color: COLORS.warning,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  loserSectionTitle: {
    color: COLORS.danger,
  },
  sectionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  loserRow: {
    backgroundColor: 'rgba(255,59,48,0.05)',
  },
  position: {
    color: COLORS.warning,
    fontWeight: 'bold',
    fontSize: 14,
    width: 36,
  },
  loserPosition: {
    color: COLORS.danger,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 10,
  },
  info: { flex: 1 },
  username: { color: COLORS.text, fontWeight: 'bold', fontSize: 14 },
  title: {
    color: COLORS.primary,
    fontSize: 10,
    marginTop: 1,
    fontStyle: 'italic',
  },
  loserTitle: { color: COLORS.danger },
  rank: { fontSize: 11, marginTop: 1 },
  right: { alignItems: 'flex-end' },
  points: { color: COLORS.success, fontWeight: 'bold', fontSize: 14 },
  loserPoints: { color: COLORS.danger },
  record: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
});
