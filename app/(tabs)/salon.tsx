import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { subscribeToBottomPlayers, getLoserTitle, getRankInfo, getTranslatedRankName } from '../../services/ranking';
import { UserProfile } from '../../services/auth';
import { AVATARS } from '../../components/AvatarPicker';
import { resolveFrameColor, resolveNameColor } from '../../components/PlayerCard';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import '../../i18n';

const SHAME_EMOJIS = ['💀', '🤡', '😭', '🗑️', '👎', '☠️'];

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { alignItems: 'center', marginBottom: 24 },
  skull: { fontSize: 60, marginBottom: 8 },
  title1: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.danger,
    letterSpacing: 4,
    textShadowColor: COLORS.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  title2: {
    fontSize: 34,
    fontWeight: '900',
    color: COLORS.danger,
    letterSpacing: 6,
    textShadowColor: COLORS.danger,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
    marginBottom: 6,
  },
  titleUnderline: {
    width: 120,
    height: 3,
    backgroundColor: COLORS.danger,
    borderRadius: 2,
    marginBottom: 10,
    opacity: 0.7,
  },
  phrase: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontStyle: 'italic',
    letterSpacing: 1.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  warningBox: {
    backgroundColor: 'rgba(255,23,68,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,23,68,0.25)',
    padding: 12,
    width: '100%',
  },
  warningText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Rows — mismas proporciones que clasificacion.tsx
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,23,68,0.04)',
    borderRadius: 14,
    padding: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,23,68,0.15)',
  },
  worstRow: {
    borderColor: COLORS.danger,
    borderWidth: 2,
    backgroundColor: 'rgba(255,23,68,0.1)',
  },
  positionBadge: { alignItems: 'center', width: 36, marginRight: 6 },
  positionBadgeWorst: {},
  positionEmoji: { fontSize: 16 },
  positionNum: { color: COLORS.textMuted, fontSize: 10, fontWeight: 'bold' },
  avatarWrapper: { position: 'relative', marginRight: 10 },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.85,
  },
  avatarRingWorst: { opacity: 1 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarWorst: {},
  shameOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.background,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shameOverlayText: { fontSize: 12 },
  info: { flex: 1 },
  username: { fontWeight: '700', fontSize: 13 },
  titleText: { color: COLORS.danger, fontSize: 9, fontStyle: 'italic', marginTop: 1, opacity: 0.8 },
  rank: { fontSize: 10, marginTop: 2 },
  stats: { alignItems: 'flex-end' },
  points: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 13 },
  record: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  lossRate: { color: COLORS.danger, fontSize: 10, marginTop: 1, opacity: 0.7 },
  lossRateWorst: { opacity: 1, fontWeight: 'bold' },
  emptyContainer: { flex: 1, alignItems: 'center', paddingTop: 80, paddingHorizontal: 32 },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold', marginBottom: 8 },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});

const LoserRow: React.FC<{ player: UserProfile; position: number }> = ({ player, position }) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const title = getLoserTitle(position);
  const lossRate = player.gamesPlayed > 0
    ? Math.round((player.losses / player.gamesPlayed) * 100)
    : 0;
  const isWorst = position === 1;

  const inv = (player as any).inventory || {};
  const frameColor = resolveFrameColor(inv.active_frame, isWorst ? COLORS.danger : 'rgba(255,23,68,0.3)');
  const nameColor = resolveNameColor(inv.active_name_color) !== COLORS.text
    ? resolveNameColor(inv.active_name_color)
    : isWorst ? COLORS.danger : COLORS.text;

  return (
    <View style={[styles.row, isWorst && styles.worstRow]}>
      {/* Posición */}
      <View style={[styles.positionBadge, isWorst && styles.positionBadgeWorst]}>
        <Text style={[styles.positionEmoji]}>
          {SHAME_EMOJIS[Math.min(position - 1, SHAME_EMOJIS.length - 1)]}
        </Text>
        <Text style={[styles.positionNum, isWorst && { color: COLORS.danger }]}>#{position}</Text>
      </View>

      {/* Avatar con marco */}
      <View style={styles.avatarWrapper}>
        <View style={[styles.avatarRing, { borderColor: frameColor }, isWorst && styles.avatarRingWorst]}>
          <Image source={avatarSource} style={[styles.avatar, isWorst && styles.avatarWorst]} />
        </View>
        {isWorst && (
          <View style={styles.shameOverlay}>
            <Text style={styles.shameOverlayText}>💀</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.username, { color: nameColor }]}>
          {player.username}
        </Text>
        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rank, { color: rankInfo.color }]}>{rankInfo.icon} {getTranslatedRankName(player.rank)}</Text>
      </View>

      {/* Stats */}
      <View style={styles.stats}>
        <Text style={[styles.points, isWorst && { color: COLORS.danger }]}>{t('ranking.points', { points: player.points })}</Text>
        <Text style={styles.record}>{player.losses}{t('shame.losses').charAt(0).toUpperCase()} · {player.wins}{t('ranking.wins').charAt(0)}</Text>
        <Text style={[styles.lossRate, isWorst && styles.lossRateWorst]}>{lossRate}% {t('shame.losses')}</Text>
      </View>
    </View>
  );
};

export default function SalonScreen() {
  const [bottomPlayers, setBottomPlayers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const mode = (user?.mode as 'global' | 'local') || 'global';
  const shamePhrases: string[] = t('shame.phrases', { returnObjects: true }) as string[];
  const [phraseIndex] = useState(() => Math.floor(Math.random() * shamePhrases.length));

  useEffect(() => {
    const unsub = subscribeToBottomPlayers((players) => {
      const withGames = players.filter((p) => p.gamesPlayed > 0);
      setBottomPlayers(withGames);
      setLoading(false);
    }, 20, mode);
    return () => unsub();
  }, [mode]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.danger} size="large" />
      </View>
    );
  }

  const ListHeader = () => (
    <View style={styles.header}>
      {/* Título dramático */}
      <Text style={styles.skull}>💀</Text>
      <Text style={styles.title1}>{t('shame.title1')}</Text>
      <Text style={styles.title2}>{t('shame.title2')}</Text>
      <View style={styles.titleUnderline} />
      <Text style={styles.phrase}>{shamePhrases[phraseIndex]}</Text>

      {/* Advertencia */}
      <View style={styles.warningBox}>
        <Text style={styles.warningText}>{t('shame.warning')}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={bottomPlayers}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => <LoserRow player={item} position={index + 1} />}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={styles.emptyTitle}>{t('shame.empty')}</Text>
            <Text style={styles.emptyText}>{t('shame.emptyMsg')}</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
