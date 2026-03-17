/**
 * components/AdBanner.tsx
 * Banner publicitario de AdMob para todas las pantallas.
 * En modo test usa el ID oficial de Google para pruebas.
 * Cuando el usuario proporcione su ID real, reemplazar BANNER_AD_UNIT_ID.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

type BannerPlacement =
  | 'home'
  | 'losers'
  | 'profile'
  | 'shop'
  | 'tournaments'
  | 'training'
  | 'winners';

const BANNER_IDS: Record<BannerPlacement, string> = {
  home: 'ca-app-pub-9019813013540172/9580298199',
  losers: 'ca-app-pub-9019813013540172/6678802682',
  profile: 'ca-app-pub-9019813013540172/2717209664',
  shop: 'ca-app-pub-9019813013540172/3718465992',
  tournaments: 'ca-app-pub-9019813013540172/4528984786',
  training: 'ca-app-pub-9019813013540172/4030291331',
  winners: 'ca-app-pub-9019813013540172/8267216521',
};

interface AdBannerProps {
  size?: BannerAdSize;
  style?: object;
  placement?: BannerPlacement;
}

export default function AdBanner({ size = BannerAdSize.BANNER, style, placement = 'home' }: AdBannerProps) {
  const unitId = __DEV__ ? TestIds.BANNER : BANNER_IDS[placement];

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={unitId}
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
