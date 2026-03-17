/**
 * ChallengeModal — notificación in-app emergente cuando alguien te reta.
 *
 * Aparece encima de cualquier pantalla de la app (Modal transparente),
 * lo que lo hace funcionar como notificación in-app nativa cuando la app está abierta.
 *
 * Incluye:
 * - Foto/avatar del retador
 * - Nombre, rango y puntos del retador
 * - Countdown real basado en expiresAt del servidor
 * - Advertencia clara de consecuencias por no aceptar
 * - Animación pulsante de urgencia
 */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated as RNAnimated,
  Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Challenge } from '../services/challenge';
import { getRankInfo, getTranslatedRankName } from '../services/ranking';
import { AVATARS } from './AvatarPicker';
import { useColors } from '../hooks/useColors';
import '../i18n';

const { width } = Dimensions.get('window');

interface ChallengeModalProps {
  challenge: Challenge | null;
  onAccept: () => void;
  onReject: () => void;
}

const ACCEPT_TIMEOUT = 30;

const createStyles = (COLORS: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalWrapper: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  rankAccent: {
    height: 4,
    width: '100%',
  },
  modal: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  incomingLabel: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  countdownBubble: {
    flexDirection: 'row',
    alignItems: 'baseline',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countdownNumber: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  countdownSec: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  timerBarBg: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  challengerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    marginRight: 14,
  },
  challengerInfo: { flex: 1 },
  challengerUsername: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  rankIcon: { fontSize: 14 },
  rankText: { fontSize: 13, fontWeight: 'bold' },
  pointsDot: { color: COLORS.textSecondary, fontSize: 13 },
  pointsText: { color: COLORS.textSecondary, fontSize: 13 },
  challengeText: {
    color: COLORS.primary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  rulesBox: {
    backgroundColor: 'rgba(0,245,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,245,255,0.15)',
  },
  rulesTitle: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  rulesItem: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,150,0,0.08)',
    borderRadius: 12,
    padding: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,150,0,0.25)',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningBoxCritical: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderColor: COLORS.danger,
  },
  warningIcon: { fontSize: 16 },
  warningTextContainer: { flex: 1 },
  warningTitle: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: 'bold',
    marginBottom: 3,
  },
  warningItem: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  rejectIcon: { fontSize: 14, color: COLORS.danger },
  rejectText: {
    color: COLORS.danger,
    fontWeight: 'bold',
    fontSize: 14,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  acceptIcon: { fontSize: 16 },
  acceptText: {
    color: COLORS.background,
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});

