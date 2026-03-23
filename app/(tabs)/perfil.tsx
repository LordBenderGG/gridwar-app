import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Image, ScrollView,
  TouchableOpacity, Alert, TextInput, Modal,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { db } from '../../services/firebase';
import { logoutUser, uploadProfilePhoto } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { getRankInfo, RANKS, getTranslatedRankName } from '../../services/ranking';
import AvatarPicker, { AVATARS } from '../../components/AvatarPicker';
import { WILDCARDS } from '../../services/wildcards';
import { useColors } from '../../hooks/useColors';
import { useThemeStore } from '../../store/themeStore';
import { LEVEL_TABLE } from '../../constants/theme';
import { getUserAchievements, ACHIEVEMENTS } from '../../services/achievements';
import '../../i18n';

interface HistoryItem {
  gameId: string;
  opponentUsername: string;
  result: 'win' | 'loss';
  score: string;
  date: any;
  type: string;
}

const WILDCARD_KEYS = ['turbo', 'time_reduce', 'teleport', 'shield', 'confusion', 'sabotage', 'freeze', 'earthquake'] as const;

const normalizeWildcards = (raw: any): Record<string, number> => {
  const out: Record<string, number> = {};
  WILDCARD_KEYS.forEach((k) => {
    const value = raw?.[k];
    const n = typeof value === 'number' ? value : Number(value);
    out[k] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  });
  return out;
};

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { alignItems: 'center', padding: 20, paddingTop: 50, paddingBottom: 48 },
  heroBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  avatarContainer: { position: 'relative', marginBottom: 14 },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    padding: 3,
    backgroundColor: COLORS.background,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
  },
  editBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  editBadgeText: { fontSize: 16 },
  nameTouchable: { alignItems: 'center', marginBottom: 2 },
  username: { fontSize: 26, fontWeight: '900' },
  nameEditHint: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
    marginTop: 6,
  },
  rankPillIcon: { fontSize: 16 },
  rankPillText: { fontSize: 14, fontWeight: '700' },
  progressSection: { width: '100%', marginBottom: 16 },
  xpSection: { width: '100%', marginBottom: 24 },
  xpLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  xpLevelBadge: {
    backgroundColor: COLORS.purple,
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  xpValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: 'bold',
    flex: 1,
  },
  xpNext: {
    color: COLORS.textMuted,
    fontSize: 10,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  achievementItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    padding: 10,
    alignItems: 'center',
    width: '22%',
  },
  achievementLocked: {
    borderColor: COLORS.border,
    opacity: 0.4,
  },
  achievementIcon: {
    fontSize: 22,
    marginBottom: 3,
  },
  achievementLabel: {
    color: COLORS.text,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  achievementLabelLocked: {
    color: COLORS.textMuted,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressLabel: { color: COLORS.textSecondary, fontSize: 11 },
  progressPoints: { color: COLORS.text, fontSize: 12, fontWeight: 'bold' },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 28,
  },
  statBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    width: '30%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  statLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: 'bold', letterSpacing: 1, marginTop: 3 },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginBottom: 12,
  },
  sectionTitleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 10,
  },
  sectionAction: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionCount: { color: COLORS.textMuted, fontSize: 11 },
  // Ventajas activas
  advantagesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  advantageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  advantageIcon: { fontSize: 16 },
  advantageLabel: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  // Comodines
  wildcardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  wildcardItem: {
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    alignItems: 'center',
    width: '22%',
  },
  wildcardItemEmpty: {
    opacity: 0.4,
  },
  wildcardIcon: { fontSize: 22, marginBottom: 4 },
  wildcardCount: { fontSize: 12, fontWeight: 'bold' },
  // Personalización
  subSectionLabel: {
    color: COLORS.textMuted,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  optionsRow: {
    marginBottom: 12,
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: COLORS.surface,
  },
  optionChipLocked: {
    opacity: 0.5,
  },
  optionLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  optionLabelLocked: {
    color: COLORS.textMuted,
  },
  activeIndicator: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  // Historial
  emptyHistory: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyHistoryEmoji: { fontSize: 36 },
  emptyHistoryText: { color: COLORS.textSecondary, fontSize: 13 },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    width: '100%',
    borderWidth: 1,
    gap: 10,
  },
  winItem: { backgroundColor: 'rgba(0,230,118,0.06)', borderColor: COLORS.success },
  lossItem: { backgroundColor: 'rgba(255,23,68,0.06)', borderColor: COLORS.danger },
  resultBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'center',
  },
  winBadge: { backgroundColor: COLORS.success },
  lossBadge: { backgroundColor: COLORS.danger },
  resultBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  historyInfo: { flex: 1 },
  historyOpponent: { color: COLORS.text, fontSize: 13, fontWeight: '600' },
  historyScore: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  historyTypeIcon: { fontSize: 18 },
  logoutBtn: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: COLORS.danger,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  logoutText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 15 },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  nameInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 16,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnConfirm: {
    backgroundColor: COLORS.primary,
  },
  modalBtnTextCancel: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  modalBtnTextConfirm: {
    color: COLORS.background,
    fontWeight: 'bold',
  },
  avatarModalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '80%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatarModalActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  avatarModalClose: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  avatarModalCloseText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  // Toggle de tema
  themeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  themeToggleIcon: { fontSize: 22 },
  themeToggleInfo: { flex: 1 },
  themeToggleLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  themeToggleDesc: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  themeToggleSwitch: {
    width: 48,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  themeToggleSwitchOn: { backgroundColor: COLORS.primary },
  themeToggleSwitchOff: { backgroundColor: COLORS.border },
  themeToggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  themeToggleKnobOn: { alignSelf: 'flex-end' },
  themeToggleKnobOff: { alignSelf: 'flex-start' },
});

