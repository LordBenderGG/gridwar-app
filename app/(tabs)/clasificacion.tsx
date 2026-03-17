import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, Image, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import { useTranslation } from 'react-i18next';
import {
  subscribeToTopPlayers, getWinnerTitle, getRankInfo, getTranslatedRankName,
  subscribeToBottomPlayers, getLoserTitle,
} from '../../services/ranking';
import { UserProfile } from '../../services/auth';
import { AVATARS } from '../../components/AvatarPicker';
import { resolveFrameColor, resolveNameColor } from '../../components/PlayerCard';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import { getPreviousSeason, SeasonLeaderboardEntry } from '../../services/seasons';
import '../../i18n';

const PODIUM_COLORS = ['#FFD600', '#B0BEC5', '#FF6D00'];
const SHAME_EMOJIS = ['💀', '🤡', '😭', '🗑️', '👎', '☠️'];

// ─── RankRow (campeones) ──────────────────────────────────────────────────────

const RankRow: React.FC<{ player: UserProfile; position: number }> = ({ player, position }) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const winRate = player.gamesPlayed > 0 ? Math.round((player.wins / player.gamesPlayed) * 100) : 0;
  const isTop3 = position <= 3;
  const accentColor = isTop3 ? PODIUM_COLORS[position - 1] : undefined;
  const title = isTop3 ? getWinnerTitle(position) : undefined;
  const inv = (player as any).inventory || {};
  const frameColor = resolveFrameColor(inv.active_frame, accentColor ?? rankInfo.color);
  const nameColor = resolveNameColor(inv.active_name_color) !== COLORS.text
    ? resolveNameColor(inv.active_name_color)
    : accentColor ?? COLORS.text;
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={[styles.row, isTop3 && { borderColor: accentColor, borderWidth: 2 }]}>
      <View style={styles.positionBadge}>
        {isTop3 && <Text style={styles.positionEmoji}>{['🥇','🥈','🥉'][position-1]}</Text>}
        <Text style={[styles.rowPosition, isTop3 && { color: accentColor }]}>#{position}</Text>
      </View>
      <View style={[styles.rowAvatarRing, { borderColor: frameColor }]}>
        <Image source={avatarSource} style={styles.rowAvatar} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowUsername, { color: nameColor }]}>{player.username}</Text>
        {title && <Text style={[styles.rowTitle, { color: accentColor }]} numberOfLines={1}>{title}</Text>}
        <Text style={[styles.rowRank, { color: rankInfo.color }]}>{rankInfo.icon} {getTranslatedRankName(player.rank)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowPoints, isTop3 && { color: accentColor }]}>{t('ranking.points', { points: player.points })}</Text>
        <Text style={styles.rowStats}>{player.wins}{t('ranking.wins').charAt(0)} · {winRate}%</Text>
      </View>
    </View>
  );
};

// ─── PrevSeasonRow ────────────────────────────────────────────────────────────

const PrevSeasonRow: React.FC<{ entry: SeasonLeaderboardEntry }> = ({ entry }) => {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isTop3 = entry.position <= 3;
  const accentColor = isTop3 ? PODIUM_COLORS[entry.position - 1] : undefined;
  const rankInfo = getRankInfo(entry.rank);
  const SEASON_REWARDS: Record<number, number> = { 1: 500, 2: 300, 3: 150 };
  const reward = SEASON_REWARDS[entry.position];

  return (
    <View style={[styles.row, isTop3 && { borderColor: accentColor, borderWidth: 2 }]}>
      <View style={styles.positionBadge}>
        {isTop3 && <Text style={styles.positionEmoji}>{['🥇','🥈','🥉'][entry.position-1]}</Text>}
        <Text style={[styles.rowPosition, isTop3 && { color: accentColor }]}>#{entry.position}</Text>
      </View>
      <View style={[styles.rowAvatarRing, { borderColor: accentColor ?? rankInfo.color }]}>
        <View style={styles.rowAvatarPlaceholder}>
          <Text style={{ color: COLORS.textSecondary, fontSize: 18 }}>👤</Text>
        </View>
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowUsername, isTop3 && { color: accentColor }]}>{entry.username}</Text>
        <Text style={[styles.rowRank, { color: rankInfo.color }]}>{rankInfo.icon} {getTranslatedRankName(entry.rank)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowPoints, isTop3 && { color: accentColor }]}>{entry.points} pts</Text>
        {reward && <Text style={styles.rewardBadge}>+{reward}💎</Text>}
      </View>
    </View>
  );
};

