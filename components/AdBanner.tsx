/**
 * components/AdBanner.tsx
 * Banner publicitario de AdMob para todas las pantallas.
 * En modo test usa el ID oficial de Google para pruebas.
 * Cuando el usuario proporcione su ID real, reemplazar BANNER_AD_UNIT_ID.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// ── IDs de anuncios ────────────────────────────────────────────────────────────
// TEST: usa los IDs oficiales de Google para pruebas (no genera dinero real)
// PRODUCCIÓN: reemplaza con tus IDs reales de AdMob
// En esta version se usa SIEMPRE ID de prueba para evitar crashes por IDs invalidos.
// Cuando compartas IDs reales, los cambiamos aqui.
const BANNER_AD_UNIT_ID = TestIds.BANNER;

interface AdBannerProps {
  size?: BannerAdSize;
  style?: object;
}

export default function AdBanner({ size = BannerAdSize.BANNER, style }: AdBannerProps) {
  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: false,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
});
