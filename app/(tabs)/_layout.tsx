import React, { useEffect, useMemo } from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { useColors } from '../../hooks/useColors';
import { View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import '../../i18n';

const createStyles = (COLORS: any) => StyleSheet.create({
  iconWrapper: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  iconWrapperActive: {
    backgroundColor: 'rgba(0,238,255,0.12)',
  },
  iconWrapperGold: {
    backgroundColor: 'rgba(255,214,0,0.12)',
  },
  iconWrapperDanger: {
    backgroundColor: 'rgba(255,23,68,0.12)',
  },
  iconWrapperTournament: {
    backgroundColor: 'rgba(0,200,150,0.12)',
  },
  iconWrapperShop: {
    backgroundColor: 'rgba(255,214,0,0.12)',
  },
  iconWrapperTraining: {
    backgroundColor: 'rgba(167,139,250,0.12)',
  },
});

export default function TabsLayout() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [user, loading]);

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.borderBright,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: '700',
          letterSpacing: 0.5,
        },
      }}
    >
      {/* 1. Inicio */}
      <Tabs.Screen
        name="home"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />

      {/* 2. Tienda */}
      <Tabs.Screen
        name="tienda"
        options={{
          title: t('nav.shop'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperShop]}>
              <FontAwesome5 name="store" size={18} color={focused ? COLORS.accent : color} />
            </View>
          ),
          tabBarActiveTintColor: COLORS.accent,
        }}
      />

      {/* 3. Campeones */}
      <Tabs.Screen
        name="clasificacion"
        options={{
          title: t('nav.champions'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperGold]}>
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
            </View>
          ),
          tabBarActiveTintColor: COLORS.accent,
        }}
      />

      {/* 4. Torneos */}
      <Tabs.Screen
        name="torneos"
        options={{
          title: t('nav.tournaments'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperTournament]}>
              <MaterialCommunityIcons name="tournament" size={22} color={focused ? '#00C896' : color} />
            </View>
          ),
          tabBarActiveTintColor: '#00C896',
        }}
      />

      {/* Vergüenza — oculta del nav, integrada en clasificacion */}
      <Tabs.Screen
        name="salon"
        options={{ href: null }}
      />

      {/* 5. Entrenamiento */}
      <Tabs.Screen
        name="entrenamiento"
        options={{
          title: t('nav.training'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperTraining]}>
              <MaterialCommunityIcons
                name="sword-cross"
                size={22}
                color={focused ? '#A78BFA' : color}
              />
            </View>
          ),
          tabBarActiveTintColor: '#A78BFA',
        }}
      />

      {/* 6. Perfil */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: t('nav.profile'),
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />

      {/* Retos — oculto del nav, sigue siendo una ruta válida */}
      <Tabs.Screen
        name="retos"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