// ─── LoserRow (vergüenza) ─────────────────────────────────────────────────────

const LoserRow: React.FC<{ player: UserProfile; position: number }> = ({ player, position }) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const rankInfo = getRankInfo(player.rank);
  const avatarSource = player.photoURL ? { uri: player.photoURL } : AVATARS[player.avatar] || AVATARS['avatar_1'];
  const title = getLoserTitle(position);
  const lossRate = player.gamesPlayed > 0 ? Math.round((player.losses / player.gamesPlayed) * 100) : 0;
  const isWorst = position === 1;
  const inv = (player as any).inventory || {};
  const frameColor = resolveFrameColor(inv.active_frame, isWorst ? COLORS.danger : 'rgba(255,23,68,0.3)');
  const nameColor = resolveNameColor(inv.active_name_color) !== COLORS.text
    ? resolveNameColor(inv.active_name_color)
    : isWorst ? COLORS.danger : COLORS.text;

  return (
    <View style={[styles.shameRow, isWorst && styles.shameRowWorst]}>
      <View style={[styles.positionBadge, { width: 36, marginRight: 6 }]}>
        <Text style={{ fontSize: 16 }}>{SHAME_EMOJIS[Math.min(position - 1, SHAME_EMOJIS.length - 1)]}</Text>
        <Text style={[styles.rowPosition, isWorst && { color: COLORS.danger }]}>#{position}</Text>
      </View>
      <View style={{ position: 'relative', marginRight: 10 }}>
        <View style={[styles.rowAvatarRing, { borderColor: frameColor, opacity: isWorst ? 1 : 0.85 }]}>
          <Image source={avatarSource} style={styles.rowAvatar} />
        </View>
        {isWorst && (
          <View style={styles.shameOverlay}>
            <Text style={{ fontSize: 12 }}>💀</Text>
          </View>
        )}
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowUsername, { color: nameColor }]}>{player.username}</Text>
        <Text style={[styles.rowTitle, { color: COLORS.danger }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.rowRank, { color: rankInfo.color }]}>{rankInfo.icon} {getTranslatedRankName(player.rank)}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowPoints, isWorst && { color: COLORS.danger }]}>{t('ranking.points', { points: player.points })}</Text>
        <Text style={styles.rowStats}>{player.losses}D · {player.wins}V</Text>
        <Text style={[styles.rowStats, isWorst && { color: COLORS.danger, fontWeight: 'bold' }]}>{lossRate}% {t('shame.losses')}</Text>
      </View>
    </View>
  );
};

// ─── Pantalla principal ────────────────────────────────────────────────────────

