import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  createTournament, getTournamentPrizeInfo,
  TOURNAMENT_PASS_COST, ENTRY_FEE_GLOBAL,
} from '../../services/tournament';
import { useAuthStore } from '../../store/authStore';
import { auth } from '../../services/firebase';
import { useColors } from '../../hooks/useColors';
import { useTranslation } from 'react-i18next';
import '../../i18n';

type MaxPlayers = 4 | 8 | 16;
type TournamentType = 'local' | 'global';

interface SizeOption {
  value: MaxPlayers;
  label: string;
  description: string;
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 20, paddingTop: 50, paddingBottom: 40 },
  backBtn: { marginBottom: 20 },
  backText: { color: COLORS.primary, fontSize: 15 },
  title: {
    color: COLORS.primary, fontSize: 28, fontWeight: '900',
    letterSpacing: 4, textAlign: 'center', marginBottom: 6,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  subtitle: { color: COLORS.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 30 },
  section: { marginBottom: 24 },
  label: { color: COLORS.textSecondary, fontSize: 11, fontWeight: 'bold', letterSpacing: 1, marginBottom: 10 },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: COLORS.text, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border,
  },
  typeRow: { flexDirection: 'row', gap: 10 },
  typeCard: {
    flex: 1, backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.border,
  },
  typeCardSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,245,255,0.07)' },
  typeCardLocked: { opacity: 0.7 },
  typeIcon: { fontSize: 24, marginBottom: 4 },
  typeTitle: { color: COLORS.text, fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
  typeSelectedText: { color: COLORS.primary },
  typeDesc: { color: COLORS.textSecondary, fontSize: 10, textAlign: 'center', marginBottom: 2 },
  typeEntryFee: { color: COLORS.warning, fontSize: 10, fontWeight: 'bold', marginTop: 2 },
  globalNotice: {
    marginTop: 10, backgroundColor: 'rgba(255,165,0,0.08)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,165,0,0.3)',
  },
  globalNoticeText: { color: COLORS.warning, fontSize: 11, lineHeight: 17 },
  sizeCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 14, marginBottom: 8,
    borderWidth: 2, borderColor: COLORS.border,
  },
  sizeCardSelected: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,245,255,0.07)' },
  sizeLeft: { flex: 1 },
  sizeTitle: { color: COLORS.text, fontSize: 15, fontWeight: 'bold' },
  sizeSelectedText: { color: COLORS.primary },
  sizeDesc: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  sizeRight: { alignItems: 'flex-end', gap: 2 },
  sizePrize: { color: COLORS.warning, fontSize: 12, fontWeight: 'bold' },
  sizePrize2: { color: COLORS.textSecondary, fontSize: 10 },
  sizePool: { color: COLORS.primary, fontSize: 10, marginTop: 2 },
  selectedDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary, marginTop: 4 },
  infoBox: {
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 28,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoTitle: { color: COLORS.text, fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  infoText: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 3, lineHeight: 18 },
  infoSep: { height: 8 },
  createBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: { color: COLORS.background, fontSize: 15, fontWeight: '900', letterSpacing: 2 },
  buyPassBtn: { alignItems: 'center', marginTop: 14 },
  buyPassText: { color: COLORS.primary, fontSize: 13 },
});

