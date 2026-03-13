import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TournamentMatch } from '../services/tournament';
import { COLORS } from '../constants/theme';

interface BracketViewProps {
  bracket: Record<string, TournamentMatch[]>;
  currentRound: number;
  currentUserId?: string;
}

const MatchCard: React.FC<{
  match: TournamentMatch;
  currentUserId?: string;
}> = ({ match, currentUserId }) => {
  const p1Win = match.winner === match.p1;
  const p2Win = match.winner === match.p2;
  const isFinished = match.winner !== null;

  return (
    <View style={styles.matchCard}>
      <PlayerSlot
        uid={match.p1}
        username={match.p1Username}
        isWinner={p1Win}
        isLoser={isFinished && !p1Win}
        isCurrentUser={match.p1 === currentUserId}
        isTBD={!match.p1}
      />
      <View style={styles.vsDivider}>
        <Text style={styles.vsText}>VS</Text>
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

const PlayerSlot: React.FC<{
  uid: string;
  username: string;
  isWinner: boolean;
  isLoser: boolean;
  isCurrentUser: boolean;
  isTBD: boolean;
}> = ({ username, isWinner, isLoser, isCurrentUser, isTBD }) => {
  let bgColor = COLORS.surface;
  let textColor = COLORS.text;
  let borderColor = COLORS.border;

  if (isWinner) {
    bgColor = 'rgba(52,199,89,0.15)';
    textColor = COLORS.success;
    borderColor = COLORS.success;
  } else if (isLoser) {
    bgColor = 'rgba(255,59,48,0.1)';
    textColor = COLORS.textSecondary;
    borderColor = 'transparent';
  } else if (isCurrentUser) {
    borderColor = COLORS.primary;
  }

  return (
    <View style={[styles.playerSlot, { backgroundColor: bgColor, borderColor }]}>
      <Text style={[styles.playerName, { color: textColor }, isLoser && styles.strikethrough]} numberOfLines={1}>
        {isTBD ? '⏳ Por definir' : username}
      </Text>
      {isWinner && <Text style={styles.winnerBadge}>✓</Text>}
    </View>
  );
};

export default function BracketView({ bracket, currentRound, currentUserId }: BracketViewProps) {
  const rounds = Object.keys(bracket).sort();

  if (rounds.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>El bracket se generará al iniciar el torneo</Text>
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
              <Text style={[styles.roundLabel, isCurrent && styles.roundLabelActive]}>
                {getRoundName(roundKey, rounds.length)}
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

function getRoundName(roundKey: string, totalRounds: number): string {
  const num = parseInt(roundKey.replace('round', ''), 10);
  if (num === totalRounds) return '🏆 Final';
  if (num === totalRounds - 1) return 'Semifinal';
  if (num === totalRounds - 2) return 'Cuartos';
  return `Ronda ${num}`;
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
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  roundLabelActive: {
    color: COLORS.primary,
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
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  playerSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  playerName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    opacity: 0.5,
  },
  winnerBadge: {
    color: COLORS.success,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  vsDivider: {
    backgroundColor: COLORS.border,
    alignItems: 'center',
    paddingVertical: 2,
  },
  vsText: {
    color: COLORS.textSecondary,
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 2,
  },
  empty: {
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
});