type TopTab = 'champions' | 'shame';
type SeasonTab = 'current' | 'previous';

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Pestañas superiores Campeones / Vergüenza
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  topTabBtn: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  topTabBtnActiveGold: { backgroundColor: 'rgba(255,214,0,0.1)' },
  topTabBtnActiveDanger: { backgroundColor: 'rgba(255,23,68,0.1)' },
  topTabText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '700' },

  // Header campeones
  champsHeader: { alignItems: 'center', marginBottom: 16 },
  headerEmoji: { fontSize: 48, marginBottom: 6 },
  headerTitle: {
    fontSize: 28, fontWeight: '900', color: COLORS.accent,
    letterSpacing: 4, textShadowColor: COLORS.accent,
    textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10, marginBottom: 4,
  },
  headerSub: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 1 },

  // Pestañas temporada
  tabBar: {
    flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 10,
    borderWidth: 1, borderColor: COLORS.border, marginBottom: 12, overflow: 'hidden',
  },
  tabBtn: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: COLORS.primary },
  tabBtnText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600' },
  tabBtnTextActive: { color: '#fff' },
  prevSeasonLabel: {
    color: COLORS.textMuted, fontSize: 10, textAlign: 'center', marginBottom: 8, fontStyle: 'italic',
  },

  // Filas campeones
  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 10, marginBottom: 6, borderWidth: 1, borderColor: COLORS.border,
  },
  positionBadge: { alignItems: 'center', width: 36, marginRight: 6 },
  positionEmoji: { fontSize: 14 },
  rowPosition: { color: COLORS.textMuted, fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  rowAvatarRing: {
    width: 48, height: 48, borderRadius: 24, borderWidth: 2,
    padding: 2, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  rowAvatar: { width: 40, height: 40, borderRadius: 20 },
  rowAvatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  rowInfo: { flex: 1 },
  rowUsername: { fontWeight: '700', fontSize: 13, color: COLORS.text },
  rowTitle: { fontSize: 9, fontStyle: 'italic', marginTop: 1, opacity: 0.9 },
  rowRank: { fontSize: 10, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowPoints: { color: COLORS.success, fontWeight: 'bold', fontSize: 13 },
  rowStats: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  rewardBadge: { color: '#FFD600', fontSize: 11, fontWeight: 'bold', marginTop: 2 },

  // Header vergüenza
  shameHeader: { alignItems: 'center', marginBottom: 24 },
  shameSkull: { fontSize: 60, marginBottom: 8 },
  shameTitle1: {
    fontSize: 20, fontWeight: '900', color: COLORS.danger, letterSpacing: 4,
    textShadowColor: COLORS.danger, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 8,
  },
  shameTitle2: {
    fontSize: 34, fontWeight: '900', color: COLORS.danger, letterSpacing: 6,
    textShadowColor: COLORS.danger, textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16, marginBottom: 6,
  },
  shameDivider: { width: 120, height: 3, backgroundColor: COLORS.danger, borderRadius: 2, marginBottom: 10, opacity: 0.7 },
  shamePhrase: {
    color: COLORS.textSecondary, fontSize: 10, fontStyle: 'italic',
    letterSpacing: 1.5, marginBottom: 16, textAlign: 'center',
  },
  warningBox: {
    backgroundColor: 'rgba(255,23,68,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,23,68,0.25)', padding: 12, width: '100%',
  },
  warningText: { color: COLORS.textSecondary, fontSize: 12, textAlign: 'center', lineHeight: 18 },

  // Filas vergüenza
  shameRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,23,68,0.04)', borderRadius: 14, padding: 10,
    marginBottom: 6, borderWidth: 1, borderColor: 'rgba(255,23,68,0.15)',
  },
  shameRowWorst: { borderColor: COLORS.danger, borderWidth: 2, backgroundColor: 'rgba(255,23,68,0.1)' },
  shameOverlay: {
    position: 'absolute', top: -4, right: -4, backgroundColor: COLORS.background,
    borderRadius: 10, width: 20, height: 20, alignItems: 'center', justifyContent: 'center',
  },

  empty: { color: COLORS.textSecondary, textAlign: 'center', marginTop: 60, fontSize: 14 },
  emptyContainer: { alignItems: 'center', paddingTop: 80 },
});

