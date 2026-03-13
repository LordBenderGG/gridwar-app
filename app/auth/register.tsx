import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { registerUser, uploadProfilePhoto, isUsernameTaken } from '../../services/auth';
import { useAuthStore } from '../../store/authStore';
import AvatarPicker, { AVATAR_LIST } from '../../components/AvatarPicker';
import { COLORS } from '../../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { setUser, updateUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_LIST[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);   // solo para preview
  const [photoBase64, setPhotoBase64] = useState<string | null>(null); // para guardar en Firestore
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'data' | 'avatar'>('data');

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tu galería para que puedas subir tu foto.',
        [{ text: 'Entendido' }]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,  // Bajo para que quepa en Firestore (<1MB por documento)
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setPhotoUri(result.assets[0].uri);       // preview local
      setPhotoBase64(result.assets[0].base64); // se guardará en Firestore
      setSelectedAvatar('');
    }
  };

  const handleNextStep = async () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      Alert.alert('Error', 'Completa todos los campos');
      return;
    }
    if (username.trim().length < 3) {
      Alert.alert('Error', 'El username debe tener al menos 3 caracteres');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const taken = await isUsernameTaken(username.trim());
      if (taken) {
        Alert.alert('Nombre en uso', 'Ese nombre de usuario ya existe. Elige otro.');
        return;
      }
      setStep('avatar');
    } catch {
      Alert.alert('Error', 'No se pudo verificar el nombre de usuario. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
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
      // Subir foto en segundo plano: no bloquea el acceso a la app
      if (photoBase64) {
        uploadProfilePhoto(profile.uid, photoBase64)
          .then((photoURL) => updateUser({ photoURL }))
          .catch(() => {
            // Fallo silencioso: el usuario puede cambiar la foto después desde perfil
          });
      }
      setUser(profile);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Error al registrarse');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'avatar') {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.logo}>TIKTAK</Text>
        <Text style={styles.sectionTitle}>Elige tu avatar</Text>

        <TouchableOpacity style={styles.photoBtn} onPress={pickPhoto}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          ) : (
            <Text style={styles.photoBtnText}>📷 Subir foto propia</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.orText}>— o elige un avatar —</Text>
        <AvatarPicker selected={selectedAvatar} onSelect={(a) => { setSelectedAvatar(a); setPhotoUri(null); }} />

        <TouchableOpacity style={styles.btn} onPress={handleRegister} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={COLORS.background} />
          ) : (
            <Text style={styles.btnText}>¡CREAR CUENTA!</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setStep('data')}>
          <Text style={styles.link}>← Volver</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>TIKTAK</Text>
        <Text style={styles.subtitle}>Crea tu cuenta</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Nombre de usuario"
            placeholderTextColor={COLORS.textSecondary}
            value={username}
            onChangeText={setUsername}
            maxLength={20}
          />
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor={COLORS.textSecondary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña (mín. 6 caracteres)"
            placeholderTextColor={COLORS.textSecondary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity style={styles.btn} onPress={handleNextStep} disabled={loading}>
            {loading ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.btnText}>SIGUIENTE → Elegir avatar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
          </TouchableOpacity>
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
