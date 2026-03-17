import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as ImagePicker from 'expo-image-picker';
import { registerUser, uploadProfilePhoto, isUsernameTaken } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import AvatarPicker, { AVATAR_LIST } from '../../components/AvatarPicker';
import { useColors } from '../../hooks/useColors';
import '../../i18n';

const createStyles = (COLORS: any) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.background },
  container: {
    flexGrow: 1,
    alignItems: 'center',
    padding: 28,
    backgroundColor: COLORS.background,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.primary,
    letterSpacing: 8,
    textShadowColor: COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    marginBottom: 4,
    marginTop: 40,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 32,
    letterSpacing: 2,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  form: { width: '100%' },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
    width: '100%',
  },
  btnText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 1,
  },
  link: {
    color: COLORS.primary,
    textAlign: 'center',
    fontSize: 14,
  },
  photoBtn: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    width: 120,
    height: 120,
    justifyContent: 'center',
  },
  photoBtnText: {
    color: COLORS.primary,
    textAlign: 'center',
    fontSize: 13,
  },
  photoPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  orText: {
    color: COLORS.textSecondary,
    marginVertical: 12,
    fontSize: 13,
  },
});

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { setUser, updateUser } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_LIST[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'data' | 'avatar'>('data');

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('auth.photoPermission'), t('auth.photoPermissionMsg'), [{ text: t('auth.understood') }]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
      setSelectedAvatar('');
    }
  };

  const handleNextStep = () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      Alert.alert(t('auth.fieldRequired'), t('auth.fieldRequiredMsg'));
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert(t('auth.fieldRequired'), t('auth.usernameTooShort'));
      return;
    }
    if (password.length < 6) {
      Alert.alert(t('auth.fieldRequired'), t('auth.passwordTooShort'));
      return;
    }
    setStep('avatar');
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const profile = await registerUser(
        email.trim(),
        password,
        username.trim(),
        selectedAvatar || 'avatar_1',
        null
      );
      // Optimizar y guardar foto en background — no bloquea el acceso a la app
      if (photoUri) {
        uploadProfilePhoto(profile.uid, photoUri)
          .then((photoURL) => updateUser({ photoURL }))
          .catch(() => {
            // Fallo silencioso: el usuario puede cambiar la foto después desde perfil
          });
      }
      setUser(profile);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.includes('ya está en uso') || msg.includes('already in use')) {
        Alert.alert(t('auth.usernameTaken'), t('auth.usernameTakenMsg'));
      } else {
        Alert.alert('Error', msg || t('auth.registerError'));
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'avatar') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>
          <Text style={{ color: '#FFFFFF' }}>GRID</Text>
          <Text style={{ color: '#FF3B30' }}>WAR</Text>
        </Text>
        <Text style={styles.sectionTitle}>{t('auth.chooseAvatar')}</Text>

        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.photoBtnText}>{t('auth.uploadPhoto')}</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>{t('auth.orChooseAvatar')}</Text>
        <AvatarPicker
          selected={selectedAvatar}
          useEmoji
          onSelect={(a) => { setSelectedAvatar(a); setPhotoUri(null); }}
        />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.btnText}>{t('auth.createAccount')}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setStep('data')}>
          <Text style={styles.link}>{t('auth.back')}</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>
          <Text style={{ color: '#FFFFFF' }}>GRID</Text>
          <Text style={{ color: '#FF3B30' }}>WAR</Text>
        </Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder={t('auth.username')}
            placeholderTextColor={COLORS.textSecondary}
            value={username}
            onChangeText={setUsername}
            maxLength={20}
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.email')}
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handleNextStep} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.btnText}>{t('auth.nextAvatar')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>{t('auth.hasAccount')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
