import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Share,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  subscribeToTournament, joinTournament, startTournament,
  Tournament, TournamentMatch,
  deleteLocalTournament, syncTournamentProgress, claimTournamentMatchStart,
} from '../../services/tournament';
import AdBanner from '../../components/AdBanner';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../services/firebase';
import { useColors } from '../../hooks/useColors';
import { useTranslation } from 'react-i18next';
import '../../i18n';

// ─── BracketMatch ─────────────────────────────────────────────────────────────

interface BracketMatchProps {
  match: TournamentMatch;
  currentUserId?: string;
  onPress?: () => void;
  label?: string;
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  backBtnBottom: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  backText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  badgesRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  typeBadge: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1 },
  typeBadgeGlobal: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,245,255,0.08)' },
  typeBadgeLocal: { borderColor: COLORS.border, backgroundColor: COLORS.surface },
  typeBadgeText: { fontSize: 11, fontWeight: 'bold', color: COLORS.text },
  title: { color: COLORS.text, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 10 },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  statusBadge: {
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12,
    paddingVertical: 4, fontSize: 12, fontWeight: 'bold',
  },
  shareBtn: { color: COLORS.primary, fontSize: 13 },
  statsRow: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  statItem: { alignItems: 'center' },
  statValue: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: COLORS.textSecondary, fontSize: 10, marginTop: 2 },
  podiumBanner: {
    backgroundColor: 'rgba(255,215,0,0.10)', borderRadius: 14,
    padding: 16, alignItems: 'center', marginBottom: 16,
    borderWidth: 2, borderColor: COLORS.warning,
  },
  podiumTitle: { color: COLORS.warning, fontSize: 13, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 },
  podiumEntry: { color: COLORS.text, fontSize: 15, fontWeight: 'bold', marginBottom: 4 },
  prizesBox: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    padding: 12, marginBottom: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
  prizesTitle: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 },
  prizesRow: { flexDirection: 'row', justifyContent: 'space-around' },
  prizeItem: { color: COLORS.warning, fontSize: 12, fontWeight: 'bold' },
  section: { marginBottom: 22 },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: 10,
    fontWeight: 'bold', letterSpacing: 1, marginBottom: 10,
  },
  playerRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 10,
    padding: 12, marginBottom: 5,
    borderWidth: 1, borderColor: COLORS.border,
  },
  playerRowEmpty: { opacity: 0.4 },
  playerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success, marginRight: 10 },
  creatorDot: { backgroundColor: COLORS.warning },
  playerDotEmpty: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border, marginRight: 10 },
  playerName: { color: COLORS.text, fontSize: 14 },
  playerNameEmpty: { color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' },
  actions: { gap: 10 },
  joinBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  joinBtnText: { color: COLORS.background, fontWeight: '900', fontSize: 14, letterSpacing: 1 },
  startBtn: { backgroundColor: COLORS.success, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  startBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  playMatchBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  playMatchBtnText: { color: COLORS.background, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  btnDisabled: { opacity: 0.5 },
  waitingMsg: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border,
  },
  waitingText: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center' },
  inlineErrorBox: {
    backgroundColor: 'rgba(255,59,48,0.10)',
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  inlineErrorText: { color: COLORS.danger, fontSize: 12, textAlign: 'center' },
  deleteBtn: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  deleteBtnText: { color: COLORS.danger, fontWeight: '900', fontSize: 13, letterSpacing: 1 },
  // ── BracketView styles ─────────────────────────────────────────────────────
  roundBlock: { marginBottom: 20 },
  roundLabel: {
    color: COLORS.primary, fontSize: 12, fontWeight: 'bold',
    letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase',
  },
  matchCard: {
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.border,
  },
  matchCardMine: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,245,255,0.05)' },
  matchCardDone: { opacity: 0.85 },
  matchLabel: { color: COLORS.textSecondary, fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginBottom: 6 },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchPlayer: { color: COLORS.text, fontSize: 14, flex: 1 },
  matchWinner: { color: COLORS.success, fontWeight: 'bold' },
  matchLoser: { color: COLORS.textSecondary, textDecorationLine: 'line-through' },
  matchWinIcon: { color: COLORS.success, fontSize: 14, marginLeft: 4 },
  matchDivider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  matchCTA: { color: COLORS.primary, fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginTop: 6 },
});

