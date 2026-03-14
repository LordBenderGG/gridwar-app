import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

/**
 * Pantalla de Tienda — PRÓXIMAMENTE
 *
 * Aquí el jugador podrá gastar sus puntos para comprar comodines:
 *   - Escudo, Turbo, Tiempo, Ciego, Confusión, Bomba
 *
 * Por ahora es una pantalla de reserva (placeholder).
 * La implementación completa vendrá en la siguiente versión.
 */
export default function TiendaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>🏪</Text>
      <Text style={styles.title}>TIENDA</Text>
      <Text style={styles.subtitle}>PRÓXIMAMENTE</Text>
      <Text style={styles.description}>
        Gasta tus puntos para comprar comodines poderosos.{'\n'}
        ¡Vuelve pronto!
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  icon: {
    fontSize: 72,
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 8,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    letterSpacing: 4,
    marginBottom: 20,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
});
