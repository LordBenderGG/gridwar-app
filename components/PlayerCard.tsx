import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { UserProfile } from '../services/auth';
import { getRankInfo } from '../services/ranking';
import { COLORS } from '../constants/theme';
import { AVATARS } from './AvatarPicker';

interface PlayerCardProps {
  player: UserProfile;
  onChallenge?: () => void;
  challengeDisabled?: boolean;
  compact?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  onChallenge,
  challengeDisabled,
  compact = false,
}) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL
    ? { uri: player.photoURL }
    : AVATARS[player.avatar] || AVATARS['avatar_1'];

  const statusColor = {
    available: COLORS.success,
    in_game: COLORS.warning,
    challenged: COLORS.secondary,
    blocked: COLORS.danger,
  }[player.status] || COLORS.textSecondary;

  const statusLabel = {
    available: 'Disponible',
    in_game: 'En partida',
    challenged: 'Ocupado',
    blocked: 'Bloqueado',
  }[player.status] || '';

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Image source={avatarSource} style={styles.compactAvatar} />
        <View style={styles.compactInfo}>
          <Text style={styles.username}>{player.username}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>
            {rankInfo.icon} {player.rank}
          </Text>
        </View>
        <Text style={styles.points}>{player.points} pts</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.left}>
        <View style={styles.avatarContainer}>
          <Image source={avatarSource} style={styles.avatar} />
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        </View>
        <View style={styles.info}>
          <Text style={styles.username}>{player.username}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>
            {rankInfo.icon} {player.rank}
          </Text>
          <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          <Text style={styles.points}>{player.points} pts · {player.gems} 💎</Text>
        </View>
      </View>
      {onChallenge && (
        <TouchableOpacity
          style={[styles.challengeBtn, challengeDisabled && styles.challengeBtnDisabled]}
          onPress={onChallenge}
          disabled={challengeDisabled}
        >
          <Text style={styles.challengeBtnText}>RETAR</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  info: {
    flex: 1,
  },
  username: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  rank: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  status: {
    fontSize: 11,
    marginTop: 1,
  },
  points: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  challengeBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  challengeBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  challengeBtnText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 13,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  compactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  compactInfo: {
    flex: 1,
  },
});

export default PlayerCard;
