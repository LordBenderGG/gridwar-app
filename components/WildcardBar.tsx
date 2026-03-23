import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { WILDCARDS, Wildcard } from '../services/wildcards';
import { WildcardInventory } from '../services/auth';
import { useColors } from '../hooks/useColors';
import '../i18n';

/** Maps wildcard service IDs to their i18n key prefix in the wildcards namespace */
const WC_I18N_KEY: Record<string, string> = {
  turbo:       'turbo',
  time_reduce: 'tiempo',
  teleport:    'teleport',
  shield:      'shield',
  confusion:   'confusion',
  sabotage:    'sabotaje',
  freeze:      'freeze',
  earthquake:  'earthquake',
};

interface WildcardBarProps {
  wildcards: Partial<WildcardInventory>;
  wildcardUsed: boolean;
  isMyTurn: boolean;
  shieldActive: boolean;
  onUseWildcard: (wildcardId: string) => void;
  compact?: boolean;
}

const createStyles = (COLORS: any) => StyleSheet.create({
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
    marginBottom: 4,
  },
  countBadge: {
    backgroundColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: 'bold',
  },
  countZero: {
    color: COLORS.textMuted,
  },
});

const WildcardBar: React.FC<WildcardBarProps> = ({
  wildcards,
  wildcardUsed,
  isMyTurn,
  shieldActive,
  onUseWildcard,
  compact = false,
}) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const getCount = (id: string): number =>
    (wildcards as Record<string, number>)[id] ?? 0;

  const canUse = (w: Wildcard) =>
    isMyTurn && !wildcardUsed && getCount(w.id) > 0 && !shieldActive;

  return (
    <View style={[styles.container, compact && { padding: 8 }] }>
      <View style={styles.header}>
        <Text style={styles.title}>{t('wildcards.title').toUpperCase()}</Text>
      </View>
      {shieldActive && (
        <Text style={styles.shieldWarning}> {t('wildcards.shieldRival')}</Text>
      )}
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {WILDCARDS.map((w) => {
          const available = canUse(w);
          const count = getCount(w.id);
          const keyPrefix = WC_I18N_KEY[w.id] ?? w.id;
          return (
            <TouchableOpacity
              key={w.id}
              style={[
                styles.card,
                compact && { width: 66, padding: 7, marginRight: 6 },
                { borderColor: w.color },
                !available && styles.cardDisabled,
              ]}
              onPress={() => onUseWildcard(w.id)}
              disabled={!available}
            >
              <Text style={[styles.icon, compact && { fontSize: 18, marginBottom: 2 }]}>{w.icon}</Text>
              <Text style={[styles.cardName, compact && { fontSize: 8, marginBottom: 2 }, { color: w.color }]} numberOfLines={1}>
                {t(`wildcards.${keyPrefix}Name`)}
              </Text>
              <View style={[styles.countBadge, compact && { paddingHorizontal: 5, paddingVertical: 1 }]}>
                <Text style={[styles.countText, compact && { fontSize: 9 }, count === 0 && styles.countZero]}>
                  x{count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

export default WildcardBar;
