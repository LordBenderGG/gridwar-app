import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated as RNAnimated,
} from 'react-native';
import { Challenge } from '../services/challenge';
import { getRankInfo } from '../services/ranking';
import { AVATARS } from './AvatarPicker';
import { COLORS } from '../constants/theme';

interface ChallengeModalProps {
  challenge: Challenge | null;
  onAccept: () => void;
  onReject: () => void;
}

const ACCEPT_TIMEOUT = 30;

const ChallengeModal: React.FC<ChallengeModalProps> = ({
  challenge,
  onAccept,
  onReject,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(ACCEPT_TIMEOUT);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (!challenge) return;
    setSecondsLeft(ACCEPT_TIMEOUT);

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

    RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.05, duration: 500, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [challenge]);

  if (!challenge) return null;

  const rankInfo = getRankInfo(challenge.fromRank);
  const avatarSource = challenge.fromPhotoURL
    ? { uri: challenge.fromPhotoURL }
    : AVATARS[challenge.fromAvatar] || AVATARS['avatar_1'];

  const urgency = secondsLeft <= 10;

  return (
    <Modal transparent animationType="fade" visible={!!challenge}>
      <View style={styles.overlay}>
        <RNAnimated.View style={[styles.modal, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.title}>⚔️ RETO ENTRANTE</Text>

          <Image source={avatarSource} style={styles.avatar} />
          <Text style={styles.username}>{challenge.fromUsername}</Text>
          <Text style={[styles.rank, { color: rankInfo.color }]}>
            {rankInfo.icon} {challenge.fromRank} · {challenge.fromPoints} pts
          </Text>

          <Text style={[styles.countdown, urgency && styles.countdownUrgent]}>
            {secondsLeft}s
          </Text>
          <Text style={styles.countdownLabel}>para aceptar</Text>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
              <Text style={styles.rejectText}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.acceptBtn} onPress={onAccept}>
              <Text style={styles.acceptText}>✅ ACEPTAR</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.warning}>
            ⚠️ Si no aceptas: -50 pts y 30 min bloqueado
          </Text>
        </RNAnimated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    width: '85%',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  title: {
    color: COLORS.primary,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: COLORS.primary,
    marginBottom: 8,
  },
  username: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  rank: {
    fontSize: 14,
    marginBottom: 16,
  },
  countdown: {
    color: COLORS.success,
    fontSize: 56,
    fontWeight: '900',
  },
  countdownUrgent: {
    color: COLORS.danger,
  },
  countdownLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  rejectBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.danger,
  },
  rejectText: {
    color: COLORS.danger,
    fontWeight: 'bold',
  },
  acceptBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  acceptText: {
    color: COLORS.background,
    fontWeight: 'bold',
    fontSize: 16,
  },
  warning: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
});

export default ChallengeModal;
