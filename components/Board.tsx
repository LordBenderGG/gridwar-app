import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CellValue } from '../services/game';
import { COLORS } from '../constants/theme';

interface BoardProps {
  board: CellValue[];
  onCellPress: (index: number) => void;
  disabled: boolean;
  blindActive?: boolean;
  confusionActive?: boolean;
  mySymbol: 'X' | 'O';
  winningCells?: number[];
  teleportMode?: boolean;
  teleportFrom?: number | null;
}

const AnimatedCell: React.FC<{
  value: CellValue;
  index: number;
  onPress: (i: number) => void;
  disabled: boolean;
  isWinning: boolean;
  confusionActive: boolean;
  mySymbol: 'X' | 'O';
  isTeleportSelected: boolean;
  isTeleportTarget: boolean;
}> = ({ value, index, onPress, disabled, isWinning, confusionActive, mySymbol, isTeleportSelected, isTeleportTarget }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
    // En modo teleport: la celda de origen (ficha propia) es presionable aunque no esté vacía
    // La lógica de si es válida la maneja gameId.tsx
    if (value !== '' && !isTeleportSelected) return;
    scale.value = withSequence(withSpring(0.85), withSpring(1));
    onPress(index);
  };

  const displayValue = confusionActive && value !== ''
    ? value === 'X' ? 'O' : 'X'
    : value;

  return (
    <TouchableOpacity
      style={[
        styles.cell,
        isWinning && styles.winningCell,
        isTeleportSelected && styles.teleportSelected,
        isTeleportTarget && styles.teleportTarget,
      ]}
      onPress={handlePress}
      disabled={disabled || (value !== '' && !isTeleportSelected)}
      activeOpacity={0.7}
    >
      <Animated.View style={animatedStyle}>
        {displayValue !== '' && (
          <Text style={[
            styles.symbol,
            displayValue === 'X' ? styles.symbolX : styles.symbolO,
            isWinning && styles.winningSymbol,
          ]}>
            {displayValue}
          </Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const Board: React.FC<BoardProps> = ({
  board,
  onCellPress,
  disabled,
  blindActive = false,
  confusionActive = false,
  mySymbol,
  winningCells = [],
  teleportMode = false,
  teleportFrom = null,
}) => {
  if (blindActive) {
    return (
      <View style={styles.board}>
        <View style={styles.blindOverlay}>
          <Text style={styles.blindText}>🙈</Text>
          <Text style={styles.blindSubText}>Tablero oculto...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.board}>
      {board.map((cell, index) => (
        <AnimatedCell
          key={index}
          value={cell}
          index={index}
          onPress={onCellPress}
          disabled={disabled}
          isWinning={winningCells.includes(index)}
          confusionActive={confusionActive}
          mySymbol={mySymbol}
          isTeleportSelected={teleportMode && teleportFrom === index}
          isTeleportTarget={teleportMode && teleportFrom !== null && cell === ''}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    width: 300,
    height: 300,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  cell: {
    width: '33.33%',
    height: '33.33%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  winningCell: {
    backgroundColor: 'rgba(0, 245, 255, 0.15)',
  },
  teleportSelected: {
    backgroundColor: 'rgba(0, 245, 255, 0.35)',
    borderColor: '#00F5FF',
    borderWidth: 2.5,
  },
  teleportTarget: {
    backgroundColor: 'rgba(0, 245, 255, 0.08)',
    borderColor: '#00F5FF',
    borderStyle: 'dashed',
  },
  symbol: {
    fontSize: 52,
    fontWeight: '900',
  },
  symbolX: {
    color: COLORS.X,
    textShadowColor: COLORS.X,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  symbolO: {
    color: COLORS.O,
    textShadowColor: COLORS.O,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  winningSymbol: {
    textShadowRadius: 20,
  },
  blindOverlay: {
    flex: 1,
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  blindText: {
    fontSize: 60,
  },
  blindSubText: {
    color: COLORS.textSecondary,
    marginTop: 8,
    fontSize: 14,
  },
});

export default Board;
