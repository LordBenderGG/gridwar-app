/**
 * sound.ts — Servicio de sonidos para GRIDWAR
 *
 * Usa expo-av con archivos WAV en assets/sounds/.
 * Todos los sonidos son sintéticos generados con generate_sounds.js.
 *
 * API:
 *   playSound(name)    — reproduce un sonido (falla silenciosamente)
 *   preloadSounds()    — precarga todos los sonidos al iniciar
 *   unloadSounds()     — libera recursos al desmontar
 */

import { Audio } from 'expo-av';

// ─── Mapa de nombre  require ─────────────────────────────────────────────────

const SOUND_FILES = {
  tap:        require('../assets/sounds/tap.wav'),
  win:        require('../assets/sounds/win.wav'),
  lose:       require('../assets/sounds/lose.wav'),
  draw:       require('../assets/sounds/draw.wav'),
  wildcard:   require('../assets/sounds/wildcard.wav'),
  countdown:  require('../assets/sounds/countdown.wav'),
  purchase:   require('../assets/sounds/purchase.wav'),
  challenge:  require('../assets/sounds/challenge.wav'),
} as const;

export type SoundName = keyof typeof SOUND_FILES;

// ─── Cache de objetos Sound ───────────────────────────────────────────────────

const soundCache = new Map<SoundName, Audio.Sound>();
let audioConfigured = false;

async function ensureAudioMode() {
  if (audioConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    audioConfigured = true;
  } catch {
    // Ignorar si la configuración falla
  }
}

// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Reproduce un sonido por nombre. No lanza excepciones — falla silenciosamente.
 */
export async function playSound(name: SoundName): Promise<void> {
  try {
    await ensureAudioMode();

    let sound = soundCache.get(name);

    if (!sound) {
      const { sound: newSound } = await Audio.Sound.createAsync(
        SOUND_FILES[name],
        { shouldPlay: false, volume: 1.0 },
      );
      soundCache.set(name, newSound);
      sound = newSound;
    }

    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch {
    // Falla silenciosa — los sonidos son mejora opcional
  }
}

/**
 * Precarga todos los sonidos en background para reducir latencia.
 * Llamar una vez al iniciar la app.
 */
export async function preloadSounds(): Promise<void> {
  await ensureAudioMode();
  for (const key of Object.keys(SOUND_FILES) as SoundName[]) {
    try {
      if (soundCache.has(key)) continue;
      const { sound } = await Audio.Sound.createAsync(
        SOUND_FILES[key],
        { shouldPlay: false, volume: 1.0 },
      );
      soundCache.set(key, sound);
    } catch {
      // Ignorar errores de precarga individuales
    }
  }
}

/**
 * Libera todos los objetos Sound del cache.
 */
export async function unloadSounds(): Promise<void> {
  for (const [, sound] of soundCache) {
    try {
      await sound.unloadAsync();
    } catch {
      // Ignorar
    }
  }
  soundCache.clear();
  audioConfigured = false;
}