export default function CrearTorneoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ type?: string }>();
  // El tipo se determina por el parámetro de la URL y queda bloqueado
  const lockedType = (params.type === 'global' ? 'global' : 'local') as TournamentType;
  const { user, updateUser } = useAuthStore();
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<MaxPlayers>(4);
  const type = lockedType; // tipo fijo según desde donde se llegó
  const [loading, setLoading] = useState(false);

  const SIZES: SizeOption[] = [
    { value: 4,  label: t('tournament.size4'),  description: t('tournament.size4Desc') },
    { value: 8,  label: t('tournament.size8'),  description: t('tournament.size8Desc') },
    { value: 16, label: t('tournament.size16'), description: t('tournament.size16Desc') },
  ];

  const inv = (user?.inventory as any) || {};
  const hasTournamentPass = (inv.tournament_pass ?? 0) >= 1;
  const prizeInfo = getTournamentPrizeInfo(type, maxPlayers);

  const handleCreate = async () => {
    if (!user) return;
    const actorUid = auth.currentUser?.uid || user.uid;
    if (!actorUid) {
      Alert.alert('Error', 'Sesion invalida. Cierra sesion e inicia de nuevo.');
      return;
    }
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      Alert.alert(t('tournament.invalidName'), t('tournament.invalidNameMsg'));
      return;
    }

    if (type === 'global' && !hasTournamentPass) {
      Alert.alert(
        t('tournament.passRequired'),
        t('tournament.passRequiredMsg', { cost: TOURNAMENT_PASS_COST }),
        [{ text: t('tournament.goToShop'), onPress: () => router.push('/(tabs)/tienda') }, { text: t('tournament.cancel'), style: 'cancel' }]
      );
      return;
    }

    setLoading(true);
    try {
      const tournamentId = await createTournament(
        trimmed, actorUid, user.username, user.avatar, maxPlayers, type
      );
      // Actualizar inventario local si se consumió el pase
      if (type === 'global') {
        updateUser({
          inventory: {
            ...user.inventory,
            tournament_pass: Math.max(0, (inv.tournament_pass ?? 1) - 1),
          },
        });
      }
      router.replace(`/tournament/${tournamentId}`);
    } catch (e: any) {
      if (e?.message === 'GLOBAL_TOURNAMENT_EXISTS') {
        Alert.alert(t('tournament.onlyOneGlobal'), t('tournament.onlyOneGlobalMsg'));
      } else if (e?.message === 'NO_TOURNAMENT_PASS') {
        Alert.alert(t('tournament.noTournamentPass'), t('tournament.noTournamentPassMsg'));
      } else {
        Alert.alert(t('tournament.error'), t('tournament.createError'));
      }
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>{t('tournament.backBtn')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('tournament.createTitle')}</Text>
      <Text style={styles.subtitle}>{t('tournament.createSubtitle')}</Text>

      {/* Tipo de torneo — fijo según desde donde se llegó */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('tournament.tournamentType')}</Text>
        {type === 'local' ? (
          <View style={[styles.typeCard, styles.typeCardSelected, { alignSelf: 'center', width: '60%' }]}>
            <Text style={styles.typeIcon}>📍</Text>
            <Text style={[styles.typeTitle, styles.typeSelectedText]}>{t('tournament.local')}</Text>
            <Text style={styles.typeDesc}>{t('tournament.localDesc')}</Text>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <View style={[styles.typeCard, styles.typeCardSelected, !hasTournamentPass && styles.typeCardLocked, { alignSelf: 'center', width: '60%' }]}>
              <Text style={styles.typeIcon}>🌍</Text>
              <Text style={[styles.typeTitle, styles.typeSelectedText]}>{t('tournament.global')}</Text>
              <Text style={styles.typeDesc}>
                {hasTournamentPass ? t('tournament.globalDesc') : t('tournament.globalNeedPass', { cost: TOURNAMENT_PASS_COST })}
              </Text>
              <Text style={styles.typeEntryFee}>{t('tournament.globalEntryFee', { fee: ENTRY_FEE_GLOBAL })}</Text>
            </View>
            <View style={styles.globalNotice}>
              <Text style={styles.globalNoticeText}>
                {t('tournament.globalNotice')}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Nombre */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('tournament.tournamentName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t('tournament.namePlaceholder')}
          placeholderTextColor={COLORS.textSecondary}
          maxLength={40}
        />
      </View>

      {/* Tamaño */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('tournament.size')}</Text>
        {SIZES.map((s) => {
          const info = getTournamentPrizeInfo(type, s.value);
          return (
            <TouchableOpacity
              key={s.value}
              style={[styles.sizeCard, maxPlayers === s.value && styles.sizeCardSelected]}
              onPress={() => setMaxPlayers(s.value)}
            >
              <View style={styles.sizeLeft}>
                <Text style={[styles.sizeTitle, maxPlayers === s.value && styles.sizeSelectedText]}>
                  {s.label}
                </Text>
                <Text style={styles.sizeDesc}>{s.description}</Text>
              </View>
              <View style={styles.sizeRight}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 2 }}>💎</Text>
                  <Text style={styles.sizePrize}>{info.first}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ color: '#FFD700', fontSize: 10, marginRight: 2 }}>💎</Text>
                  <Text style={styles.sizePrize2}>{info.second} ·  {info.third}</Text>
                </View>
                {type === 'global' && (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: '#FFD700', fontSize: 10, marginRight: 2 }}>💎</Text>
                    <Text style={styles.sizePool}>Pool: {info.pool}</Text>
                  </View>
                )}
                {maxPlayers === s.value && <View style={styles.selectedDot} />}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t('tournament.prizesAndRules')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 4 }}>💎</Text>
          <Text style={styles.infoText}>  1ro: {prizeInfo.first}{type === 'global' ? ' (49% del pool)' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 4 }}>💎</Text>
          <Text style={styles.infoText}>  2do: {prizeInfo.second}{type === 'global' ? ' (19.6%)' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 4 }}>💎</Text>
          <Text style={styles.infoText}>  3ro: {prizeInfo.third}{type === 'global' ? ' (9.4%)' : ''}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 4 }}>💎</Text>
          <Text style={styles.infoText}>  Creador: {prizeInfo.creator}{type === 'global' ? ' (20%)' : ' fijo'}</Text>
        </View>
        {type === 'global' && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontSize: 12, marginRight: 4 }}>💎</Text>
            <Text style={styles.infoText}>  Economía global: {prizeInfo.pool > 0 ? Math.floor(prizeInfo.pool * 0.02) : 0} (2%)</Text>
          </View>
        )}
        <Text style={styles.infoSep} />
        <Text style={styles.infoText}> {t('tournament.ruleElimination')}</Text>
        <Text style={styles.infoText}> {t('tournament.ruleSemiFinal')}</Text>
        <Text style={styles.infoText}> {t('tournament.ruleCreatorStart')}</Text>
      </View>

      {/* Banner antes del botón crear */}
      <AdBanner placement="tournaments" style={{ marginBottom: 8 }} />

      {/* Botón crear */}
      <TouchableOpacity
        style={[
          styles.createBtn,
          (loading || name.trim().length < 3 || (type === 'global' && !hasTournamentPass)) && styles.createBtnDisabled,
        ]}
        onPress={handleCreate}
        disabled={loading || name.trim().length < 3 || (type === 'global' && !hasTournamentPass)}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.createBtnText}>
            {type === 'global' ? t('tournament.createGlobal') : t('tournament.createLocal')}
          </Text>
        )}
      </TouchableOpacity>

      {type === 'global' && !hasTournamentPass && (
        <TouchableOpacity style={styles.buyPassBtn} onPress={() => router.push('/(tabs)/tienda')}>
          <Text style={styles.buyPassText}>{t('tournament.buyPassInShop')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}
