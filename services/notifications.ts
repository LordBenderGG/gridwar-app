/**
 * services/notifications.ts
 * Sistema de notificaciones push para GRIDWAR.
 * - Notificaciones locales: retos entrantes, bono diario
 * - Push remotas: via Expo Push API (sin backend propio)
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

// ─── Configurar handler de notificaciones ────────────────────────────────────

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ─── Registrar token push ─────────────────────────────────────────────────────

export const registerPushToken = async (uid: string): Promise<void> => {
  try {
    if (!Device.isDevice) return; // no funciona en emulador

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('challenges', {
        name: 'Retos',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#60A5FA',
        sound: 'default',
      });
      await Notifications.setNotificationChannelAsync('bonuses', {
        name: 'Bonos',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: 'default',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'fc9a81f1-2663-4874-8d18-6246d2c44354',
    });

    const token = tokenData.data;
    if (token) {
      await updateDoc(doc(db, 'users', uid), {
        expoPushToken: token,
      }).catch(() => {});
    }
  } catch {
    // silencioso
  }
};

// ─── Enviar push a un usuario via Expo Push API ───────────────────────────────

interface PushPayload {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string;
  sound?: string;
  priority?: 'default' | 'normal' | 'high';
}

export const sendPushToUser = async (
  targetUid: string,
  title: string,
  body: string,
  data?: Record<string, any>,
  channelId?: string
): Promise<void> => {
  try {
    const snap = await getDoc(doc(db, 'users', targetUid));
    if (!snap.exists()) return;
    const token = snap.data().expoPushToken;
    if (!token || !token.startsWith('ExponentPushToken')) return;

    const payload: PushPayload = {
      to: token,
      title,
      body,
      data: data ?? {},
      channelId: channelId ?? 'challenges',
      sound: 'default',
      priority: 'high',
    };

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // silencioso
  }
};

// ─── Notificación local: reto entrante ───────────────────────────────────────

export const scheduleLocalChallengeNotification = async (
  fromUsername: string
): Promise<void> => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '⚔️ Reto recibido',
        body: `${fromUsername} te desafía a una batalla. ¡Tienes 30 segundos!`,
        sound: 'default',
        data: { type: 'challenge' },
        ...(Platform.OS === 'android' && { channelId: 'challenges' }),
      },
      trigger: null, // inmediato
    });
  } catch {
    // silencioso
  }
};

// ─── Notificación programada: bono diario ────────────────────────────────────

export const scheduleDailyBonusReminder = async (): Promise<void> => {
  try {
    // Cancelar recordatorio anterior
    await Notifications.cancelAllScheduledNotificationsAsync();

    // Programar para 22 horas desde ahora (antes del reset diario)
    const triggerDate = new Date(Date.now() + 22 * 60 * 60 * 1000);

    await Notifications.scheduleNotificationAsync({
      content: {
        title: '💎 ¡Tu bono diario te espera!',
        body: 'Abre GRIDWAR y reclama tus gemas diarias gratis.',
        sound: 'default',
        data: { type: 'daily_bonus' },
      },
      trigger: Platform.OS === 'android'
        ? { date: triggerDate, channelId: 'bonuses' } as any
        : triggerDate,
    });
  } catch {
    // silencioso
  }
};
