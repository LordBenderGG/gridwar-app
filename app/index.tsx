import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, ImageBackground, Image } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useColors } from '../hooks/useColors';
import { ONBOARDING_KEY } from './onboarding';

export default function IndexScreen() {
  const COLORS = useColors();
  const router = useRouter();
  const { user, loading } = useAuthStore();

  useEffect(() => {
    if (loading) return;

    const checkOnboarding = async () => {
      const done = await AsyncStorage.getItem(ONBOARDING_KEY);
      if (!done) {
        router.replace('/onboarding');
        return;
      }
      if (user) {
        router.replace('/(tabs)/home');
      } else {
        router.replace('/auth/login');
      }
    };

    checkOnboarding();
  }, [user, loading]);

  return (
    <ImageBackground source={require('../assets/splash.png')} style={styles.container}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image source={require('../logo.png')} style={{ width: 200, height: 200 }} />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