const ChallengeModal: React.FC<ChallengeModalProps> = ({
  challenge,
  onAccept,
  onReject,
}) => {
  const { t } = useTranslation();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [secondsLeft, setSecondsLeft] = useState(ACCEPT_TIMEOUT);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  const shakeAnim = useRef(new RNAnimated.Value(0)).current;
  const bgOpacity = useRef(new RNAnimated.Value(0)).current;
  const slideAnim = useRef(new RNAnimated.Value(80)).current;

  useEffect(() => {
    if (!challenge) return;

    // Calcular tiempo real restante
    const realSecondsLeft = Math.max(0, Math.floor((challenge.expiresAt - Date.now()) / 1000));
    setSecondsLeft(Math.min(realSecondsLeft, ACCEPT_TIMEOUT));

    // Animación de entrada
    RNAnimated.parallel([
      RNAnimated.timing(bgOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      RNAnimated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    // Timer countdown
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          onReject();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Pulsación constante
    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.04, duration: 600, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      bgOpacity.setValue(0);
      slideAnim.setValue(80);
    };
  }, [challenge?.challengeId]);

  // Shake cuando quedan ≤5 segundos
  useEffect(() => {
    if (secondsLeft <= 5 && secondsLeft > 0) {
      RNAnimated.sequence([
        RNAnimated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
        RNAnimated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [secondsLeft]);

  if (!challenge) return null;

  const rankInfo = getRankInfo(challenge.fromRank);
  const avatarSource = challenge.fromPhotoURL
    ? { uri: challenge.fromPhotoURL }
    : AVATARS[challenge.fromAvatar] || AVATARS['avatar_1'];

  const urgency = secondsLeft <= 10;
  const critical = secondsLeft <= 5;

  // Color del countdown según urgencia
  const countdownColor = critical ? '#FF1744' : urgency ? COLORS.warning : COLORS.success;

  // Porcentaje del timer para la barra de progreso
  const timerPercent = secondsLeft / ACCEPT_TIMEOUT;

  return (
    <Modal transparent animationType="none" visible={!!challenge} statusBarTranslucent>
      <RNAnimated.View style={[styles.overlay, { opacity: bgOpacity }]}>
        <RNAnimated.View
          style={[
            styles.modalWrapper,
            {
              transform: [
                { translateY: slideAnim },
                { scale: pulseAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* Borde superior de color del rango */}
          <View style={[styles.rankAccent, { backgroundColor: rankInfo.color }]} />

          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.headerRow}>
              <Text style={styles.incomingLabel}>⚔️ {t('challenges.title').toUpperCase()}</Text>
              <View style={[styles.countdownBubble, { borderColor: countdownColor }]}>
                <Text style={[styles.countdownNumber, { color: countdownColor }]}>
                  {secondsLeft}
                </Text>
                <Text style={[styles.countdownSec, { color: countdownColor }]}>s</Text>
              </View>
            </View>

            {/* Barra de progreso del timer */}
            <View style={styles.timerBarBg}>
              <RNAnimated.View
                style={[
                  styles.timerBarFill,
                  {
                    width: `${timerPercent * 100}%`,
                    backgroundColor: countdownColor,
                  },
                ]}
              />
            </View>

            {/* Info del retador */}
            <View style={styles.challengerSection}>
              <Image source={avatarSource} style={[styles.avatar, { borderColor: rankInfo.color }]} />
              <View style={styles.challengerInfo}>
                <Text style={styles.challengerUsername}>{challenge.fromUsername}</Text>
                <View style={styles.rankRow}>
                  <Text style={[styles.rankIcon]}>{rankInfo.icon}</Text>
                   <Text style={[styles.rankText, { color: rankInfo.color }]}>
                    {getTranslatedRankName(challenge.fromRank)}
                  </Text>
                  <Text style={styles.pointsDot}>·</Text>
                  <Text style={styles.pointsText}>{challenge.fromPoints} pts</Text>
                </View>
                <Text style={styles.challengeText}>{t('challenges.incoming', { username: challenge.fromUsername })}</Text>
              </View>
            </View>

            {/* Reglas del match */}
            <View style={styles.rulesBox}>
              <Text style={styles.rulesTitle}>📋 {t('challenges.rulesTitle')}</Text>
              <Text style={styles.rulesItem}>🎯 {t('challenges.rulesBestOf3')}</Text>
              <Text style={styles.rulesItem}>⏱ {t('challenges.rulesTimer')}</Text>
              <Text style={styles.rulesItem}>💎 {t('challenges.rulesWildcards')}</Text>
            </View>

            {/* Advertencia */}
            <View style={[styles.warningBox, critical && styles.warningBoxCritical]}>
              <Text style={styles.warningIcon}>⚠️</Text>
              <View style={styles.warningTextContainer}>
                <Text style={styles.warningTitle}>{t('challenges.timeToAccept', { seconds: secondsLeft })}</Text>
                <Text style={styles.warningItem}>• -50 {t('home.points').toLowerCase()}</Text>
                <Text style={styles.warningItem}>• {t('challenges.rejectPenalty')}</Text>
              </View>
            </View>

            {/* Botones */}
            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
                <Text style={styles.rejectIcon}>✕</Text>
                <Text style={styles.rejectText}>{t('challenges.reject')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
                <Text style={styles.acceptIcon}>⚔️</Text>
                <Text style={styles.acceptText}>{t('challenges.accept')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </RNAnimated.View>
      </RNAnimated.View>
    </Modal>
  );
};

export default ChallengeModal;
