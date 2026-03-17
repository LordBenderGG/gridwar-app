import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Animated as RNAnimated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../services/auth';
import { getRankInfo, getTranslatedRankName } from '../services/ranking';
import { useColors } from '../hooks/useColors';
import { AVATARS } from './AvatarPicker';
import '../i18n';

// ─── Helpers de personalización ───────────────────────────────────────────────
const FRAME_COLORS: Record<string, string> = {
  frame_gold: '#FFD700',
  frame_neon:  '#00F5FF',
  frame_fire:  '#FF6B35',
};

const NAME_COLORS: Record<string, string> = {
  color_gold:   '#FFD700',
  color_cyan:   '#00F5FF',
  color_pink:   '#FF69B4',
  color_red:    '#FF1744',
  color_purple: '#9B59B6',
};

export const resolveFrameColor = (frameId?: string | null, fallback?: string): string => {
  if (frameId && FRAME_COLORS[frameId]) return FRAME_COLORS[frameId];
  // fallback will use COLORS.border from the caller if not provided
  return fallback || '#333';
};

export const resolveNameColor = (colorId?: string | null): string => {
  if (colorId && NAME_COLORS[colorId]) return NAME_COLORS[colorId];
  return '#FFFFFF'; // default text color fallback
};

interface PlayerCardProps {
  player: UserProfile;
  onChallenge?: () => void;
  challengeDisabled?: boolean;
  compact?: boolean;
  isOnline?: boolean;
  // Override de personalización (para mostrar stats de otro jugador)
  frameId?: string | null;
  nameColorId?: string | null;
}

const createStyles = (COLORS: any) => StyleSheet.create({
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
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
  tournamentBadge: {
    backgroundColor: 'rgba(255,214,0,0.15)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  tournamentBadgeText: { color: '#FFD700', fontSize: 9, fontWeight: 'bold' },
  levelBadge: {
    backgroundColor: 'rgba(170,0,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.purple,
  },
  levelBadgeText: { color: COLORS.purpleLight, fontSize: 9, fontWeight: 'bold' },
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
  compactAvatarRing: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  compactInfo: { flex: 1 },
});

const PlayerCard: React.FC<PlayerCardProps> = ({
  player,
  onChallenge,
  challengeDisabled,
  compact = false,
  isOnline = true,
  frameId,
  nameColorId,
}) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL
    ? { uri: player.photoURL }
    : AVATARS[player.avatar] || AVATARS['avatar_1'];

  // Personalización — si no se pasa explícitamente, leer del inventario del jugador
  const inv = (player as any).inventory || {};
  const effectiveFrameId = frameId !== undefined ? frameId : (inv.active_frame ?? null);
  const effectiveNameColorId = nameColorId !== undefined ? nameColorId : (inv.active_name_color ?? null);

  const frameColor = resolveFrameColor(effectiveFrameId, rankInfo.color);
  const nameColor = resolveNameColor(effectiveNameColorId) !== '#FFFFFF'
    ? resolveNameColor(effectiveNameColorId)
    : COLORS.text;

  const statusConfig = {
    available:  { color: COLORS.success,  label: t('home.online'),     dot: '●' },
    in_game:    { color: COLORS.warning,  label: t('home.inGame'),     dot: '●' },
    challenged: { color: COLORS.secondary, label: t('home.challenged'), dot: '●' },
    blocked:    { color: COLORS.danger,   label: t('home.blocked'),    dot: '●' },
  }[player.status] || { color: COLORS.textMuted, label: 'Offline', dot: '●' };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View style={[styles.compactAvatarRing, { borderColor: frameColor }]}>
          <Image source={avatarSource} style={styles.compactAvatar} />
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.username, { color: nameColor }]}>{player.username}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>
            {rankInfo.icon} {getTranslatedRankName(player.rank)}
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
      {/* Left: Avatar + frame + online dot */}
      <View style={styles.avatarWrapper}>
        <View style={[styles.avatarRing, { borderColor: frameColor }]}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>
        <View style={[styles.onlineDot, { backgroundColor: statusConfig.color }]} />
      </View>

      {/* Middle: Info */}
      <View style={styles.info}>
        <View style={styles.usernameRow}>
          <Text style={[styles.username, { color: nameColor }]}>{player.username}</Text>
          {(player as any).tournamentsWon > 0 && (
            <View style={styles.tournamentBadge}>
              <Text style={styles.tournamentBadgeText}>🏆×{(player as any).tournamentsWon}</Text>
            </View>
          )}
          {(player as any).level > 1 && (
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>Nv.{(player as any).level}</Text>
            </View>
          )}
          {player.wins >= 10 && (
            <View style={styles.hotBadge}>
              <Text style={styles.hotBadgeText}>🔥 HOT</Text>
            </View>
          )}
        </View>
        <View style={styles.rankRow}>
          <Text style={styles.rankIcon}>{rankInfo.icon}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>{getTranslatedRankName(player.rank)}</Text>
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
            {t('home.challenge')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default PlayerCard;
