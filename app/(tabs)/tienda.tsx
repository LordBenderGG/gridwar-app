import React, { useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc, increment, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import { WildcardInventory } from '../../services/auth';
import { playSound } from '../../services/sound';
import { addCreatorRoyaltySafe } from '../../services/creator';
import AdBanner from '../../components/AdBanner';
import RewardedAdButton from '../../components/RewardedAdButton';
import '../../i18n';

// ─── Definición de items ──────────────────────────────────────────────────────

interface ShopItem {
  id: string;
  nameKey: string;
  descKey: string;
  cost: number;
  icon: string;
  limitKey?: string;
  dailyLimit?: number;
  oneTime?: boolean;
}

const PERSONALIZATION_ITEMS: ShopItem[] = [
  { id: 'avatar_premium', nameKey: 'shop.avatarPremium', descKey: 'shop.avatarPremiumDesc', cost: 12, icon: '🎭' },
  { id: 'profile_frame', nameKey: 'shop.profileFrame', descKey: 'shop.profileFrameDesc', cost: 8, icon: '🖼️' },
  { id: 'board_theme', nameKey: 'shop.boardTheme', descKey: 'shop.boardThemeDesc', cost: 10, icon: '🎨' },
  { id: 'name_color', nameKey: 'shop.nameColor', descKey: 'shop.nameColorDesc', cost: 5, icon: '✨' },
];

const WILDCARD_PACK_ITEM: ShopItem = {
  id: 'wildcard_pack_full',
  nameKey: 'shop.wildcardPackFull',
  descKey: 'shop.wildcardPackFullDesc',
  cost: 100,
  icon: '🎁',
  oneTime: true,
};

const INDIVIDUAL_WILDCARDS: ShopItem[] = [
  { id: 'wc_turbo',       nameKey: 'shop.wcTurbo',       descKey: 'shop.wcTurboDesc',       cost: 20, icon: '⚡' },
  { id: 'wc_time_reduce', nameKey: 'shop.wcTimeReduce',  descKey: 'shop.wcTimeReduceDesc',  cost: 20, icon: '⏱️' },
  { id: 'wc_teleport',    nameKey: 'shop.wcTeleport',    descKey: 'shop.wcTeleportDesc',    cost: 20, icon: '🌀' },
  { id: 'wc_shield',      nameKey: 'shop.wcShield',      descKey: 'shop.wcShieldDesc',      cost: 20, icon: '🛡️' },
  { id: 'wc_confusion',   nameKey: 'shop.wcConfusion',   descKey: 'shop.wcConfusionDesc',   cost: 20, icon: '😵' },
  { id: 'wc_sabotage',    nameKey: 'shop.wcSabotage',    descKey: 'shop.wcSabotageDesc',    cost: 20, icon: '💣' },
  { id: 'wc_freeze',      nameKey: 'shop.wcFreeze',      descKey: 'shop.wcFreezeDesc',      cost: 20, icon: '❄️' },
  { id: 'wc_earthquake',  nameKey: 'shop.wcEarthquake',  descKey: 'shop.wcEarthquakeDesc',  cost: 20, icon: '💥' },
];

const WC_ITEM_TO_KEY: Record<string, keyof WildcardInventory> = {
  wc_turbo:       'turbo',
  wc_time_reduce: 'time_reduce',
  wc_teleport:    'teleport',
  wc_shield:      'shield',
  wc_confusion:   'confusion',
  wc_sabotage:    'sabotage',
  wc_freeze:      'freeze',
  wc_earthquake:  'earthquake',
};

const POWERUP_ITEMS: ShopItem[] = [
  { id: 'unlock_block', nameKey: 'shop.unlockBlock', descKey: 'shop.unlockBlockDesc', cost: 40, icon: '🔓' },
  { id: 'point_shield', nameKey: 'shop.pointShield', descKey: 'shop.pointShieldDesc', cost: 35, icon: '🛡️' },
  { id: 'streak_shield', nameKey: 'shop.streakShield', descKey: 'shop.streakShieldDesc', cost: 30, icon: '🔥' },
  { id: 'double_xp', nameKey: 'shop.doubleXP', descKey: 'shop.doubleXPDesc', cost: 35, icon: '⚡' },
];

const EXTRAS_ITEMS: ShopItem[] = [
  { id: 'name_change', nameKey: 'shop.nameChange', descKey: 'shop.nameChangeDesc', cost: 10, icon: '📝' },
  { id: 'history_extended', nameKey: 'shop.historyExtended', descKey: 'shop.historyExtendedDesc', cost: 3, icon: '📜' },
];

const TOURNAMENT_PASS_ITEM: ShopItem = {
  id: 'tournament_pass',
  nameKey: 'shop.tournamentPass',
  descKey: 'shop.tournamentPassDesc',
  cost: 80,
  icon: '🏟️',
};

// ─── Componente de item ────────────────────────────────────────────────────────

interface ItemCardProps {
  item: ShopItem;
  gems: number;
  onBuy: (item: ShopItem) => Promise<void>;
  buying: string | null;
  owned?: boolean;
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { paddingTop: 50, paddingHorizontal: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  titleText: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 6,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  gemsBadge: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  gemsText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  catTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginTop: 20,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  itemCardDisabled: {
    opacity: 0.55,
  },
  itemIcon: { fontSize: 28, width: 36, textAlign: 'center' },
  itemInfo: { flex: 1 },
  itemName: { color: COLORS.text, fontWeight: 'bold', fontSize: 14, marginBottom: 2 },
  itemNameDisabled: { color: COLORS.textSecondary },
  itemDesc: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 15 },
  itemLimit: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  itemOwned: { color: COLORS.success, fontSize: 10, marginTop: 2, fontWeight: 'bold' },
  buyBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  buyBtnDisabled: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  buyBtnCost: { color: COLORS.background, fontSize: 12, fontWeight: 'bold' },
  buyBtnLabel: { color: COLORS.background, fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5, marginTop: 1 },
  buyBtnLabelDisabled: { color: COLORS.textMuted },
  // ── Modal de confirmación ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  modalBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    maxWidth: 340,
  },
  modalIcon: { fontSize: 40, marginBottom: 10 },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalMsg: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalBtnCancel: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalBtnConfirm: {
    backgroundColor: COLORS.primary,
  },
  modalBtnCancelLabel: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 14 },
  modalBtnConfirmLabel: { color: COLORS.background, fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
});

