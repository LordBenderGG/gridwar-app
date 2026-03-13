import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { createTournament, joinTournament } from '../../services/tournament';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants/theme';

type MaxPlayers = 4 | 8 | 16;

const SIZES: { value: MaxPlayers; label: string; prize: string; description: string }[] = [
  { value: 4, label: '4 Jugadores', prize: '200 💎', description: 'Rápido · 2 rondas' },
  { value: 8, label: '8 Jugadores', prize: '500 💎 + 500 pts', description: 'Estándar · 3 rondas' },
  { value: 16, label: '16 Jugadores', prize: '1000 💎 + 800 pts', description: 'Épico · 4 rondas' },
];

export default function CrearTorneoScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState<MaxPlayers>(4);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!user) return;
    const trimmed = name.trim();
    if (trimmed.length < 3) {
      Alert.alert('Nombre inválido', 'El nombre debe tener al menos 3 caracteres.');
      return;
    }
    setLoading(true);
    try {
      const tournamentId = await createTournament(trimmed, user.uid, maxPlayers);
      await joinTournament(tournamentId, user.uid, user.username, user.avatar);
      router.replace(`/tournament/${tournamentId}`);
    } catch (e) {
      Alert.alert('Error', 'No se pudo crear el torneo. Intenta de nuevo.');
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>CREAR TORNEO</Text>
      <Text style={styles.subtitle}>Organiza tu propio torneo y reta a todos</Text>

      {/* Tournament name */}
      <View style={styles.section}>
        <Text style={styles.label}>Nombre del torneo</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Ej: Torneo de Verano 🔥"
          placeholderTextColor={COLORS.textSecondary}
          maxLength={40}
        />
      </View>

      {/* Size selector */}
      <View style={styles.section}>
        <Text style={styles.label}>Tamaño del torneo</Text>
        {SIZES.map((s) => (
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
              <Text style={styles.sizePrize}>{s.prize}</Text>
              {maxPlayers === s.value && (
                <View style={styles.selectedDot} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>📋 Reglas</Text>
        <Text style={styles.infoText}>• El torneo comienza cuando se unan todos los jugadores</Text>
        <Text style={styles.infoText}>• Formato de eliminación directa</Text>
        <Text style={styles.infoText}>• El creador puede iniciar el torneo manualmente</Text>
        <Text style={styles.infoText}>• Tú automáticamente quedarás inscrito</Text>
      </View>

      {/* Create button */}
      <TouchableOpacity
        style={[styles.createBtn, (loading || name.trim().length < 3) && styles.createBtnDisabled]}
        onPress={handleCreate}
        disabled={loading || name.trim().length < 3}
      >
        {loading ? (
          <ActivityIndicator color={COLORS.background} />
        ) : (
          <Text style={styles.createBtnText}>🏆 CREAR TORNEO</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  subtitle: {
    color: COLORS.textSecondary, fontSize: 13,
    textAlign: 'center', marginBottom: 30,
  },
  section: { marginBottom: 24 },
  label: {
    color: COLORS.textSecondary, fontSize: 12,
    fontWeight: 'bold', letterSpacing: 1, marginBottom: 10,
  },
  input: {
    backgroundColor: COLORS.surface, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    color: COLORS.text, fontSize: 15,
    borderWidth: 1, borderColor: COLORS.border,
  },
  sizeCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 14,
    padding: 16, marginBottom: 8,
    borderWidth: 2, borderColor: COLORS.border,
  },
  sizeCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0,245,255,0.07)',
  },
  sizeLeft: { flex: 1 },
  sizeTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  sizeSelectedText: { color: COLORS.primary },
  sizeDesc: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  sizeRight: { alignItems: 'flex-end', gap: 6 },
  sizePrize: { color: COLORS.warning, fontSize: 13, fontWeight: 'bold' },
  selectedDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  infoBox: {
    backgroundColor: COLORS.surfaceLight, borderRadius: 14,
    padding: 16, marginBottom: 28,
    borderWidth: 1, borderColor: COLORS.border,
  },
  infoTitle: { color: COLORS.text, fontSize: 13, fontWeight: 'bold', marginBottom: 8 },
  infoText: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 4, lineHeight: 18 },
  createBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  createBtnDisabled: { opacity: 0.4 },
  createBtnText: {
    color: COLORS.background, fontSize: 16,
    fontWeight: '900', letterSpacing: 2,
  },
});