const BracketMatchCard: React.FC<BracketMatchProps> = ({ match, currentUserId, onPress, label }) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const isMyMatch = match.p1 === currentUserId || match.p2 === currentUserId;
  const isDone = !!match.winner;

  return (
    <TouchableOpacity
      style={[styles.matchCard, isMyMatch && styles.matchCardMine, isDone && styles.matchCardDone]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {label && <Text style={styles.matchLabel}>{label}</Text>}
      <View style={styles.matchRow}>
        <Text
          style={[
            styles.matchPlayer,
            match.winner === match.p1 ? styles.matchWinner : undefined,
            (!!match.winner && match.winner !== match.p1) ? styles.matchLoser : undefined,
          ]}
          numberOfLines={1}
        >
          {match.p1Username}
        </Text>
        {match.winner === match.p1 && <Text style={styles.matchWinIcon}>✓</Text>}
      </View>
      <View style={styles.matchDivider} />
      <View style={styles.matchRow}>
        <Text
          style={[
            styles.matchPlayer,
            match.winner === match.p2 ? styles.matchWinner : undefined,
            (!!match.winner && match.winner !== match.p2) ? styles.matchLoser : undefined,
          ]}
          numberOfLines={1}
        >
          {match.p2Username}
        </Text>
        {match.winner === match.p2 && <Text style={styles.matchWinIcon}>✓</Text>}
      </View>
      {!isDone && isMyMatch && <Text style={styles.matchCTA}>{t('tournament.goToMatch')}</Text>}
    </TouchableOpacity>
  );
};

// ─── BracketView ──────────────────────────────────────────────────────────────

interface BracketViewProps {
  bracket: Record<string, TournamentMatch[]>;
  thirdPlaceMatch: TournamentMatch | null;
  totalRounds: number;
  currentUserId?: string;
  onMatchPress: (match: TournamentMatch) => void;
}

const buildPreviewBracket = (tournament: Tournament): Record<string, TournamentMatch[]> => {
  // Si la llave ya fue sorteada (torneo lleno), mostrarla antes de iniciar.
  if (tournament.bracket?.round1?.length) {
    return { round1: tournament.bracket.round1 };
  }

  // Mientras no este lleno, mostrar placeholders.
  const slots = Array.from({ length: tournament.maxPlayers }).map((_, i) => ({
    uid: `slot_${i}`,
    username: 'Por definir',
  }));

  const round1: TournamentMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const a = slots[i];
    const b = slots[i + 1];
    round1.push({
      matchId: `preview_${i}`,
      p1: a.uid,
      p2: b.uid,
      p1Username: a.username,
      p2Username: b.username,
      winner: null,
      loser: null,
      gameId: null,
    });
  }

  return { round1 };
};

const BracketView: React.FC<BracketViewProps> = ({
  bracket, thirdPlaceMatch, totalRounds, currentUserId, onMatchPress,
}) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const roundLabels: Record<number, string> = {};
  if (totalRounds === 2) { roundLabels[1] = t('tournament.roundSemifinals'); roundLabels[2] = t('tournament.roundFinal'); }
  else if (totalRounds === 3) { roundLabels[1] = t('tournament.roundQuarters'); roundLabels[2] = t('tournament.roundSemifinals'); roundLabels[3] = t('tournament.roundFinal'); }
  else if (totalRounds === 4) { roundLabels[1] = t('tournament.roundOf16'); roundLabels[2] = t('tournament.roundQuarters'); roundLabels[3] = t('tournament.roundSemifinals'); roundLabels[4] = t('tournament.roundFinal'); }

  const rounds = Object.keys(bracket)
    .filter((k) => k.startsWith('round'))
    .sort((a, b) => {
      const na = parseInt(a.replace('round', ''));
      const nb = parseInt(b.replace('round', ''));
      return na - nb;
    });

  return (
    <View>
      {rounds.map((roundKey) => {
        const roundNum = parseInt(roundKey.replace('round', ''));
        const matches = bracket[roundKey];
        const isLastRound = roundNum === totalRounds;
        return (
          <View key={roundKey} style={styles.roundBlock}>
            <Text style={styles.roundLabel}>
              {roundLabels[roundNum] ?? t('tournament.roundN', { n: roundNum })}
              {isLastRound ? ' 🏆' : ''}
            </Text>
            {matches.map((match) => (
              <BracketMatchCard
                key={match.matchId}
                match={match}
                currentUserId={currentUserId}
                onPress={match.gameId && !match.winner ? () => onMatchPress(match) : undefined}
              />
            ))}
          </View>
        );
      })}
      {thirdPlaceMatch && (
        <View style={styles.roundBlock}>
          <Text style={styles.roundLabel}>{t('tournament.thirdPlace')}</Text>
          <BracketMatchCard
            match={thirdPlaceMatch}
            currentUserId={currentUserId}
            label={t('tournament.thirdPlaceLabel')}
            onPress={thirdPlaceMatch.gameId && !thirdPlaceMatch.winner ? () => onMatchPress(thirdPlaceMatch) : undefined}
          />
        </View>
      )}
    </View>
  );
};

