import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { subscribeToBottomPlayers, getLoserTitle, getRankInfo } from '../../services/ranking';
import { UserProfile } from '../../services/auth';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS } from '../../constants/theme';

const SHAME_PHRASES = [
  '¡NADIE ES TAN MALO!',
  'EXPERTOS EN PERDER',
  'EL FONDO DEL ABISMO',
  'SIN ESPERANZA',
  'LA DESHONRA DEL TABLERO',
];

const LoserRow: React.FC<{ player: UserProfile; position: number }> = ({
  player, position,
}) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const title = getLoserTitle(position);

  return (
    <View style={[styles.row, position === 1 && styles.bottomRow]}>
      <Text style={styles.position}>💀{position}</Text>
      <Image source={avatarSource} style={styles.avatar} />
      <View style={styles.info}>
        <Text style={styles.username}>{player.username}</Text>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rank, { color: rankInfo.color }]}>
          {rankInfo.icon} {player.rank}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.points}>{player.points} pts</Text>
        <Text style={styles.record}>
          {player.wins}W / {player.losses}L
        </Text>
        <Text style={styles.lossRate}>
          {player.gamesPlayed > 0
            ? `${Math.round((player.losses / player.gamesPlayed) * 100)}% derrotas`
            : 'Sin partidas'}
        </Text>
      </View>
    </View>
  );
};

export default function SalonScreen() {
  const [bottomPlayers, setBottomPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [phrase] = useState(() => SHAME_PHRASES[Math.floor(Math.random() * SHAME_PHRASES.length)]);

  useEffect(() => {
    const unsub = subscribeToBottomPlayers((players) => {
      // Filtrar solo jugadores que hayan jugado al menos 1 partida
      const withGames = players.filter((p) => p.gamesPlayed > 0);
      setBottomPlayers(withGames);
      setLoading(false);
    }, 20);
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.danger} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.screenTitle}>💀 SALÓN DE LA</Text>
      <Text style={styles.screenTitleRed}>VERGÜENZA</Text>
      <Text style={styles.screenSubtitle}>{phrase}</Text>

      {bottomPlayers.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>¡Nadie aquí aún!</Text>
          <Text style={styles.emptyText}>
            Todavía no hay suficientes jugadores con partidas para el salón de la vergüenza.
          </Text>
        </View>
      ) : (
        <FlatList
          data={bottomPlayers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item, index }) => (
            <LoserRow player={item} position={index + 1} />
          )}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.danger,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 0,
    textShadowColor: COLORS.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  screenTitleRed: {
    fontSize: 30,
    fontWeight: '900',
    color: COLORS.danger,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 6,
    textShadowColor: COLORS.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  screenSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.06)',
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.25)',
  },
  bottomRow: {
    borderColor: COLORS.danger,
    borderWidth: 2,
    backgroundColor: 'rgba(255,59,48,0.12)',
  },
  position: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 16,
    width: 42,
    textAlign: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,59,48,0.4)',
    opacity: 0.85,
  },
  info: { flex: 1 },
  username: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 14,
  },
  title: {
    color: COLORS.danger,
    fontSize: 10,
    marginTop: 1,
    fontStyle: 'italic',
  },
  rank: { fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  points: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 14,
  },
  record: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  lossRate: {
    color: COLORS.danger,
    fontSize: 10,
    marginTop: 1,
    opacity: 0.8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
