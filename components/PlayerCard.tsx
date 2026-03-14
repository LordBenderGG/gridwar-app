import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { UserProfile } from '../services/auth';
import { getRankInfo } from '../services/ranking';
import { COLORS } from '../constants/theme';
import { AVATARS } from './AvatarPicker';

interface PlayerCardProps {
  player: UserProfile;
  onChallenge?: () => void;
  challengeDisabled?: boolean;
  compact?: boolean;
  isOnline?: boolean;
}

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  onChallenge,
  challengeDisabled,
  compact = false,
  isOnline = true,
}) => {
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL
    ? { uri: player.photoURL }
    : AVATARS[player.avatar] || AVATARS['avatar_1'];

  const statusConfig = {
    available:  { color: COLORS.success,  label: 'Disponible', dot: '●' },
    in_game:    { color: COLORS.warning,  label: 'En partida', dot: '●' },
    challenged: { color: COLORS.secondary, label: 'Ocupado',   dot: '●' },
    blocked:    { color: COLORS.danger,   label: 'Bloqueado',  dot: '●' },
  }[player.status] || { color: COLORS.textMuted, label: 'Offline', dot: '●' };

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

  const canBeChalleng = player.status === 'available' && !challengeDisabled;

  return (
    <View style={[
      styles.container,
      canBeChalleng && styles.containerAvailable,
    ]}>
      {/* Left: Avatar + online dot */}
      <View style={styles.avatarWrapper}>
        <Image source={avatarSource} style={[styles.avatar, { borderColor: rankInfo.color }]} />
        <View style={[styles.onlineDot, { backgroundColor: statusConfig.color }]} />
      </View>

      {/* Middle: Info */}
      <View style={styles.info}>
        <View style={styles.usernameRow}>
          <Text style={styles.username}>{player.username}</Text>
          {player.wins >= 10 && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
          )}
        </View>
        <View style={styles.rankRow}>
          <Text style={styles.rankIcon}>{rankInfo.icon}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>{player.rank}</Text>
          <Text style={styles.separator}>·</Text>
          <Text style={styles.points}>{player.points} pts</Text>
        </View>
        <View style={styles.statusRow}>
          <Text style={[styles.statusDot, { color: statusConfig.color }]}>
            {statusConfig.dot}
          </Text>
          <Text style={[styles.statusLabel, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
          <Text style={styles.gems}>· {player.gems} 💎</Text>
        </View>
      </View>

      {/* Right: Challenge button */}
      {onChallenge && (
        <TouchableOpacity
          style={[
            styles.challengeBtn,
            challengeDisabled ? styles.challengeBtnDisabled : styles.challengeBtnActive,
          ]}
          onPress={onChallenge}
          disabled={challengeDisabled}
          activeOpacity={0.75}
        >
          <Text style={[
            styles.challengeIcon,
            challengeDisabled && styles.challengeIconDisabled,
          ]}>
            {challengeDisabled ? '🔒' : '⚔️'}
          </Text>
          <Text style={[
            styles.challengeBtnText,
            challengeDisabled && styles.challengeBtnTextDisabled,
          ]}>
            RETAR
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 12,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  containerAvailable: {
    borderColor: COLORS.borderBright,
    backgroundColor: COLORS.surfaceLight,
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: COLORS.background,
  },
  info: { flex: 1 },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  username: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  hotBadge: {
    backgroundColor: 'rgba(255,87,34,0.2)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.secondary,
  },
  hotBadgeText: { color: COLORS.secondary, fontSize: 9, fontWeight: 'bold' },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 3,
  },
  rankIcon: { fontSize: 12 },
  rank: { fontSize: 12, fontWeight: '600' },
  separator: { color: COLORS.textMuted, fontSize: 12 },
  points: { color: COLORS.textSecondary, fontSize: 12 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statusDot: { fontSize: 8 },
  statusLabel: { fontSize: 11 },
  gems: { color: COLORS.textMuted, fontSize: 11 },
  challengeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    gap: 2,
    minWidth: 64,
  },
  challengeBtnActive: {
    backgroundColor: COLORS.primary,
  },
  challengeBtnDisabled: {
    backgroundColor: COLORS.border,
  },
  challengeIcon: { fontSize: 16 },
  challengeIconDisabled: { opacity: 0.4 },
  challengeBtnText: {
    color: COLORS.background,
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
  },
  challengeBtnTextDisabled: {
    color: COLORS.textMuted,
  },
  // Compact
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
  compactInfo: { flex: 1 },
});

export default PlayerCard;