// ─── Pantalla principal ───────────────────────────────────────────────────────

export default function TorneoScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { torneoId } = useLocalSearchParams<{ torneoId: string }>();
  const { user, updateUser } = useAuthStore();
  const actorUid = auth.currentUser?.uid || user?.uid || '';
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openingMatch, setOpeningMatch] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoOpenedGameRef = useRef<string | null>(null);

  const showInlineError = useCallback((message: string) => {
    setInlineError(message);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setInlineError(null), 3200);
  }, []);

  useEffect(() => {
    if (!torneoId) return;
    const unsub = subscribeToTournament(torneoId, (tournamentData) => {
      if (!tournamentData) {
        setTournament(null);
        setLoading(false);
        router.replace('/(tabs)/torneos');
        return;
      }
      setTournament(tournamentData);
      setLoading(false);
    });
    return () => unsub();
  }, [torneoId, router]);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!torneoId || !tournament || tournament.status !== 'active') return;
    syncTournamentProgress(torneoId).catch(() => {});
  }, [
    torneoId,
    tournament?.status,
    tournament?.currentRound,
    tournament?.bracket,
    tournament?.thirdPlaceMatch,
  ]);

  // Mientras el torneo este activo, sincronizar periodicamente resultados
  // de partidas para refrescar llaves aunque el doc del torneo no cambie.
  useEffect(() => {
    if (!torneoId || !tournament || tournament.status !== 'active') return;
    const interval = setInterval(() => {
      syncTournamentProgress(torneoId).catch(() => {});
    }, 2500);
    return () => clearInterval(interval);
  }, [torneoId, tournament?.status]);

  const isParticipant = tournament
    ? (tournament.players.includes(actorUid || '') )
    : false;

  const handleJoin = async () => {
    if (!tournament || !user || !actorUid) return;
    setInlineError(null);
    if (tournament.players.includes(actorUid)) {
      showInlineError(t('tournament.alreadyJoinedMsg'));
      return;
    }
    if (tournament.players.length >= tournament.maxPlayers) {
      showInlineError(t('tournament.tournamentFullMsg'));
      return;
    }
    if (tournament.type === 'global' && tournament.entryFee > 0 && (user.gems ?? 0) < tournament.entryFee) {
      showInlineError(t('tournament.notEnoughGemsMsg', { fee: tournament.entryFee }));
      return;
    }

    setJoining(true);
    try {
      await joinTournament(torneoId!, actorUid, user.username, user.avatar);
      if (tournament.type === 'global' && tournament.entryFee > 0) {
        updateUser({ gems: (user.gems ?? 0) - tournament.entryFee });
      }
    } catch (e: any) {
      if (e?.message === 'NOT_ENOUGH_GEMS') {
        showInlineError(t('tournament.notEnoughGemsMsg', { fee: tournament.entryFee }));
      } else {
        showInlineError(t('tournament.joinError'));
      }
    } finally {
      setJoining(false);
    }
  };

  const handleStart = async () => {
    if (!tournament || !user) return;
    setInlineError(null);
    if (tournament.players.length < 4) {
      showInlineError(t('tournament.needMorePlayersMsg', { count: tournament.players.length }));
      return;
    }
    if (tournament.players.length !== tournament.maxPlayers) {
      showInlineError(`Faltan ${tournament.maxPlayers - tournament.players.length} jugadores para completar la llave.`);
      return;
    }
    setStarting(true);
    try {
      await startTournament(torneoId!);
    } catch (e: any) {
      if (e?.message === 'TOURNAMENT_NOT_FULL') {
        showInlineError(`La llave debe estar completa (${tournament.maxPlayers} jugadores).`);
      } else {
        showInlineError(t('tournament.startError'));
      }
    }
    setStarting(false);
  };

  const handleMatchPress = async (match: TournamentMatch) => {
    if (!match.gameId) return;
    if (!actorUid || !torneoId) {
      return;
    }

    const isMyMatch = match.p1 === actorUid || match.p2 === actorUid;
    if (!isMyMatch) {
      showInlineError('Esa partida no es tuya. Usa "Ir a tu partida" para jugar.');
      return;
    }

    setOpeningMatch(true);
    try {
      const claim = await claimTournamentMatchStart(torneoId, actorUid);
      if (!claim.iStarted && claim.startedBy && claim.startedBy !== actorUid) {
        showInlineError(t('tournament.rivalStartedFirst'));
      }
      router.push(`/game/${claim.gameId}?myUid=${auth.currentUser?.uid || actorUid}`);
    } catch {
      router.push(`/game/${match.gameId}?myUid=${auth.currentUser?.uid || actorUid}`);
    } finally {
      setOpeningMatch(false);
    }
  };

  const handleDeleteLocal = async () => {
    if (!actorUid || !tournament) return;
    setInlineError(null);
    setDeleting(true);
    try {
      await deleteLocalTournament(tournament.tournamentId, actorUid);
      router.replace('/(tabs)/torneos');
    } catch {
      showInlineError(t('tournament.deleteError'));
    }
    setDeleting(false);
  };

  const handleShare = () => {
    Share.share({
      message: t('tournament.shareMsg', { name: tournament?.name, id: torneoId }),
    });
  };

  const isCreator = tournament?.createdBy === actorUid;
  const isJoined = tournament ? tournament.players.includes(actorUid || '') : false;
  const isFull = tournament ? tournament.players.length >= tournament.maxPlayers : false;
  const isWaiting = tournament?.status === 'waiting';
  const isActive = tournament?.status === 'active';
  const isFinished = tournament?.status === 'finished';
  const isGlobal = tournament?.type === 'global';

  const statusColor = isActive ? COLORS.success : isFinished ? COLORS.textSecondary : COLORS.warning;
  const statusLabel = isWaiting ? t('tournament.statusWaiting') : isActive ? t('tournament.statusActive') : t('tournament.statusFinished');

  const myActiveMatch = (!actorUid || !tournament || tournament.status !== 'active')
    ? null
    : [...Object.values(tournament.bracket || {}).flat(), ...(tournament.thirdPlaceMatch ? [tournament.thirdPlaceMatch] : [])]
      .find((m) => !m.winner && m.gameId && (m.p1 === actorUid || m.p2 === actorUid)) || null;

  useEffect(() => {
    if (!myActiveMatch?.gameId) {
      autoOpenedGameRef.current = null;
      return;
    }
    if (!myActiveMatch.startedBy) return;
    if (autoOpenedGameRef.current === myActiveMatch.gameId) return;

    autoOpenedGameRef.current = myActiveMatch.gameId;
    router.push(`/game/${myActiveMatch.gameId}?myUid=${auth.currentUser?.uid || actorUid}`);
  }, [myActiveMatch?.gameId, myActiveMatch?.startedBy]);

  // Auto-continuar: cuando aparezca una nueva partida para el usuario,
  // reclamar inicio y abrirla automaticamente.
  useEffect(() => {
    if (!torneoId || !actorUid || !myActiveMatch?.gameId) return;
    if (myActiveMatch.winner) return;
    if (myActiveMatch.startedBy) return;
    if (autoOpenedGameRef.current === myActiveMatch.gameId) return;

    setOpeningMatch(true);
    claimTournamentMatchStart(torneoId, actorUid)
      .then((claim) => {
        autoOpenedGameRef.current = claim.gameId;
        router.push(`/game/${claim.gameId}?myUid=${auth.currentUser?.uid || actorUid}`);
      })
      .catch(() => {})
      .finally(() => setOpeningMatch(false));
  }, [torneoId, actorUid, myActiveMatch?.gameId, myActiveMatch?.startedBy, myActiveMatch?.winner]);

  if (loading || !tournament) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const handleGoToMyMatch = async () => {
    if (!torneoId || !actorUid || !myActiveMatch?.gameId) {
      showInlineError(t('tournament.noActiveMatchesMsg'));
      return;
    }
    setOpeningMatch(true);
    try {
      const claim = await claimTournamentMatchStart(torneoId, actorUid);
      if (!claim.iStarted && claim.startedBy && claim.startedBy !== actorUid) {
        showInlineError(t('tournament.rivalStartedFirst'));
      }
      router.push(`/game/${claim.gameId}?myUid=${auth.currentUser?.uid || actorUid}`);
    } catch {
      router.push(`/game/${myActiveMatch.gameId}?myUid=${auth.currentUser?.uid || actorUid}`);
    } finally {
      setOpeningMatch(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Badge de tipo */}
      <View style={styles.badgesRow}>
        <View style={[styles.typeBadge, isGlobal ? styles.typeBadgeGlobal : styles.typeBadgeLocal]}>
          <Text style={styles.typeBadgeText}>
            {isGlobal ? `🌍 ${t('tournament.typeGlobal').toUpperCase()}` : `📍 ${t('tournament.typeLocal').toUpperCase()}`}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{tournament.name}</Text>

      <View style={styles.statusRow}>
        <Text style={[styles.statusBadge, { color: statusColor, borderColor: statusColor }]}> 
          {statusLabel}
        </Text>
        <TouchableOpacity onPress={handleShare}>
          <Text style={styles.shareBtn}>{t('tournament.share')}</Text>
        </TouchableOpacity>
      </View>

      <AdBanner style={{ marginBottom: 10 }} />

      {inlineError && (
        <View style={styles.inlineErrorBox}>
          <Text style={styles.inlineErrorText}>{inlineError}</Text>
        </View>
      )}

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tournament.players.length}/{tournament.maxPlayers}</Text>
          <Text style={styles.statLabel}>{t('tournament.playersLabel')}</Text>
        </View>
        {tournament.entryFee > 0 && (
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: COLORS.warning }]}>{tournament.entryFee}💎</Text>
            <Text style={styles.statLabel}>{t('tournament.entryLabel')}</Text>
          </View>
        )}
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: COLORS.warning }]}>{tournament.prizes.first}💎</Text>
          <Text style={styles.statLabel}>{t('tournament.firstPrize')}</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{tournament.currentRound}/{tournament.totalRounds}</Text>
          <Text style={styles.statLabel}>{t('tournament.roundLabel')}</Text>
        </View>
      </View>

      {/* Podium */}
      {isFinished && tournament.podium && (
        <View style={styles.podiumBanner}>
          <Text style={styles.podiumTitle}>{t('tournament.podiumTitle')}</Text>
          <Text style={styles.podiumEntry}>🥇 {tournament.playerUsernames[tournament.podium.first] ?? tournament.podium.first}</Text>
          <Text style={styles.podiumEntry}>🥈 {tournament.playerUsernames[tournament.podium.second] ?? tournament.podium.second}</Text>
          {tournament.podium.third && (
            <Text style={styles.podiumEntry}>🥉 {tournament.playerUsernames[tournament.podium.third] ?? tournament.podium.third}</Text>
          )}
        </View>
      )}

      {/* Distribución de premios */}
      <View style={styles.prizesBox}>
        <Text style={styles.prizesTitle}>{t('tournament.prizeDistribution')}</Text>
        <View style={styles.prizesRow}>
          <Text style={styles.prizeItem}>🥇 {tournament.prizes.first}💎</Text>
          <Text style={styles.prizeItem}>🥈 {tournament.prizes.second}💎</Text>
          <Text style={styles.prizeItem}>🥉 {tournament.prizes.third}💎</Text>
          <Text style={styles.prizeItem}>👑 {tournament.creatorCut}💎</Text>
        </View>
      </View>

      {/* Lista de jugadores (modo waiting) */}
      {isWaiting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('tournament.playersEnrolled', { count: tournament.players.length, max: tournament.maxPlayers })}
          </Text>
          {tournament.players.map((uid) => (
            <View key={uid} style={styles.playerRow}>
              <View style={[styles.playerDot, uid === tournament.createdBy && styles.creatorDot]} />
              <Text style={styles.playerName}>
                {tournament.playerUsernames[uid] || uid}
                {uid === tournament.createdBy && ' 👑'}
                {uid === actorUid && ` ${t('tournament.you')}`}
              </Text>
            </View>
          ))}
          {Array.from({ length: tournament.maxPlayers - tournament.players.length }).map((_, i) => (
            <View key={`empty-${i}`} style={[styles.playerRow, styles.playerRowEmpty]}>
              <View style={styles.playerDotEmpty} />
              <Text style={styles.playerNameEmpty}>{t('tournament.waitingDots')}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Vista previa de llaves antes de iniciar */}
      {isWaiting && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('tournament.bracket')}</Text>
          {!isFull && (
            <Text style={styles.waitingText}>
              El sorteo se realiza cuando la llave este completa.
            </Text>
          )}
          {isFull && (
            <Text style={styles.waitingText}>
              Llave sorteada. Lista para iniciar.
            </Text>
          )}
          <BracketView
            bracket={buildPreviewBracket(tournament)}
            thirdPlaceMatch={null}
            totalRounds={tournament.totalRounds}
            currentUserId={actorUid}
            onMatchPress={() => undefined}
          />
        </View>
      )}

      {/* Bracket */}
      {(isActive || isFinished) && Object.keys(tournament.bracket).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('tournament.bracket')}</Text>
          <BracketView
            bracket={tournament.bracket}
            thirdPlaceMatch={tournament.thirdPlaceMatch}
            totalRounds={tournament.totalRounds}
            currentUserId={actorUid}
            onMatchPress={handleMatchPress}
          />
        </View>
      )}

      {/* Acciones */}
      <View style={styles.actions}>
        {/* Unirse */}
        {isWaiting && !isJoined && !isFull && (
          <TouchableOpacity
            style={[styles.joinBtn, joining && styles.btnDisabled]}
            onPress={handleJoin}
            disabled={joining}
          >
            {joining ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.joinBtnText}>
                {t('tournament.joinBtn')}{tournament.entryFee > 0 ? ` (${tournament.entryFee}💎)` : ` ${t('tournament.joinFree')}`}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Iniciar (creador) */}
        {isWaiting && isCreator && (
          <TouchableOpacity
            style={[styles.startBtn, (starting || tournament.players.length !== tournament.maxPlayers) && styles.btnDisabled]}
            onPress={handleStart}
            disabled={starting || tournament.players.length !== tournament.maxPlayers}
          >
            {starting ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.startBtnText}>
                {t('tournament.startTournament')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Eliminar torneo local (solo creador, solo esperando) */}
        {isWaiting && isCreator && !isGlobal && (
          <TouchableOpacity
            style={[styles.deleteBtn, deleting && styles.btnDisabled]}
            onPress={handleDeleteLocal}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator color={COLORS.danger} />
            ) : (
              <Text style={styles.deleteBtnText}>{t('tournament.deleteLocalBtn')}</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Esperando inicio */}
        {isWaiting && isJoined && !isCreator && (
          <View style={styles.waitingMsg}>
            <Text style={styles.waitingText}>{t('tournament.enrolledWaiting')}</Text>
          </View>
        )}

        {/* Torneo lleno */}
        {isWaiting && !isJoined && isFull && (
          <View style={styles.waitingMsg}>
            <Text style={styles.waitingText}>{t('tournament.fullLabel')}</Text>
          </View>
        )}

        {isActive && isParticipant && myActiveMatch?.gameId && (
          <TouchableOpacity
            style={[styles.playMatchBtn, openingMatch && styles.btnDisabled]}
            onPress={handleGoToMyMatch}
            disabled={openingMatch}
          >
            {openingMatch ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.playMatchBtnText}>{t('tournament.goToMyMatch')}</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.backBtnBottom} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('tournament.backToTournaments')}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
