import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated as RNAnimated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { loginUser, getUserProfile } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { COLORS } from '../../constants/theme';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const shakeAnim = useRef(new RNAnimated.Value(0)).current;

  const shake = () => {
    RNAnimated.sequence([
      RNAnimated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      shake();
      Alert.alert('Campos vacíos', 'Completa email y contraseña');
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      const profile = await getUserProfile(user.uid);
      if (profile) {
        setUser(profile);
        router.replace('/(tabs)/home');
      } else {
        Alert.alert('Error', 'No se encontró tu perfil. Contacta soporte.');
      }
    } catch (e: any) {
      shake();
      const code = e?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        Alert.alert('Credenciales incorrectas', 'Email o contraseña incorrectos');
      } else if (code === 'auth/invalid-email') {
        Alert.alert('Email inválido', 'El formato del email no es válido');
      } else if (code === 'auth/user-disabled') {
        Alert.alert('Cuenta suspendida', 'Tu cuenta ha sido desactivada');
      } else if (code === 'auth/too-many-requests') {
        Alert.alert('Demasiados intentos', 'Espera unos minutos antes de intentarlo de nuevo');
      } else if (code === 'auth/network-request-failed') {
        Alert.alert('Sin conexión', 'Revisa tu conexión a Internet e intenta de nuevo');
      } else {
        Alert.alert('Error', 'No se pudo iniciar sesión. Intenta de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header decorativo */}
        <View style={styles.topDecor}>
          <View style={styles.decorCircle1} />
          <View style={styles.decorCircle2} />
        </View>

        {/* Logo */}
        <View style={styles.logoSection}>
          <Text style={styles.logo}>TIKTAK</Text>
          <View style={styles.logoUnderline} />
          <Text style={styles.subtitle}>3 en Raya · Sin piedad</Text>
          <Text style={styles.tagline}>⚔️ Reta · Vence · Domina</Text>
        </View>

        {/* Form */}
        <RNAnimated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.formTitle}>INICIAR SESIÓN</Text>

          <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedField('email')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnLoading]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <>
                <Text style={styles.btnIcon}>🎮</Text>
                <Text style={styles.btnText}>ENTRAR AL JUEGO</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.registerText}>¿Sin cuenta? </Text>
            <Text style={styles.registerLink}>Regístrate gratis →</Text>
          </TouchableOpacity>
        </RNAnimated.View>

        {/* Stats decorativas */}
        <View style={styles.statsRow}>
          <View style={styles.statPill}>
            <Text style={styles.statPillEmoji}>👑</Text>
            <Text style={styles.statPillText}>7 Rangos</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillEmoji}>⚡</Text>
            <Text style={styles.statPillText}>Tiempo real</Text>
          </View>
          <View style={styles.statPill}>
            <Text style={styles.statPillEmoji}>💀</Text>
            <Text style={styles.statPillText}>Sin piedad</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    paddingBottom: 40,
  },
  topDecor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(0,238,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0,238,255,0.08)',
  },
  decorCircle2: {
    position: 'absolute',
    top: -40,
    left: -100,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255,87,34,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,87,34,0.06)',
  },
  logoSection: {
    alignItems: 'center',
    paddingTop: 80,
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 10,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  logoUnderline: {
    width: 100,
    height: 3,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginTop: -4,
    marginBottom: 10,
    opacity: 0.6,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    letterSpacing: 3,
    marginBottom: 6,
  },
  tagline: {
    color: COLORS.secondary,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  form: {
    width: '100%',
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  formTitle: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 3,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.surfaceLight,
  },
  inputIcon: { fontSize: 16, marginRight: 10 },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 14,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  btnLoading: { opacity: 0.7 },
  btnIcon: { fontSize: 18 },
  btnText: {
    color: COLORS.background,
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 1.5,
  },
  registerBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  registerText: { color: COLORS.textSecondary, fontSize: 14 },
  registerLink: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 24,
  },
  statPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 4,
  },
  statPillEmoji: { fontSize: 18 },
  statPillText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: '600' },
});
