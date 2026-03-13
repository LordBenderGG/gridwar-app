import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withRepeat,
  interpolateColor,
} from 'react-native-reanimated';
import { COLORS, TIMER_TOTAL } from '../constants/theme';

interface TimerProps {
  secondsLeft: number;
  isMyTurn: boolean;
  turboActive?: boolean;
}

const Timer: React.FC<TimerProps> = ({ secondsLeft, isMyTurn, turboActive }) => {
  const progress = useSharedValue(1);
  const pulse = useSharedValue(1);

  useEffect(() => {
    const ratio = secondsLeft / TIMER_TOTAL;
    progress.value = withTiming(ratio, { duration: 1000 });

    if (secondsLeft <= 5 && isMyTurn) {
      pulse.value = withRepeat(
        withSequence(withTiming(1.1, { duration: 300 }), withTiming(1, { duration: 300 })),
        -1,
        true
      );
    } else {
      pulse.value = withTiming(1);
    }
  }, [secondsLeft]);

  const barStyle = useAnimatedStyle(() => {
    const backgroundColor = interpolateColor(
      progress.value,
      [0, 0.3, 0.6, 1],
      [COLORS.danger, '#FF6B35', '#FFD700', COLORS.success]
    );
    return {
      width: `${progress.value * 100}%`,
      backgroundColor,
    };
  });

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const isUrgent = secondsLeft <= 5 && isMyTurn;

  return (
    <Animated.View style={[styles.container, pulseStyle]}>
      <View style={styles.track}>
        <Animated.View style={[styles.bar, barStyle]} />
      </View>
      <Text style={[styles.time, isUrgent && styles.timeUrgent]}>
        {turboActive ? `⚡ ${secondsLeft}s` : `${secondsLeft}s`}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  track: {
    width: '100%',
    height: 8,
    backgroundColor: COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  time: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeUrgent: {
    color: COLORS.danger,
    fontSize: 24,
  },
});

export default Timer;
