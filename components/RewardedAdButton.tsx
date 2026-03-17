/**
 * components/RewardedAdButton.tsx
 * Botón que muestra un video recompensado de AdMob para ganar gemas.
 * Recompensa configurable (default: 10 gemas por video).
 *
 * Uso:
 *   <RewardedAdButton onRewarded={(gems) => addGemsToUser(gems)} />
 */

import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity, Text, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { RewardedAd, RewardedAdEventType, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useAuthStore } from '../store/authStore';
import { useColors } from '../hooks/useColors';
import { addCreatorRoyaltySafe } from '../services/creator';

const REWARDED_MAIN_ID = 'ca-app-pub-9019813013540172/4052639348';
const REWARDED_BACKUP_ID = 'ca-app-pub-9019813013540172/6954134858';

const GEM_REWARD = 10; // gemas por ver un video completo

interface RewardedAdButtonProps {
  label?: string;
  gemAmount?: number;
  onRewarded?: (gems: number) => void;
}

export default function RewardedAdButton({
  label,
  gemAmount = GEM_REWARD,
  onRewarded,
}: RewardedAdButtonProps) {
  const COLORS = useColors();
  const { user, updateUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [adReady, setAdReady] = useState(false);
  const [rewarded, setRewarded] = useState<RewardedAd | null>(null);
  const [activeUnitId, setActiveUnitId] = useState<string>(
    __DEV__ ? TestIds.REWARDED : REWARDED_MAIN_ID
  );

  useEffect(() => {
    loadAd(activeUnitId);
  }, [activeUnitId]);

  const loadAd = (unitId: string) => {
    setAdReady(false);
    const ad = RewardedAd.createForAdRequest(unitId, {
      requestNonPersonalizedAdsOnly: false,
    });

    ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
      setRewarded(ad);
      setAdReady(true);
    });

    ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
      handleReward();
    });

    ad.addAdEventListener(AdEventType.CLOSED, () => {
      // Recargar para siguiente uso
      loadAd(activeUnitId);
    });

    ad.addAdEventListener(AdEventType.ERROR, () => {
      if (!__DEV__ && unitId === REWARDED_MAIN_ID) {
        setActiveUnitId(REWARDED_BACKUP_ID);
      }
    });

    ad.load();
  };

  const handleReward = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        gems: increment(gemAmount),
      });
      updateUser({ gems: (user.gems || 0) + gemAmount });
      addCreatorRoyaltySafe(gemAmount, { source: 'rewarded_ad' }).catch(() => {});
      onRewarded?.(gemAmount);
    } catch {
      // silencioso
    }
  };

  const handlePress = async () => {
    if (!adReady || !rewarded) {
      Alert.alert('Video no disponible', 'Intenta de nuevo en unos segundos.');
      return;
    }
    setLoading(true);
    try {
      await rewarded.show();
    } catch {
      Alert.alert('Error', 'No se pudo mostrar el anuncio.');
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: adReady ? COLORS.success : COLORS.surface,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 20,
      gap: 8,
      borderWidth: 1,
      borderColor: adReady ? COLORS.success : COLORS.border,
      opacity: adReady ? 1 : 0.6,
    },
    text: {
      color: adReady ? '#fff' : COLORS.textMuted,
      fontWeight: 'bold',
      fontSize: 14,
    },
  });

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={handlePress}
      disabled={!adReady || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator size="small" color="#fff" />
      ) : (
        <Text style={styles.text}>
          {label ?? `▶ Ver video y ganar ${gemAmount} 💎`}
        </Text>
      )}
    </TouchableOpacity>
  );
}
