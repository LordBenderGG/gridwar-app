/**
 * Pantalla de Onboarding — aparece SOLO la primera vez que se instala la app.
 * Se guarda en AsyncStorage para no volver a mostrarla.
 *
 * Slides:
 * 1. Bienvenida a TIKTAK
 * 2. Cómo se juega (reglas)
 * 3. Sistema de Rangos
 * 4. Salón de la Fama y la Vergüenza
 * 5. Comodines
 * 6. ¡A jugar!
 */
import React, { useRef, useState } from 'react';
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
import { COLORS } from '../constants/theme';
import { RANKS } from '../services/ranking';

const { width, height } = Dimensions.get('window');
export const ONBOARDING_KEY = 'tiktak_onboarding_done_v1';

interface Slide {
  key: string;
  emoji: string;
  title: string;
  subtitle: string;
  content: string[];
  accentColor: string;
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    emoji: '⚔️',
    title: 'BIENVENIDO A\nTIKTAK',
    subtitle: '3 en Raya · Sin piedad',
    content: [
      'El juego más adictivo del momento.',
      'Reta a jugadores reales en tiempo real.',
      'Sube de rango. Sé una leyenda.',
    ],
    accentColor: COLORS.primary,
  },
  {
    key: 'rules',
    emoji: '🎯',
    title: 'CÓMO SE JUEGA',
    subtitle: 'Reglas del combate',
    content: [
      '🏆 Best of 3 — gana 2 rondas para ganar el match.',
      '⏱ 30 segundos por turno — ¡piensa rápido!',
      '📩 Cuando alguien te reta, tienes 30s para aceptar.',
      '⚠️ Rechazar un reto = -50 puntos + 30 min bloqueado.',
      '😤 Perder = 3 horas sin poder retar a nadie.',
    ],
    accentColor: COLORS.secondary,
  },
  {
    key: 'ranks',
    emoji: '👑',
    title: 'SISTEMA DE RANGOS',
    subtitle: 'Sube hasta la cima',
    content: RANKS.map((r) => `${r.icon} ${r.name} — desde ${r.min} pts`),
    accentColor: COLORS.warning,
  },
  {
    key: 'wildcards',
    emoji: '💎',
    title: 'COMODINES',
    subtitle: 'Úsalos con astucia',
    content: [
      '❄️ Congelar — el rival pierde su siguiente turno.',
      '🔀 Confusión — el tablero del rival se invierte.',
      '👁 Ceguera — el rival no ve el tablero por 10s.',
      '🛡 Escudo — bloquea el próximo comodín enemigo.',
      '⚡ Turbo — ganas 15s extra en tu turno.',
      '⏳ Reducir — el rival solo tiene 15s en su turno.',
      '💎 Se compran con Gemas ganadas en partidas.',
    ],
    accentColor: COLORS.purple,
  },
  {
    key: 'fame',
    emoji: '🏆',
    title: 'SALÓN DE\nLA FAMA',
    subtitle: 'Y el Salón de la Vergüenza',
    content: [
      '🥇 Clasificación — los mejores jugadores del mundo.',
      '💀 Salón de la Vergüenza — los peores perdedores.',
      '¿Serás campeón o serás vergüenza?',
      'La app es viral — todos verán tu rango.',
      '¡Lleva a tus amigos y demuestra quién manda!',
    ],
    accentColor: COLORS.danger,
  },
  {
    key: 'start',
    emoji: '🚀',
    title: '¡A JUGAR!',
    subtitle: 'El tablero te espera',
    content: [
      '✅ Crea tu cuenta o inicia sesión.',
      '🎮 Ve al Inicio y reta a alguien.',
      '📲 Comparte la app — ¡hazla viral!',
      '¡Que gane el mejor!',
    ],
    accentColor: COLORS.success,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const progressAnim = useRef(new RNAnimated.Value(0)).current;

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
      <Text style={styles.logo}>TIKTAK</Text>

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
          <Text style={styles.skipText}>{isLast ? '' : 'Saltar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: slide.accentColor }]}
          onPress={isLast ? handleFinish : goNext}
        >
          <Text style={styles.nextText}>
            {isLast ? '¡EMPEZAR! 🚀' : 'Siguiente →'}
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

const styles = StyleSheet.create({
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
