import React, { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FontAwesome5 } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { View, StyleSheet } from 'react-native';

export default function TabsLayout() {
  const router = useRouter();
  const { user, loading } = useAuthStore();

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
      <Tabs.Screen
        name="home"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="clasificacion"
        options={{
          title: 'Campeones',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperGold]}>
              <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} />
            </View>
          ),
          tabBarActiveTintColor: COLORS.accent,
        }}
      />
      <Tabs.Screen
        name="retos"
        options={{
          title: 'Retos',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperFire]}>
              <Ionicons name={focused ? 'flash' : 'flash-outline'} size={24} color={focused ? COLORS.secondary : color} />
            </View>
          ),
          tabBarActiveTintColor: COLORS.secondary,
        }}
      />
      <Tabs.Screen
        name="tienda"
        options={{
          title: 'Tienda',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperShop]}>
              <FontAwesome5 name="store" size={18} color={focused ? COLORS.accent : color} />
            </View>
          ),
          tabBarActiveTintColor: COLORS.accent,
        }}
      />
      <Tabs.Screen
        name="salon"
        options={{
          title: 'Vergüenza',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperDanger]}>
              <MaterialCommunityIcons name="skull-crossbones" size={22} color={focused ? COLORS.danger : color} />
            </View>
          ),
          tabBarActiveTintColor: COLORS.danger,
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.iconWrapper, focused && styles.iconWrapperActive]}>
              <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
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
  iconWrapperFire: {
    backgroundColor: 'rgba(255,87,34,0.12)',
  },
  iconWrapperDanger: {
    backgroundColor: 'rgba(255,23,68,0.12)',
  },
  iconWrapperShop: {
    backgroundColor: 'rgba(255,214,0,0.12)',
  },
});