export default function ClasificacionScreen() {
  const [topTab, setTopTab] = useState<TopTab>('champions');
  const [seasonTab, setSeasonTab] = useState<SeasonTab>('current');

  // Campeones
  const [topPlayers, setTopPlayers] = useState<UserProfile[]>([]);
  const [loadingChamps, setLoadingChamps] = useState(true);
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const mode = (user?.mode as 'global' | 'local') || 'global';

  // Temporada anterior
  const [prevSeasonId, setPrevSeasonId] = useState<string | null>(null);
  const [prevLeaderboard, setPrevLeaderboard] = useState<SeasonLeaderboardEntry[]>([]);
  const [loadingPrev, setLoadingPrev] = useState(false);
  const [prevLoaded, setPrevLoaded] = useState(false);

  // Vergüenza
  const [bottomPlayers, setBottomPlayers] = useState<UserProfile[]>([]);
  const [loadingShame, setLoadingShame] = useState(true);
  const shamePhrases: string[] = t('shame.phrases', { returnObjects: true }) as string[];
  const [phraseIndex] = useState(() => Math.floor(Math.random() * shamePhrases.length));

  useEffect(() => {
    const unsub = subscribeToTopPlayers((players) => {
      setTopPlayers(players);
      setLoadingChamps(false);
    }, 20, mode);
    return () => unsub();
  }, [mode]);

  useEffect(() => {
    const unsub = subscribeToBottomPlayers((players) => {
      setBottomPlayers(players.filter((p) => p.gamesPlayed > 0));
      setLoadingShame(false);
    }, 20, mode);
    return () => unsub();
  }, [mode]);

  useEffect(() => {
    if (seasonTab !== 'previous' || prevLoaded) return;
    setLoadingPrev(true);
    getPreviousSeason()
      .then((data) => {
        if (data) { setPrevSeasonId(data.seasonId); setPrevLeaderboard(data.leaderboard); }
        setPrevLoaded(true);
      })
      .catch(() => setPrevLoaded(true))
      .finally(() => setLoadingPrev(false));
  }, [seasonTab, prevLoaded]);

  // ── Header con pestañas superiores ────────────────────────────────────────

  const TopTabBar = () => (
    <View style={styles.topTabBar}>
      <TouchableOpacity
        style={[styles.topTabBtn, topTab === 'champions' && styles.topTabBtnActiveGold]}
        onPress={() => setTopTab('champions')}
      >
        <Text style={[styles.topTabText, topTab === 'champions' && { color: COLORS.accent }]}>
          🏆 {t('nav.champions')}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.topTabBtn, topTab === 'shame' && styles.topTabBtnActiveDanger]}
        onPress={() => setTopTab('shame')}
      >
        <Text style={[styles.topTabText, topTab === 'shame' && { color: COLORS.danger }]}>
          💀 {t('nav.shame')}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Pestaña Vergüenza ─────────────────────────────────────────────────────

  if (topTab === 'shame') {
    if (loadingShame) {
      return (
        <View style={styles.container}>
          <TopTabBar />
          <View style={styles.center}>
            <ActivityIndicator color={COLORS.danger} size="large" />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.container}>
        <FlatList
          data={bottomPlayers}
          keyExtractor={(item) => item.uid}
          renderItem={({ item, index }) => <LoserRow player={item} position={index + 1} />}
          ListHeaderComponent={() => (
            <View>
              <TopTabBar />
              <View style={styles.shameHeader}>
                <Text style={styles.shameSkull}>💀</Text>
                <Text style={styles.shameTitle1}>{t('shame.title1')}</Text>
                <Text style={styles.shameTitle2}>{t('shame.title2')}</Text>
                <View style={styles.shameDivider} />
                <Text style={styles.shamePhrase}>{shamePhrases[phraseIndex]}</Text>
                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>{t('shame.warning')}</Text>
                </View>
                <AdBanner style={{ marginTop: 10 }} />
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ fontSize: 56, marginBottom: 16 }}>🎉</Text>
              <Text style={styles.empty}>{t('shame.empty')}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  // ── Pestaña Campeones ─────────────────────────────────────────────────────

  const ChampionsHeader = () => (
    <View>
      <TopTabBar />
      <View style={styles.champsHeader}>
        <Text style={styles.headerEmoji}>🏆</Text>
        <Text style={styles.headerTitle}>{t('ranking.headerTitle')}</Text>
        <Text style={styles.headerSub}>{t('ranking.headerSub')}</Text>
      </View>
      <AdBanner style={{ marginBottom: 8 }} />
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, seasonTab === 'current' && styles.tabBtnActive]}
          onPress={() => setSeasonTab('current')}
        >
          <Text style={[styles.tabBtnText, seasonTab === 'current' && styles.tabBtnTextActive]}>
            {t('ranking.currentSeason')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, seasonTab === 'previous' && styles.tabBtnActive]}
          onPress={() => setSeasonTab('previous')}
        >
          <Text style={[styles.tabBtnText, seasonTab === 'previous' && styles.tabBtnTextActive]}>
            {t('ranking.previousSeason')}
          </Text>
        </TouchableOpacity>
      </View>
      {seasonTab === 'previous' && prevSeasonId && (
        <Text style={styles.prevSeasonLabel}>{t('ranking.seasonLabel', { id: prevSeasonId })}</Text>
      )}
    </View>
  );

  if (seasonTab === 'previous') {
    return (
      <View style={styles.container}>
        <FlatList
          data={prevLeaderboard}
          keyExtractor={(item) => String(item.position)}
          renderItem={({ item }) => <PrevSeasonRow entry={item} />}
          ListHeaderComponent={ChampionsHeader}
          ListEmptyComponent={
            loadingPrev ? (
              <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
            ) : prevLoaded ? (
              <Text style={styles.empty}>{t('ranking.noPreviousData')}</Text>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      </View>
    );
  }

  if (loadingChamps) {
    return (
      <View style={styles.container}>
        <TopTabBar />
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={topPlayers}
        keyExtractor={(item) => item.uid}
        renderItem={({ item, index }) => <RankRow player={item} position={index + 1} />}
        ListHeaderComponent={ChampionsHeader}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('ranking.empty')}</Text>
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
