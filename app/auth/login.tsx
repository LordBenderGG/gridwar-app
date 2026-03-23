import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Animated as RNAnimated, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { loginUser, ensureUserProfile } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import '../../i18n';

const { height } = Dimensions.get('window');

const createStyles = (COLORS: any) => StyleSheet.create({
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
  registerText: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold' },
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

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setUser } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
      Alert.alert(t('auth.fieldEmpty'), t('auth.fieldEmptyMsg'));
      return;
    }
    setLoading(true);
    try {
      const user = await loginUser(email.trim(), password);
      const profile = await ensureUserProfile(user);
      setUser(profile);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      shake();
      const code = e?.code || '';
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        Alert.alert(t('auth.invalidCredentials'), t('auth.loginError'));
      } else if (code === 'auth/invalid-email') {
        Alert.alert(t('auth.invalidEmail'), t('auth.emailFormatInvalid'));
      } else if (code === 'auth/user-disabled') {
        Alert.alert(t('auth.accountSuspended'), t('auth.accountDisabled'));
      } else if (code === 'auth/too-many-requests') {
        Alert.alert(t('auth.tooManyAttempts'), t('auth.tooManyAttemptsMsg'));
      } else if (code === 'auth/network-request-failed') {
        Alert.alert(t('auth.noConnection'), t('auth.noConnectionMsg'));
      } else {
        Alert.alert('Error', t('auth.loginFailed'));
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
          <Text style={styles.logo}>
            <Text style={{ color: '#FFFFFF' }}>GRID</Text>
            <Text style={{ color: '#FF3B30' }}>WAR</Text>
          </Text>
          <View style={styles.logoUnderline} />
          <Text style={styles.subtitle}>{t('auth.subtitleMain')}</Text>
          <Text style={styles.tagline}>{t('auth.tagline')}</Text>
        </View>

        {/* Form */}
        <RNAnimated.View style={[styles.form, { transform: [{ translateX: shakeAnim }] }]}>
          <Text style={styles.formTitle}>{t('auth.loginSignIn')}</Text>

           <View style={[styles.inputWrapper, focusedField === 'email' && styles.inputWrapperFocused]}>
             <Ionicons name="mail-outline" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
             <TextInput
               style={styles.input}
               placeholder={t('auth.email')}
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
             <Ionicons name="lock-closed-outline" size={16} color={COLORS.textMuted} style={styles.inputIcon} />
             <TextInput
               style={styles.input}
               placeholder={t('auth.password')}
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
               <Ionicons name="power-outline" size={18} color={COLORS.background} style={styles.btnIcon} />
               <Text style={styles.btnText}>{t('auth.enterGame')}</Text>
             </>
           )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerBtn}
            onPress={() => router.push('/auth/register')}
          >
            <Text style={styles.registerText}>{t('auth.noAccount')}</Text>
          </TouchableOpacity>
        </RNAnimated.View>

        {/* Stats decorativas */}
        <View style={styles.statsRow}>
           <View style={styles.statPill}>
             <Ionicons name="trophy" size={18} color={COLORS.textSecondary} style={styles.statPillEmoji} />
             <Text style={styles.statPillText}>{t('auth.ranks')}</Text>
           </View>
           <View style={styles.statPill}>
             <Ionicons name="refresh" size={18} color={COLORS.textSecondary} style={styles.statPillEmoji} />
             <Text style={styles.statPillText}>{t('auth.realtime')}</Text>
           </View>
           <View style={styles.statPill}>
             <Ionicons name="game-controller" size={18} color={COLORS.textSecondary} style={styles.statPillEmoji} />
             <Text style={styles.statPillText}>{t('auth.noPity')}</Text>
           </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