const ItemCard: React.FC<ItemCardProps> = ({ item, gems, onBuy, buying, owned }) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const canAfford = gems >= item.cost;
  const isLoading = buying === item.id;
  const isDisabled = owned || !canAfford || isLoading;

  return (
    <View style={[styles.itemCard, isDisabled && !isLoading && styles.itemCardDisabled]}>
      <Text style={styles.itemIcon}>{item.icon}</Text>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemName, isDisabled && !isLoading && styles.itemNameDisabled]}>
          {t(item.nameKey)}
        </Text>
        <Text style={styles.itemDesc}>{t(item.descKey)}</Text>
        {item.limitKey && (
          <Text style={styles.itemLimit}>{t(item.limitKey)}</Text>
        )}
        {owned && (
          <Text style={styles.itemOwned}>{t('shop.alreadyOwned')}</Text>
        )}
      </View>
      <TouchableOpacity
        style={[styles.buyBtn, isDisabled && styles.buyBtnDisabled]}
        onPress={() => onBuy(item)}
        disabled={isDisabled}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.background} />
        ) : owned ? (
          <Text style={[styles.buyBtnLabel, styles.buyBtnLabelDisabled]}>✓</Text>
        ) : (
          <>
            <Text style={styles.buyBtnCost}>💎 {item.cost}</Text>
            <Text style={[styles.buyBtnLabel, !canAfford && styles.buyBtnLabelDisabled]}>
              {t('shop.buyBtn')}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ─── Pantalla principal ────────────────────────────────────────────────────────

export default function TiendaScreen() {
  const { t } = useTranslation();
  const { user, updateUser } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [buying, setBuying] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<ShopItem | null>(null);

  // ─── Validaciones pre-compra (sin descontar gemas) ────────────────────────
  const requestBuy = async (item: ShopItem) => {
    if (!user) return;
    if (user.gems < item.cost) {
      Alert.alert(t('shop.notEnoughGems'), t('shop.notEnoughGemsMsg'));
      return;
    }
    if (item.oneTime) {
      const inv = user.inventory as any || {};
      if (inv[item.id]) {
        Alert.alert(t('shop.limitReached'), t('shop.wildcardPackFullOwned'));
        return;
      }
    }
    if (item.dailyLimit) {
      const today = new Date().toISOString().split('T')[0];
      const purchaseRef = doc(db, 'users', user.uid, 'dailyPurchases', `${item.id}_${today}`);
      const purchaseSnap = await getDoc(purchaseRef);
      const count = purchaseSnap.exists() ? (purchaseSnap.data().count || 0) : 0;
      if (count >= item.dailyLimit) {
        Alert.alert(t('shop.limitReached'), t('shop.limitReachedMsg', { item: t(item.nameKey) }));
        return;
      }
    }
    // Mostrar modal de confirmación
    setConfirmItem(item);
  };

  // ─── Ejecución real de la compra (tras confirmación) ──────────────────────
  const handleBuy = async (item: ShopItem) => {
    if (!user) return;
    setBuying(item.id);
    try {
      const userRef = doc(db, 'users', user.uid);

      if (item.id === 'wildcard_pack_full') {
        const updates: Record<string, any> = {
          gems: increment(-item.cost),
          'inventory.wildcard_pack_full': true,
        };
        const wildcardIds: (keyof WildcardInventory)[] = [
          'turbo', 'time_reduce', 'teleport', 'shield', 'confusion', 'sabotage', 'freeze', 'earthquake',
        ];
        wildcardIds.forEach((id) => {
          updates[`wildcards.${id}`] = increment(2);
        });
        await updateDoc(userRef, updates);

        const newWildcards = { ...user.wildcards };
        wildcardIds.forEach((id) => {
          (newWildcards as Record<string, number>)[id] = ((newWildcards as Record<string, number>)[id] || 0) + 2;
        });
        updateUser({
          gems: user.gems - item.cost,
          wildcards: newWildcards,
          inventory: { ...user.inventory, wildcard_pack_full: true } as any,
        });

      } else if (WC_ITEM_TO_KEY[item.id]) {
        const wcKey = WC_ITEM_TO_KEY[item.id];
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          [`wildcards.${wcKey}`]: increment(1),
        });
        const newWildcards = { ...user.wildcards };
        (newWildcards as Record<string, number>)[wcKey] = ((newWildcards as Record<string, number>)[wcKey] || 0) + 1;
        updateUser({ gems: user.gems - item.cost, wildcards: newWildcards });

      } else if (item.id === 'unlock_block') {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          challengeBlockedUntil: 0,
        });
        updateUser({ gems: user.gems - item.cost, challengeBlockedUntil: 0 });

      } else if (item.id === 'double_xp') {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          'inventory.double_xp': true,
          'inventory.double_xp_remaining': 3,
        });
        updateUser({
          gems: user.gems - item.cost,
          inventory: { ...user.inventory, double_xp: true, double_xp_remaining: 3 },
        });

      } else if (item.id === 'point_shield') {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          'inventory.point_shield': true,
        });
        updateUser({
          gems: user.gems - item.cost,
          inventory: { ...user.inventory, point_shield: true },
        });

      } else if (item.id === 'streak_shield') {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          'inventory.streak_shield': true,
        });
        updateUser({
          gems: user.gems - item.cost,
          inventory: { ...user.inventory, streak_shield: true },
        });

      } else if (item.id === 'tournament_pass') {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          'inventory.tournament_pass': increment(1),
        });
        const prev = (user.inventory as any)?.tournament_pass || 0;
        updateUser({
          gems: user.gems - item.cost,
          inventory: { ...user.inventory, tournament_pass: prev + 1 },
        });

      } else if (item.id === 'name_change') {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          'inventory.name_change': increment(1),
        });
        const prev = user.inventory?.name_change || 0;
        updateUser({
          gems: user.gems - item.cost,
          inventory: { ...user.inventory, name_change: prev + 1 },
        });

      } else {
        await updateDoc(userRef, {
          gems: increment(-item.cost),
          [`inventory.${item.id}`]: true,
        });
        updateUser({
          gems: user.gems - item.cost,
          inventory: { ...user.inventory, [item.id]: true },
        });
      }

      // Contabilizar compra para el logro shop_addict (10 compras)
      await updateDoc(userRef, { shopPurchasesTotal: increment(1) }).catch(() => {});

      // Royalty del creador: 2% del costo de la compra (silencioso)
      addCreatorRoyaltySafe(item.cost, { source: 'shop_purchase', eventId: `${user.uid}:${item.id}:${Date.now()}` }).catch(() => {});

      playSound('purchase');
    } catch (e) {
      Alert.alert('Error', t('shop.purchaseError'));
    } finally {
      setBuying(null);
    }
  };

  const [localGems, setLocalGems] = useState<number | null>(null);
  const gems = localGems ?? user?.gems ?? 0;
  const inv = (user?.inventory as any) || {};

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.titleText}>{t('shop.title')}</Text>
          <View style={styles.gemsBadge}>
            <Text style={styles.gemsText}>{t('shop.gems', { count: gems })}</Text>
          </View>
        </View>

        <AdBanner style={{ marginBottom: 8 }} />

        <Text style={styles.catTitle}>{t('shop.catPersonalization')}</Text>
        {PERSONALIZATION_ITEMS.map((item) => (
          <ItemCard key={item.id} item={item} gems={gems} onBuy={requestBuy} buying={buying} />
        ))}

        <Text style={styles.catTitle}>{t('shop.catWildcards')}</Text>
        <ItemCard
          item={WILDCARD_PACK_ITEM}
          gems={gems}
          onBuy={requestBuy}
          buying={buying}
          owned={!!inv.wildcard_pack_full}
        />
        {INDIVIDUAL_WILDCARDS.map((item) => (
          <ItemCard key={item.id} item={item} gems={gems} onBuy={requestBuy} buying={buying} />
        ))}

        <Text style={styles.catTitle}>{t('shop.catPowerups')}</Text>
        {POWERUP_ITEMS.map((item) => (
          <ItemCard key={item.id} item={item} gems={gems} onBuy={requestBuy} buying={buying} />
        ))}

        <Text style={styles.catTitle}>{t('shop.catTournament')}</Text>
        <ItemCard
          item={TOURNAMENT_PASS_ITEM}
          gems={gems}
          onBuy={requestBuy}
          buying={buying}
        />

        <Text style={styles.catTitle}>{t('shop.catExtras')}</Text>
        {EXTRAS_ITEMS.map((item) => (
          <ItemCard key={item.id} item={item} gems={gems} onBuy={requestBuy} buying={buying} />
        ))}

        <Text style={styles.catTitle}>VIDEOS</Text>
        <RewardedAdButton
          label="▶ Ver video y ganar 15 💎 GRATIS"
          onRewarded={() => {
            const newGems = gems + 15;
            setLocalGems(newGems);
            if (user) updateUser({ gems: newGems });
          }}
        />
      </ScrollView>

      {/* ─── Modal de confirmación de compra ─────────────────────────────── */}
      <Modal
        visible={confirmItem !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalIcon}>{confirmItem?.icon}</Text>
            <Text style={styles.modalTitle}>{t('shop.confirmTitle')}</Text>
            <Text style={styles.modalMsg}>
              {t('shop.confirmMsg', {
                item: confirmItem ? t(confirmItem.nameKey) : '',
                cost: confirmItem?.cost ?? 0,
              })}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setConfirmItem(null)}
              >
                <Text style={styles.modalBtnCancelLabel}>{t('shop.confirmNo')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={() => {
                  const item = confirmItem!;
                  setConfirmItem(null);
                  handleBuy(item);
                }}
              >
                <Text style={styles.modalBtnConfirmLabel}>{t('shop.confirmYes')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
