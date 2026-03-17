/**
 * Pantalla de Onboarding — aparece SOLO la primera vez que se instala la app.
 * Se guarda en AsyncStorage para no volver a mostrarla.
 *
 * Slides:
 * 1. Bienvenida a GRIDWAR
 * 2. Cómo se juega (reglas)
 * 3. Sistema de Rangos
 * 4. Salón de la Fama y la Vergüenza
 * 5. Comodines
 * 6. ¡A jugar!
 */
import React, { useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Animated as RNAnimated,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import '../i18n';
import { useColors } from '../hooks/useColors';
import { RANKS, getTranslatedRankName } from '../services/ranking';

const { width, height } = Dimensions.get('window');
export const ONBOARDING_KEY = 'gridwar_onboarding_done_v1';

interface Slide {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  content: string[];
  accentColor: string;
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingBottom: 30,
  },
  logo: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 6,
    textAlign: 'center',
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    marginBottom: 12,
  },
  flatList: { flex: 1 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  slideEmoji: {
    fontSize: 72,
    marginBottom: 12,
  },
  accentLine: {
    width: 48,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 6,
  },
  slideSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: 1,
  },
  contentBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    borderWidth: 1,
  },
  contentLine: {
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  contentText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    alignItems: 'center',
  },
  skipBtn: {
    padding: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  nextBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  nextText: {
    color: COLORS.background,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  slideCounter: {
    color: COLORS.border,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
  },
});

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

  const SLIDES: Slide[] = [
    {
      key: 'welcome',
      emoji: '⚔️',
      title: t('onboarding.welcomeTitle'),
      subtitle: t('onboarding.welcomeSubtitle'),
      content: [
        t('onboarding.welcomeContent1'),
        t('onboarding.welcomeContent2'),
        t('onboarding.welcomeContent3'),
      ],
      accentColor: COLORS.primary,
    },
    {
      key: 'rules',
      emoji: '🎯',
      title: t('onboarding.rulesTitle'),
      subtitle: t('onboarding.rulesSubtitle'),
      content: [
        t('onboarding.rulesContent1'),
        t('onboarding.rulesContent2'),
        t('onboarding.rulesContent3'),
        t('onboarding.rulesContent4'),
        t('onboarding.rulesContent5'),
      ],
      accentColor: COLORS.secondary,
    },
    {
      key: 'ranks',
      emoji: '👑',
      title: t('onboarding.ranksTitle'),
      subtitle: t('onboarding.ranksSubtitle'),
      content: RANKS.map((r) => `${r.icon} ${getTranslatedRankName(r.name)} — ${t('onboarding.ranksFrom')} ${r.min} ${t('onboarding.ranksPts')}`),
      accentColor: COLORS.warning,
    },
    {
      key: 'wildcards',
      emoji: '💎',
      title: t('onboarding.wildcardsTitle'),
      subtitle: t('onboarding.wildcardsSubtitle'),
      content: [
        t('onboarding.wildcardsContent1'),
        t('onboarding.wildcardsContent2'),
        t('onboarding.wildcardsContent3'),
        t('onboarding.wildcardsContent4'),
        t('onboarding.wildcardsContent5'),
        t('onboarding.wildcardsContent6'),
        t('onboarding.wildcardsContent7'),
        t('onboarding.wildcardsContent8'),
        t('onboarding.wildcardsContent9'),
      ],
      accentColor: COLORS.purple,
    },
    {
      key: 'fame',
      emoji: '🏆',
      title: t('onboarding.fameTitle'),
      subtitle: t('onboarding.fameSubtitle'),
      content: [
        t('onboarding.fameContent1'),
        t('onboarding.fameContent2'),
        t('onboarding.fameContent3'),
        t('onboarding.fameContent4'),
        t('onboarding.fameContent5'),
      ],
      accentColor: COLORS.danger,
    },
    {
      key: 'start',
      emoji: '🚀',
      title: t('onboarding.startTitle'),
      subtitle: t('onboarding.startSubtitle'),
      content: [
        t('onboarding.startContent1'),
        t('onboarding.startContent2'),
        t('onboarding.startContent3'),
        t('onboarding.startContent4'),
      ],
      accentColor: COLORS.success,
    },
  ];

  const handleViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0) {
        const idx = viewableItems[0].index ?? 0;
        setCurrentIndex(idx);
        RNAnimated.timing(progressAnim, {
          toValue: idx / (SLIDES.length - 1),
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    }
  ).current;

  const goNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, '1');
    router.replace('/auth/login');
  };

  const isLast = currentIndex === SLIDES.length - 1;

  const renderSlide = ({ item }: { item: Slide }) => (
    <View style={[styles.slide, { width }]}>
      {/* Emoji grande */}
      <Text style={styles.slideEmoji}>{item.emoji}</Text>

      {/* Acento de color */}
      <View style={[styles.accentLine, { backgroundColor: item.accentColor }]} />

      {/* Título */}
      <Text style={[styles.slideTitle, { color: item.accentColor }]}>{item.title}</Text>
      <Text style={styles.slideSubtitle}>{item.subtitle}</Text>

      {/* Contenido */}
      <View style={[styles.contentBox, { borderColor: item.accentColor + '40' }]}>
        {item.content.map((line, i) => (
          <View key={i} style={styles.contentLine}>
            <Text style={styles.contentText}>{line}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const slide = SLIDES[currentIndex];

  return (
    <View style={styles.container}>
      {/* Logo */}
      <Text style={styles.logo}>
        <Text style={{ color: '#FFFFFF' }}>GRID</Text>
        <Text style={{ color: '#FF3B30' }}>WAR</Text>
      </Text>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        style={styles.flatList}
      />

      {/* Dots */}
      <View style={styles.dotsRow}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              i === currentIndex && [styles.dotActive, { backgroundColor: slide.accentColor }],
            ]}
          />
        ))}
      </View>

      {/* Botones */}
      <View style={styles.buttonsRow}>
        <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
          <Text style={styles.skipText}>{isLast ? '' : t('onboarding.skip')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accentColor }]}
          onPress={isLast ? handleFinish : goNext}
        >
          <Text style={styles.nextText}>
            {isLast ? t('onboarding.start') : t('onboarding.next')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Indicador de slide */}
      <Text style={styles.slideCounter}>
        {currentIndex + 1} / {SLIDES.length}
      </Text>
    </View>
  );
}
