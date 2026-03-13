import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { WILDCARDS, Wildcard } from '../services/wildcards';
import { COLORS } from '../constants/theme';

interface WildcardBarProps {
  playerGems: number;
  wildcardUsed: boolean;
  isMyTurn: boolean;
  shieldActive: boolean;
  onUseWildcard: (wildcardId: string) => void;
}

const WildcardBar: React.FC<WildcardBarProps> = ({
  playerGems,
  wildcardUsed,
  isMyTurn,
  shieldActive,
  onUseWildcard,
}) => {
  const canUse = (w: Wildcard) =>
    isMyTurn && !wildcardUsed && playerGems >= w.cost && !shieldActive;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>COMODINES</Text>
        <Text style={styles.gems}>💎 {playerGems}</Text>
      </View>
      {shieldActive && (
        <Text style={styles.shieldWarning}>🛡️ Tu comodín fue bloqueado</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {WILDCARDS.map((w) => {
          const available = canUse(w);
          return (
            <TouchableOpacity
              key={w.id}
              style={[
                styles.card,
                { borderColor: w.color },
                !available && styles.cardDisabled,
              ]}
              onPress={() => onUseWildcard(w.id)}
              disabled={!available}
            >
              <Text style={styles.icon}>{w.icon}</Text>
              <Text style={[styles.cardName, { color: w.color }]} numberOfLines={1}>
                {w.name}
              </Text>
              <Text style={styles.cost}>💎 {w.cost}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  gems: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  shieldWarning: {
    color: COLORS.success,
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 10,
    borderWidth: 1.5,
    padding: 10,
    marginRight: 8,
    width: 75,
  },
  cardDisabled: {
    opacity: 0.35,
  },
  icon: {
    fontSize: 22,
    marginBottom: 4,
  },
  cardName: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  cost: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
});

export default WildcardBar;
