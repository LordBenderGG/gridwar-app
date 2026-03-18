import React, { useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { CellValue } from '../services/game';
import { useColors } from '../hooks/useColors';

// ─── Temas de tablero ─────────────────────────────────────────────────────────
export type BoardTheme = 'default' | 'theme_neon' | 'theme_fire' | 'theme_ice' | 'theme_matrix' | 'theme_dark' | 'theme_wood';

interface ThemeConfig {
  boardBg: string;
  boardBorder: string;
  cellBg: string;
  cellBorder: string;
  symbolX: string;
  symbolO: string;
  winningCell: string;
}

const getThemeConfigs = (COLORS: any): Record<string, ThemeConfig> => ({
  default: {
    boardBg: 'transparent',
    boardBorder: COLORS.border,
    cellBg: COLORS.surface,
    cellBorder: COLORS.border,
    symbolX: COLORS.X,
    symbolO: COLORS.O,
    winningCell: 'rgba(0,245,255,0.15)',
  },
  theme_neon: {
    boardBg: '#050518',
    boardBorder: '#00F5FF',
    cellBg: '#08082a',
    cellBorder: '#00F5FF44',
    symbolX: '#00F5FF',
    symbolO: '#FF00FF',
    winningCell: 'rgba(0,245,255,0.25)',
  },
  theme_fire: {
    boardBg: '#1a0500',
    boardBorder: '#FF6B35',
    cellBg: '#200800',
    cellBorder: '#FF6B3544',
    symbolX: '#FF4500',
    symbolO: '#FFD700',
    winningCell: 'rgba(255,107,53,0.25)',
  },
  theme_ice: {
    boardBg: '#010d18',
    boardBorder: '#89CFF0',
    cellBg: '#020f1e',
    cellBorder: '#89CFF044',
    symbolX: '#89CFF0',
    symbolO: '#ffffff',
    winningCell: 'rgba(137,207,240,0.2)',
  },
  theme_matrix: {
    boardBg: '#000300',
    boardBorder: '#00FF41',
    cellBg: '#010800',
    cellBorder: '#00FF4144',
    symbolX: '#00FF41',
    symbolO: '#00AA2A',
    winningCell: 'rgba(0,255,65,0.2)',
  },
  theme_dark: {
    boardBg: '#111',
    boardBorder: '#333',
    cellBg: '#1a1a1a',
    cellBorder: '#2a2a2a',
    symbolX: COLORS.X,
    symbolO: COLORS.O,
    winningCell: 'rgba(0,245,255,0.12)',
  },
  theme_wood: {
    boardBg: '#3E2723',
    boardBorder: '#8D6E63',
    cellBg: '#4E342E',
    cellBorder: '#6D4C41',
    symbolX: '#FFCCBC',
    symbolO: '#FFE082',
    winningCell: 'rgba(255,204,188,0.2)',
  },
});

export const getThemeConfig = (theme?: string | null, COLORS?: any): ThemeConfig => {
  const configs = getThemeConfigs(COLORS || {});
  if (!theme) return configs.default;
  return configs[theme] || configs.default;
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface BoardProps {
  board: CellValue[];
  onCellPress: (index: number) => void;
  disabled: boolean;
  confusionActive?: boolean;
  mySymbol: 'X' | 'O';
  winningCells?: number[];
  teleportMode?: boolean;
  teleportFrom?: number | null;
  theme?: string | null;
  boardSize?: number;
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
  themeConfig: ThemeConfig;
  symbolSize: number;
}> = ({ value, index, onPress, disabled, isWinning, confusionActive, mySymbol, isTeleportSelected, isTeleportTarget, themeConfig, symbolSize }) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    if (disabled) return;
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
        { backgroundColor: themeConfig.cellBg, borderColor: themeConfig.cellBorder },
        isWinning && { backgroundColor: themeConfig.winningCell },
        isTeleportSelected && [styles.teleportSelected, { borderColor: themeConfig.boardBorder }],
        isTeleportTarget && [styles.teleportTarget, { borderColor: themeConfig.boardBorder }],
      ]}
      onPress={handlePress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      <Animated.View style={animatedStyle}>
        {displayValue !== '' && (
          <Text style={[
            styles.symbol,
            { fontSize: symbolSize },
            displayValue === 'X'
              ? { color: themeConfig.symbolX, textShadowColor: themeConfig.symbolX, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 }
              : { color: themeConfig.symbolO, textShadowColor: themeConfig.symbolO, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
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
  confusionActive = false,
  mySymbol,
  winningCells = [],
  teleportMode = false,
  teleportFrom = null,
  theme,
  boardSize = 300,
}) => {
  const COLORS = useColors();
  const themeConfig = getThemeConfig(theme, COLORS);
  const symbolSize = Math.max(34, Math.round(boardSize * 0.17));

  return (
    <View style={[
      styles.board,
      { borderColor: themeConfig.boardBorder, backgroundColor: themeConfig.boardBg },
      { width: boardSize, height: boardSize },
    ]}>
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
          themeConfig={themeConfig}
          symbolSize={symbolSize}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  board: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
  },
  cell: {
    width: '33.33%',
    height: '33.33%',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  teleportSelected: {
    borderWidth: 2.5,
  },
  teleportTarget: {
    borderStyle: 'dashed',
  },
  symbol: {
    fontSize: 52,
    fontWeight: '900',
  },
  winningSymbol: {
    textShadowRadius: 20,
  },
});

export default Board;
