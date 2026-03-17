import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { TournamentMatch } from '../services/tournament';
import { useColors } from '../hooks/useColors';

interface BracketViewProps {
  bracket: Record<string, TournamentMatch[]>;
  currentRound: number;
  currentUserId?: string;
}

const PlayerSlot: React.FC<{
  uid: string;
  username: string;
  isWinner: boolean;
  isLoser: boolean;
  isCurrentUser: boolean;
  isTBD: boolean;
}> = ({ username, isWinner, isLoser, isCurrentUser, isTBD }) => {
  const { t } = useTranslation();
  const COLORS = useColors();

  let bgColor = COLORS.surface;
  let textColor = COLORS.text;
  let borderColor = 'transparent' as string;

  if (isWinner) {
    bgColor = COLORS.success + '26';
    textColor = COLORS.success;
    borderColor = COLORS.success;
  } else if (isLoser) {
    bgColor = COLORS.danger + '1A';
    textColor = COLORS.textSecondary;
    borderColor = 'transparent';
  } else if (isCurrentUser) {
    borderColor = COLORS.primary;
  }

  return (
    <View style={[styles.playerSlot, { backgroundColor: bgColor, borderColor }]}>
      <Text
        style={[styles.playerName, { color: textColor }, isLoser && styles.strikethrough]}
        numberOfLines={1}
      >
        {isTBD ? t('bracket.tbd') : username}
      </Text>
      {isWinner && <Text style={[styles.winnerBadge, { color: COLORS.success }]}>✓</Text>}
    </View>
  );
};

const MatchCard: React.FC<{
  match: TournamentMatch;
  currentUserId?: string;
}> = ({ match, currentUserId }) => {
  const COLORS = useColors();
  const p1Win = match.winner === match.p1;
  const p2Win = match.winner === match.p2;
  const isFinished = match.winner !== null;

  return (
    <View style={[styles.matchCard, { backgroundColor: COLORS.surfaceLight, borderColor: COLORS.border }]}>
      <PlayerSlot
        uid={match.p1}
        username={match.p1Username}
        isWinner={p1Win}
        isLoser={isFinished && !p1Win}
        isCurrentUser={match.p1 === currentUserId}
        isTBD={!match.p1}
      />
      <View style={[styles.vsDivider, { backgroundColor: COLORS.border }]}>
        <Text style={[styles.vsText, { color: COLORS.textSecondary }]}>VS</Text>
      </View>
      <PlayerSlot
        uid={match.p2}
        username={match.p2Username}
        isWinner={p2Win}
        isLoser={isFinished && !p2Win}
        isCurrentUser={match.p2 === currentUserId}
        isTBD={!match.p2}
      />
    </View>
  );
};

export default function BracketView({ bracket, currentRound, currentUserId }: BracketViewProps) {
  const { t } = useTranslation();
  const COLORS = useColors();
  const rounds = Object.keys(bracket).sort();

  if (rounds.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: COLORS.textSecondary }]}>{t('bracket.emptyBracket')}</Text>
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      <View style={styles.bracketRow}>
        {rounds.map((roundKey, roundIndex) => {
          const matches = bracket[roundKey];
          const roundNum = roundIndex + 1;
          const isCurrent = roundNum === currentRound;

          return (
            <View key={roundKey} style={styles.roundColumn}>
              <Text style={[styles.roundLabel, { color: COLORS.textSecondary }, isCurrent && { color: COLORS.primary }]}>
                {getRoundName(roundKey, rounds.length, t)}
              </Text>
              <View style={styles.matchesColumn}>
                {matches.map((match) => (
                  <View key={match.matchId} style={styles.matchWrapper}>
                    <MatchCard match={match} currentUserId={currentUserId} />
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

function getRoundName(roundKey: string, totalRounds: number, t: any): string {
  const num = parseInt(roundKey.replace('round', ''), 10);
  if (num === totalRounds) return t('bracket.final');
  if (num === totalRounds - 1) return t('bracket.semifinal');
  if (num === totalRounds - 2) return t('bracket.quarters');
  return t('bracket.roundN', { n: num });
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bracketRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 16,
  },
  roundColumn: {
    width: 180,
    alignItems: 'center',
  },
  roundLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  matchesColumn: {
    flex: 1,
    justifyContent: 'space-around',
    gap: 16,
  },
  matchWrapper: {
    marginVertical: 8,
  },
  matchCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  playerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  winnerBadge: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  vsDivider: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  vsText: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  empty: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
