import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getActiveTournaments,
  getActiveGlobalTournamentId,
  subscribeToActiveTournaments,
  subscribeToActiveGlobalTournamentId,
  Tournament,
} from '../../services/tournament';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import AdBanner from '../../components/AdBanner';
import { useTranslation } from 'react-i18next';
import '../../i18n';

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { color: COLORS.success, fontSize: 22, fontWeight: '900', letterSpacing: 3 },
  createRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  createTypeBtn: {
    flex: 1, backgroundColor: COLORS.success + '12', borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.success, paddingVertical: 12, alignItems: 'center',
  },
  createTypeBtnDisabled: { borderColor: COLORS.border, backgroundColor: COLORS.surface, opacity: 0.5 },
  createTypeBtnEmoji: { fontSize: 22, marginBottom: 4 },
  createTypeBtnText: { color: COLORS.success, fontWeight: 'bold', fontSize: 13 },
  needPass: { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
  globalBanner: {
    backgroundColor: COLORS.success + '14', borderRadius: 10, padding: 10, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.success, alignItems: 'center',
  },
  globalBannerText: { color: COLORS.success, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 },
  noGlobalBanner: {
    backgroundColor: COLORS.surface, borderRadius: 10, padding: 8, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
  },
  noGlobalText: { color: COLORS.textSecondary, fontSize: 11 },
  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 14,
    marginBottom: 10, borderWidth: 1, borderColor: COLORS.border,
  },
  cardGlobal: { borderColor: COLORS.success, backgroundColor: COLORS.success + '0A' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitleRow: { flex: 1, marginRight: 8 },
  globalBadge: { color: COLORS.success, fontSize: 10, fontWeight: 'bold', marginBottom: 2 },
  tournamentName: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  statusBadge: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  cardInfo: { flexDirection: 'row', gap: 12, marginBottom: 6 },
  info: { color: COLORS.textSecondary, fontSize: 12 },
  entryFee: { color: COLORS.warning, fontSize: 12, fontWeight: 'bold' },
  freeLabel: { color: COLORS.success, fontSize: 12, fontWeight: 'bold' },
  prizesRow: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  prizeText: { color: COLORS.warning, fontSize: 11 },
  joined: { color: COLORS.success, fontSize: 11 },
  joinHint: { color: '#00C896', fontSize: 11 },
  fullLabel: { color: COLORS.danger, fontSize: 11 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  emptySubtext: { color: COLORS.textSecondary, fontSize: 13, marginTop: 8 },
});

export default function TorneosScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeGlobalId, setActiveGlobalId] = useState<string | null>(null);

  useEffect(() => {
    let gotTs = false;
    let gotGlobal = false;

    const maybeStopLoading = () => {
      if (gotTs && gotGlobal) setLoading(false);
    };

    const unsubTs = subscribeToActiveTournaments((ts) => {
      setTournaments(ts);
      gotTs = true;
      maybeStopLoading();
    });

    const unsubGlobal = subscribeToActiveGlobalTournamentId((globalId) => {
      setActiveGlobalId(globalId);
      gotGlobal = true;
      maybeStopLoading();
    });

    return () => {
      unsubTs();
      unsubGlobal();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    const [ts, globalId] = await Promise.all([
      getActiveTournaments(),
      getActiveGlobalTournamentId(),
    ]);
    setTournaments(ts);
    setActiveGlobalId(globalId);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Tournament }) => {
    const isFull = item.players.length >= item.maxPlayers;
    const isJoined = item.players.includes(user?.uid || '');
    const isGlobal = item.type === 'global';
    const statusColor =
      item.status === 'active' ? COLORS.success :
      item.status === 'finished' ? COLORS.textSecondary :
      COLORS.warning;
    const statusLabel =
      item.status === 'waiting' ? t('tournament.statusWaitingShort') :
      item.status === 'active' ? t('tournament.statusActiveShort') :
      t('tournament.statusFinishedShort');

    return (
      <TouchableOpacity
        style={[styles.card, isGlobal && styles.cardGlobal]}
        onPress={() => router.push(`/tournament/${item.tournamentId}`)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleRow}>
            {isGlobal && <Text style={styles.globalBadge}>🌍 GLOBAL</Text>}
            <Text style={styles.tournamentName} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={[styles.statusBadge, { borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.info}>👥 {item.players.length}/{item.maxPlayers}</Text>
          {item.entryFee > 0
            ? <Text style={styles.entryFee}>{t('tournament.entryFee', { fee: item.entryFee })}</Text>
            : <Text style={styles.freeLabel}>{t('tournament.free')}</Text>
          }
        </View>
        <View style={styles.prizesRow}>
          <Text style={styles.prizeText}>🥇 {item.prizes.first}💎</Text>
          <Text style={styles.prizeText}>🥈 {item.prizes.second}💎</Text>
          <Text style={styles.prizeText}>🥉 {item.prizes.third}💎</Text>
        </View>
        {isJoined && <Text style={styles.joined}>{t('tournament.enrolled')}</Text>}
        {!isJoined && !isFull && item.status === 'waiting' && (
          <Text style={styles.joinHint}>{t('tournament.tapToJoin')}</Text>
        )}
        {isFull && !isJoined && item.status === 'waiting' && (
          <Text style={styles.fullLabel}>{t('tournament.fullShort')}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('tournament.tournamentsTitle')}</Text>
      </View>

      {/* Botones crear */}
      <View style={styles.createRow}>
        <TouchableOpacity
          style={[
            styles.createTypeBtn,
            !((user?.inventory as any)?.tournament_pass > 0) && styles.createTypeBtnDisabled,
          ]}
          onPress={() => {
            if ((user?.inventory as any)?.tournament_pass > 0) {
              router.push('/tournament/crear?type=global');
            } else {
              router.push('/(tabs)/tienda');
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.createTypeBtnEmoji}>🌍</Text>
          <Text style={[
            styles.createTypeBtnText,
            !((user?.inventory as any)?.tournament_pass > 0) && { color: COLORS.textMuted },
          ]}>
            {t('tournament.typeGlobal')}
          </Text>
          {!((user?.inventory as any)?.tournament_pass > 0) && (
            <Text style={styles.needPass}>{t('home.needPassShort')}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.createTypeBtn}
          onPress={() => router.push('/tournament/crear?type=local')}
          activeOpacity={0.7}
        >
          <Text style={styles.createTypeBtnEmoji}>📍</Text>
          <Text style={styles.createTypeBtnText}>{t('tournament.typeLocal')}</Text>
        </TouchableOpacity>
      </View>

      {/* Banner AdMob */}
      <AdBanner style={{ marginBottom: 8 }} />

      {/* Banner global activo */}
      {activeGlobalId ? (
        <TouchableOpacity
          style={styles.globalBanner}
          onPress={() => router.push(`/tournament/${activeGlobalId}`)}
        >
          <Text style={styles.globalBannerText}>{t('tournament.globalActiveBanner')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.noGlobalBanner}>
          <Text style={styles.noGlobalText}>{t('tournament.noGlobalActive')}</Text>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={(item) => item.tournamentId}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('tournament.emptyTournaments')}</Text>
              <Text style={styles.emptySubtext}>{t('tournament.emptyTournamentsMsg')}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
