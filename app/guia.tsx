import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColors } from '../hooks/useColors';
import { WILDCARDS } from '../services/wildcards';
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

const createStyles = (COLORS: any) => StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  infoDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 10,
    marginBottom: 10,
  },
  wildcardCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 4,
  },
  wcLeft: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  wcIcon: {
    fontSize: 22,
  },
  wcBody: {
    flex: 1,
  },
  wcHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  wcName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  costBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  costText: {
    fontSize: 12,
    fontWeight: '700',
  },
  wcDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  tipCard: {
    backgroundColor: COLORS.surfaceLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.accent + '44',
  },
  tipTitle: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  tipDesc: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  bottomSpacer: {
    height: 16,
  },
  bottomBackBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 12,
  },
  bottomBackText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default function GuiaScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('guide.title')}</Text>
        <Text style={styles.headerSub}>{t('guide.subtitle')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* How to get wildcards */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('guide.howToGet')}</Text>
          <Text style={styles.infoDesc}>{t('guide.howToGetDesc')}</Text>
        </View>

        {/* How to use wildcards */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('guide.howToUse')}</Text>
          <Text style={styles.infoDesc}>{t('guide.howToUseDesc')}</Text>
        </View>

        {/* Wildcards list */}
        <Text style={styles.sectionLabel}>{t('wildcards.title').toUpperCase()}</Text>

        {WILDCARDS.map((wc) => {
          const keyPrefix = WC_I18N_KEY[wc.id] ?? wc.id;
          return (
          <View key={wc.id} style={[styles.wildcardCard, { borderLeftColor: wc.color }]}>
            <View style={styles.wcLeft}>
              <Text style={styles.wcIcon}>{wc.icon}</Text>
            </View>
            <View style={styles.wcBody}>
              <View style={styles.wcHeader}>
                <Text style={styles.wcName}>{t(`wildcards.${keyPrefix}Name`)}</Text>
                <View style={[styles.costBadge, { backgroundColor: wc.color + '22' }]}>
                  <Text style={[styles.costText, { color: wc.color }]}>
                     {wc.cost}
                  </Text>
                </View>
              </View>
              <Text style={styles.wcDesc}>{t(`wildcards.${keyPrefix}Desc`)}</Text>
            </View>
          </View>
          );
        })}

        {/* Tip */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>{t('guide.tip')}</Text>
          <Text style={styles.tipDesc}>{t('guide.tipDesc')}</Text>
        </View>

        <TouchableOpacity style={styles.bottomBackBtn} onPress={() => router.back()}>
          <Text style={styles.bottomBackText}>Volver</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </SafeAreaView>
  );
}