export default function PerfilScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  // Opciones de personalización disponibles
  const FRAME_OPTIONS = [
    { id: null, label: t('profile.frameNone'), color: COLORS.border },
    { id: 'frame_gold', label: t('profile.frameGold'), color: '#FFD700' },
    { id: 'frame_neon', label: t('profile.frameNeon'), color: '#00F5FF' },
    { id: 'frame_fire', label: t('profile.frameFire'), color: '#FF6B35' },
  ];

  const THEME_OPTIONS = [
    { id: null, label: t('profile.themeDefault'), color: COLORS.border },
    { id: 'theme_dark', label: t('profile.themeDark'), color: '#333' },
    { id: 'theme_neon', label: t('profile.themeNeon'), color: '#00F5FF' },
    { id: 'theme_wood', label: t('profile.themeWood'), color: '#8B6914' },
    { id: 'theme_fire', label: t('profile.themeFire'), color: '#FF6B35' },
    { id: 'theme_ice', label: t('profile.themeIce'), color: '#89CFF0' },
    { id: 'theme_matrix', label: t('profile.themeMatrix'), color: '#00FF41' },
  ];

  const NAME_COLOR_OPTIONS = [
    { id: null, label: t('profile.colorWhite'), color: COLORS.text },
    { id: 'color_gold', label: t('profile.colorGold'), color: '#FFD700' },
    { id: 'color_cyan', label: t('profile.colorCyan'), color: '#00F5FF' },
    { id: 'color_pink', label: t('profile.colorPink'), color: '#FF69B4' },
  ];
  const { isDark, toggleTheme } = useThemeStore();
  const { user, setUser, updateUser } = useAuthStore();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);

  useEffect(() => {
    if (!user) return;
    getUserAchievements(user.uid)
      .then(setUnlockedAchievements)
      .catch(() => {});
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const fetchHistory = async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'history'),
          orderBy('date', 'desc'),
          limit(20)
        );
        const snap = await getDocs(q);
        setHistory(snap.docs.map((d) => d.data() as HistoryItem));
      } catch {
        // Sin historial todavía
      }
    };
    fetchHistory();
  }, [user?.uid]);

  // Sincronizacion en tiempo real del perfil (comodines, gemas, etc.)
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = onSnapshot(doc(db, 'users', user.uid), (snap) => {
      if (!snap.exists()) return;
      const incoming = snap.data() as any;
      const merged = {
        ...(user as any),
        ...incoming,
        uid: incoming.uid || user.uid,
        wildcards: normalizeWildcards(incoming.wildcards ?? user.wildcards),
      };
      setUser(merged as any);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleLogout = async () => {
    Alert.alert(t('profile.logout'), `${t('profile.logout')}?`, [
      { text: t('auth.back'), style: 'cancel' },
      {
        text: t('profile.logout'), style: 'destructive', onPress: async () => {
          await logoutUser();
          setUser(null);
          router.replace('/auth/login');
        },
      },
    ]);
  };

  const handlePickFromGallery = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        t('auth.photoPermission'),
        t('auth.photoPermissionMsg'),
        [{ text: t('auth.understood') }]
      );
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (!result.canceled) {
        const photoURL = await uploadProfilePhoto(user.uid, result.assets[0].uri);
        updateUser({ photoURL });
      }
    } catch {
      Alert.alert('Error', t('auth.loginFailed'));
    }
  };

  const handleSelectPremiumAvatar = async (avatarId: string) => {
    if (!user || savingAvatar) return;
    if (!user.inventory?.avatar_premium) {
      router.push('/(tabs)/tienda');
      return;
    }
    setSavingAvatar(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        avatar: avatarId,
        photoURL: null,
      });
      updateUser({ avatar: avatarId, photoURL: null });
      setAvatarModalVisible(false);
    } catch {
      Alert.alert('Error', t('profile.avatarUpdateError'));
    } finally {
      setSavingAvatar(false);
    }
  };

  const handleOpenPremiumAvatars = () => {
    if (!user) return;
    if (!user.inventory?.avatar_premium) {
      Alert.alert(
        t('profile.premiumLockedTitle'),
        t('profile.premiumLockedMsg'),
        [
          { text: t('profile.cancel'), style: 'cancel' },
          { text: t('profile.goToStore'), onPress: () => router.push('/(tabs)/tienda') },
        ]
      );
      return;
    }
    setAvatarModalVisible(true);
  };

  const handleChangePhoto = () => {
    Alert.alert(
      t('profile.photoOptionsTitle'),
      t('profile.photoOptionsMsg'),
      [
        { text: t('profile.premiumAvatarsOption'), onPress: handleOpenPremiumAvatars },
        { text: t('profile.galleryOption'), onPress: handlePickFromGallery },
        { text: t('profile.cancel'), style: 'cancel' },
      ]
    );
  };

  const handleNamePress = () => {
    if (!user) return;
    const nameChanges = user.inventory?.name_change || 0;
    if (nameChanges <= 0) {
      router.push('/(tabs)/tienda');
      return;
    }
    setNewName(user.username);
    setNameModalVisible(true);
  };

  const handleSaveName = async () => {
    if (!user || !newName.trim() || newName.trim() === user.username) {
      setNameModalVisible(false);
      return;
    }
    if (newName.trim().length < 3) {
      Alert.alert('Error', t('auth.usernameTooShort'));
      return;
    }
    setSavingName(true);
    try {
      const trimmed = newName.trim();
      const nameChanges = user.inventory?.name_change || 0;
      await updateDoc(doc(db, 'users', user.uid), {
        username: trimmed,
        'inventory.name_change': Math.max(0, nameChanges - 1),
      });
      updateUser({
        username: trimmed,
        inventory: { ...user.inventory, name_change: Math.max(0, nameChanges - 1) },
      });
      setNameModalVisible(false);
    } catch {
      Alert.alert('Error', t('profile.nameChangeError'));
    } finally {
      setSavingName(false);
    }
  };

  const handleSetFrame = async (frameId: string | null) => {
    if (!user) return;
    // Requiere haber comprado profile_frame (cualquier truthy) para usar marcos no-nulos
    if (frameId !== null && !user.inventory?.profile_frame) {
      router.push('/(tabs)/tienda');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), { 'inventory.active_frame': frameId });
      updateUser({ inventory: { ...user.inventory, active_frame: frameId } as any });
    } catch { /* ignorar */ }
  };

  const handleSetTheme = async (themeId: string | null) => {
    if (!user) return;
    if (themeId !== null && !user.inventory?.board_theme) {
      router.push('/(tabs)/tienda');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), { 'inventory.active_theme': themeId });
      updateUser({ inventory: { ...user.inventory, active_theme: themeId } as any });
    } catch { /* ignorar */ }
  };

  const handleSetNameColor = async (colorId: string | null) => {
    if (!user) return;
    if (colorId !== null && !user.inventory?.name_color) {
      router.push('/(tabs)/tienda');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', user.uid), { 'inventory.active_name_color': colorId });
      updateUser({ inventory: { ...user.inventory, active_name_color: colorId } as any });
    } catch { /* ignorar */ }
  };

  if (!user) return null;

  const rankInfo = getRankInfo(user.rank);
  const avatarSource = user.photoURL
    ? { uri: user.photoURL }
    : AVATARS[user.avatar] || AVATARS['avatar_1'];

  const winRate = user.gamesPlayed > 0
    ? Math.round((user.wins / user.gamesPlayed) * 100)
    : 0;

  // Calcular progreso hacia el siguiente rango
  const currentRankIndex = RANKS.findIndex((r) => r.name === user.rank);
  const nextRank = currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;
  const currentRankData = RANKS[currentRankIndex];
  const progressPct = nextRank
    ? Math.min(1, Math.max(0, (user.points - currentRankData.min) / (nextRank.min - currentRankData.min)))
    : 1;

  const nameChanges = user.inventory?.name_change || 0;
  const inv = user.inventory || {};
  const activeFrame = (inv as any).active_frame ?? null;
  const activeTheme = (inv as any).active_theme ?? null;
  const activeNameColor = (inv as any).active_name_color ?? null;

  // Color del nombre activo
  const nameColor = NAME_COLOR_OPTIONS.find(c => c.id === activeNameColor)?.color || COLORS.text;

  // Marco activo
  const frameColor = FRAME_OPTIONS.find(f => f.id === activeFrame)?.color || rankInfo.color;

  // XP progress (Fase 2A)
  const userXP = user.xp || 0;
  const userLevel = user.level || 1;
  const currentLevelData = LEVEL_TABLE[userLevel - 1];
  const nextLevelData = userLevel < LEVEL_TABLE.length ? LEVEL_TABLE[userLevel] : null;
  const xpForCurrentLevel = currentLevelData?.xpRequired ?? 0;
  const xpForNextLevel = nextLevelData?.xpRequired ?? userXP;
  const xpProgressPct = nextLevelData
    ? Math.min(1, (userXP - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel))
    : 1;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Fondo decorativo del hero */}
      <View style={[styles.heroBg, { backgroundColor: rankInfo.color + '12' }]} />

      {/* Avatar */}
      <TouchableOpacity onPress={handleChangePhoto} style={styles.avatarContainer}>
        <View style={[styles.avatarRing, { borderColor: frameColor }]}>
          <Image source={avatarSource} style={styles.avatar} />
        </View>
        <View style={styles.editBadge}>
          <Text style={styles.editBadgeText}>📷</Text>
        </View>
      </TouchableOpacity>

      {/* Nombre y rango */}
      <TouchableOpacity onPress={handleNamePress} style={styles.nameTouchable}>
        <Text style={[styles.username, { color: nameColor }]}>{user.username}</Text>
        {nameChanges > 0 && (
          <Text style={styles.nameEditHint}>{t('profile.changeCount', { count: nameChanges })}</Text>
        )}
      </TouchableOpacity>
      <View style={styles.rankPill}>
        <Text style={styles.rankPillIcon}>{rankInfo.icon}</Text>
        <Text style={[styles.rankPillText, { color: rankInfo.color }]}>{getTranslatedRankName(user.rank)}</Text>
      </View>

      {/* Progreso de rango */}
      {nextRank && (
        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>{rankInfo.icon} {getTranslatedRankName(user.rank)}</Text>
            <Text style={styles.progressPoints}>{user.points} / {nextRank.min} pts</Text>
            <Text style={styles.progressLabel}>{nextRank.icon} {nextRank.name}</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[
              styles.progressFill,
              { width: `${progressPct * 100}%`, backgroundColor: rankInfo.color },
            ]} />
          </View>
        </View>
      )}

      {/* Barra XP + Nivel (Fase 2A) */}
      <View style={styles.xpSection}>
        <View style={styles.xpLabelRow}>
          <Text style={styles.xpLevelBadge}>{t('profile.level', { level: userLevel })}</Text>
          <Text style={styles.xpValue}>{userXP} XP</Text>
          {nextLevelData && (
            <Text style={styles.xpNext}>{t('profile.nextLevel', { level: userLevel + 1, xp: xpForNextLevel })}</Text>
          )}
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${xpProgressPct * 100}%`, backgroundColor: COLORS.purple }]} />
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{user.points}</Text>
          <Text style={styles.statLabel}>{t('profile.points').toUpperCase()}</Text>
        </View>
        <View style={styles.statBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#FFD700', fontSize: 22, marginRight: 4 }}>💎</Text>
            <Text style={[styles.statValue, { color: COLORS.accent }]}>{user.gems}</Text>
          </View>
          <Text style={styles.statLabel}>{t('profile.gems').toUpperCase()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.success }]}>{user.wins}</Text>
          <Text style={styles.statLabel}>{t('profile.wins').toUpperCase()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.danger }]}>{user.losses}</Text>
          <Text style={styles.statLabel}>{t('profile.losses').toUpperCase()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{user.gamesPlayed}</Text>
          <Text style={styles.statLabel}>{t('profile.played').toUpperCase()}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{winRate}%</Text>
          <Text style={styles.statLabel}>{t('profile.winRate')}</Text>
        </View>
      </View>

      {/* Ventajas activas */}
      {(inv.point_shield || inv.streak_shield || inv.double_xp) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitleText}>{t('profile.activeAdvantages')}</Text>
          <View style={styles.advantagesRow}>
            {inv.point_shield && (
              <View style={styles.advantageBadge}>
                <Text style={styles.advantageIcon}>🛡️</Text>
                <Text style={styles.advantageLabel}>{t('profile.pointShield')}</Text>
              </View>
            )}
            {inv.streak_shield && (
              <View style={styles.advantageBadge}>
                <Text style={styles.advantageIcon}>🔥</Text>
                <Text style={styles.advantageLabel}>{t('profile.streakShield')}</Text>
              </View>
            )}
            {inv.double_xp && (
              <View style={styles.advantageBadge}>
                <Text style={styles.advantageIcon}>⭐</Text>
                <Text style={styles.advantageLabel}>{t('profile.doubleXP', { remaining: inv.double_xp_remaining ?? 3 })}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      <AdBanner placement="profile" style={{ marginBottom: 8 }} />

      {/* Inventario de comodines */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleText}>{t('profile.wildcards')}</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/tienda')}>
            <Text style={styles.sectionAction}>{t('profile.buyMore')}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.wildcardsGrid}>
          {WILDCARDS.map((w) => {
            const normalized = normalizeWildcards((user as any).wildcards);
            const count = normalized[w.id] ?? 0;
            return (
              <View key={w.id} style={[styles.wildcardItem, count === 0 && styles.wildcardItemEmpty]}>
                <Text style={styles.wildcardIcon}>{w.icon}</Text>
                <Text style={[styles.wildcardCount, { color: count > 0 ? w.color : COLORS.textMuted }]}>
                  x{count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Personalización */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleText}>{t('profile.personalization')}</Text>

        {/* Marco de avatar */}
        <Text style={styles.subSectionLabel}>{t('profile.avatarFrame')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
          {FRAME_OPTIONS.map((f) => {
            const owned = f.id === null || !!inv.profile_frame;
            const active = activeFrame === f.id;
            return (
              <TouchableOpacity
                key={String(f.id)}
                style={[
                  styles.optionChip,
                  { borderColor: f.color },
                  active && { backgroundColor: f.color + '30' },
                  !owned && styles.optionChipLocked,
                ]}
                onPress={() => {
                  if (!owned) { router.push('/(tabs)/tienda'); return; }
                  handleSetFrame(f.id);
                }}
              >
                <Text style={[styles.optionLabel, !owned && styles.optionLabelLocked]}>
                  {f.label}{!owned ? ' 🔒' : ''}
                </Text>
                {active && <Text style={styles.activeIndicator}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tema de tablero */}
        <Text style={styles.subSectionLabel}>{t('profile.boardTheme')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
          {THEME_OPTIONS.map((th) => {
            const owned = th.id === null || !!inv.board_theme;
            const active = activeTheme === th.id;
            return (
              <TouchableOpacity
                key={String(th.id)}
                style={[
                  styles.optionChip,
                  { borderColor: th.color },
                  active && { backgroundColor: th.color + '30' },
                  !owned && styles.optionChipLocked,
                ]}
                onPress={() => {
                  if (!owned) { router.push('/(tabs)/tienda'); return; }
                  handleSetTheme(th.id);
                }}
              >
                <Text style={[styles.optionLabel, !owned && styles.optionLabelLocked]}>
                  {th.label}{!owned ? ' 🔒' : ''}
                </Text>
                {active && <Text style={styles.activeIndicator}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Color de nombre */}
        <Text style={styles.subSectionLabel}>{t('profile.nameColor')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.optionsRow}>
          {NAME_COLOR_OPTIONS.map((nc) => {
            const owned = nc.id === null || !!inv.name_color;
            const active = activeNameColor === nc.id;
            return (
              <TouchableOpacity
                key={String(nc.id)}
                style={[
                  styles.optionChip,
                  { borderColor: nc.color },
                  active && { backgroundColor: nc.color + '30' },
                  !owned && styles.optionChipLocked,
                ]}
                onPress={() => {
                  if (!owned) { router.push('/(tabs)/tienda'); return; }
                  handleSetNameColor(nc.id);
                }}
              >
                <Text style={[styles.optionLabel, { color: nc.color }, !owned && styles.optionLabelLocked]}>
                  {nc.label}{!owned ? ' 🔒' : ''}
                </Text>
                {active && <Text style={[styles.activeIndicator, { color: nc.color }]}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Logros / Achievements (Fase 2B) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleText}>
          {t('profile.achievements', { unlocked: unlockedAchievements.length, total: ACHIEVEMENTS.length })}
        </Text>
        <View style={styles.achievementsGrid}>
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = unlockedAchievements.includes(ach.id);
            return (
              <View
                key={ach.id}
                style={[styles.achievementItem, !unlocked && styles.achievementLocked]}
              >
                <Text style={styles.achievementIcon}>{ach.icon}</Text>
                <Text style={[styles.achievementLabel, !unlocked && styles.achievementLabelLocked]}>
                  {t(`achievements.${ach.id}`, { defaultValue: ach.label })}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Historial */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitleText}>{t('profile.history').toUpperCase()}</Text>
          <Text style={styles.sectionCount}>{history.length} {t('profile.played').toLowerCase()}</Text>
        </View>

        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Text style={styles.emptyHistoryEmoji}>-</Text>
            <Text style={styles.emptyHistoryText}>{t('ranking.empty')}</Text>
          </View>
        ) : (
          history.map((item) => (
            <View
              key={item.gameId}
              style={[styles.historyItem, item.result === 'win' ? styles.winItem : styles.lossItem]}
            >
              <View style={[styles.resultBadge, item.result === 'win' ? styles.winBadge : styles.lossBadge]}>
                <Text style={styles.resultBadgeText}>
                  {item.result === 'win' ? t('profile.win') : t('profile.loss')}
                </Text>
              </View>
              <View style={styles.historyInfo}>
                <Text style={styles.historyOpponent}>{t('profile.vs')} {item.opponentUsername}</Text>
                <Text style={styles.historyScore}>{item.score}</Text>
              </View>
              <Text style={styles.historyTypeIcon}>
                {item.type === 'global' ? '🌍' : item.type === 'tournament' ? '🏆' : '📍'}
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Toggle Modo Oscuro / Claro */}
      <View style={styles.section}>
        <Text style={styles.sectionTitleText}>APARIENCIA</Text>
        <TouchableOpacity
          style={[styles.themeToggleRow]}
          onPress={toggleTheme}
          activeOpacity={0.8}
        >
          <Text style={styles.themeToggleIcon}>{isDark ? '' : ''}</Text>
          <View style={styles.themeToggleInfo}>
            <Text style={styles.themeToggleLabel}>
              {isDark ? 'Modo Oscuro' : 'Modo Claro'}
            </Text>
            <Text style={styles.themeToggleDesc}>
              Toca para cambiar a modo {isDark ? 'claro' : 'oscuro'}
            </Text>
          </View>
          <View style={[styles.themeToggleSwitch, isDark ? styles.themeToggleSwitchOn : styles.themeToggleSwitchOff]}>
            <View style={[styles.themeToggleKnob, isDark ? styles.themeToggleKnobOn : styles.themeToggleKnobOff]} />
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>{t('profile.logout')}</Text>
      </TouchableOpacity>

      {/* Modal de cambio de nombre */}
      <Modal
        visible={avatarModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAvatarModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.avatarModalBox}>
            <Text style={styles.modalTitle}>{t('profile.selectPremiumAvatar')}</Text>
            <Text style={styles.modalSubtitle}>{t('shop.avatarPremiumDesc')}</Text>
            <AvatarPicker
              selected={user.avatar || 'avatar_1'}
              onSelect={handleSelectPremiumAvatar}
            />
            <View style={styles.avatarModalActions}>
              <TouchableOpacity
                style={styles.avatarModalClose}
                onPress={() => setAvatarModalVisible(false)}
                disabled={savingAvatar}
              >
                <Text style={styles.avatarModalCloseText}>
                  {savingAvatar ? t('profile.saving') : t('profile.cancel')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('profile.changeName')}</Text>
            <Text style={styles.modalSubtitle}>
              {t('profile.nameChangesAvailable', { count: nameChanges })}
            </Text>
            <TextInput
              style={styles.nameInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('profile.newNamePlaceholder')}
              placeholderTextColor={COLORS.textMuted}
              maxLength={20}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setNameModalVisible(false)}
                disabled={savingName}
              >
                <Text style={styles.modalBtnTextCancel}>{t('profile.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleSaveName}
                disabled={savingName || !newName.trim()}
              >
                <Text style={styles.modalBtnTextConfirm}>
                  {savingName ? t('profile.saving') : t('profile.save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
