import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import {
  subscribeToGame, subscribeToGameDoc, makeMove,
  checkWinner, isBoardFull, finishRound, forfeitGame,
  CellValue, GameState, GameDoc,
} from '../../services/game';
import { applyWildcard } from '../../services/wildcards';
import { useAuthStore } from '../../store/authStore';
import Board from '../../components/Board';
import Timer from '../../components/Timer';
import WildcardBar from '../../components/WildcardBar';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS, TIMER_TOTAL } from '../../constants/theme';

export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [gameDoc, setGameDoc] = useState<GameDoc | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_TOTAL);
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X');
  const [winningCells, setWinningCells] = useState<number[]>([]);
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [shieldActive, setShieldActive] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shakeAnim = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  const shake = () => {
    shakeAnim.value = withSequence(
      withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }),
      withTiming(-8, { duration: 60 }), withTiming(8, { duration: 60 }),
      withTiming(0, { duration: 60 })
    );
  };

  useEffect(() => {
    if (!gameId || !user) return;
    const unsubDoc = subscribeToGameDoc(gameId, (doc) => {
      setGameDoc(doc);
      setMySymbol(doc.player1 === user.uid ? 'X' : 'O');
    });
    const unsubState = subscribeToGame(gameId, (state) => {
      setGameState(state);
      setShieldActive(state.shieldActive && state.shieldPlayer !== user.uid);
    });
    return () => { unsubDoc(); unsubState(); };
  }, [gameId, user]);

  useEffect(() => {
    if (!gameState) return;
    if (timerRef.current) clearInterval(timerRef.current);

    const turboBonus = (gameState.turboActive && gameState.turboPlayer === user?.uid) ? 15 : 0;
    const rivalTimerReduced = gameState.rivalTimerReduced && gameState.currentTurn !== user?.uid;
    const maxTime = rivalTimerReduced ? 15 : TIMER_TOTAL + turboBonus;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - gameState.timerStart) / 1000);
      const left = Math.max(0, maxTime - elapsed);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timerRef.current!);
        handleTimeUp();
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.timerStart, gameState?.currentTurn]);

  const handleTimeUp = useCallback(async () => {
    if (!gameDoc || !gameState || !user) return;
    const isMyTurn = gameState.currentTurn === user.uid;
    if (!isMyTurn) return;
    const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
    await makeMove(gameId!, -1, user.uid, mySymbol, gameState.board, opponentId, gameState.frozenPlayer);
  }, [gameDoc, gameState, user]);

  const handleCellPress = async (index: number) => {
    if (!gameDoc || !gameState || !user) return;
    if (gameState.currentTurn !== user.uid) return;
    if (gameState.frozenPlayer === user.uid) {
      Alert.alert('Congelado ❄️', 'Pierdes este turno');
      return;
    }

    const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
    await makeMove(gameId!, index, user.uid, mySymbol, gameState.board, opponentId, gameState.frozenPlayer);

    const newBoard = [...gameState.board];
    newBoard[index] = mySymbol;
    const winner = checkWinner(newBoard);
    const full = isBoardFull(newBoard);

    if (winner || full) {
      const winnerId = winner === mySymbol ? user.uid : (winner ? opponentId : null);
      const { matchWinner } = await finishRound(
        gameId!, winnerId, gameDoc.score, gameDoc.player1, gameDoc.player2
      );
      if (matchWinner) {
        router.replace({
          pathname: '/game/resultado',
          params: { gameId, winnerId: matchWinner, myUid: user.uid },
        });
      } else {
        const msg = winnerId === user.uid ? '¡Ganaste la ronda!' : winnerId ? 'Perdiste la ronda' : '¡Empate!';
        setRoundMessage(msg);
        setTimeout(() => setRoundMessage(null), 2000);
      }
    }
  };

  const handleWildcard = async (wildcardId: string) => {
    if (!gameDoc || !gameState || !user) return;
    const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
    if (shieldActive) {
      Alert.alert('🛡️ Bloqueado', 'Tu comodín fue bloqueado por el rival');
      return;
    }
    await applyWildcard(gameId!, wildcardId, user.uid, opponentId, gameState.board, user.gems);
  };

  const handleForfeit = () => {
    Alert.alert('Rendirse', '¿Seguro? Perderás la partida y serás bloqueado 3 horas.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Rendirse', style: 'destructive', onPress: async () => {
          if (!gameDoc || !user) return;
          const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
          await forfeitGame(gameId!, user.uid, opponentId);
          router.replace({
            pathname: '/game/resultado',
            params: { gameId, winnerId: opponentId, myUid: user.uid },
          });
        },
      },
    ]);
  };

  if (!gameDoc || !gameState) {
    return <View style={styles.center}><Text style={styles.loading}>Cargando partida...</Text></View>;
  }

  const isMyTurn = gameState.currentTurn === user?.uid;
  const opponentId = gameDoc.player1 === user?.uid ? gameDoc.player2 : gameDoc.player1;
  const opponentUsername = gameDoc.player1 === user?.uid ? gameDoc.player2Username : gameDoc.player1Username;
  const opponentAvatar = gameDoc.player1 === user?.uid ? gameDoc.player2Avatar : gameDoc.player1Avatar;
  const myScore = gameDoc.score[user?.uid || ''] || 0;
  const opponentScore = gameDoc.score[opponentId] || 0;

  const isBlind = gameState.blindActive && gameState.blindTarget === user?.uid;
  const isConfused = gameState.confusionActive && gameState.confusionTarget === user?.uid;

  return (
    <Animated.View style={[styles.container, shakeStyle]}>
      {/* Ronda y marcador */}
      <View style={styles.scoreRow}>
        <Text style={styles.roundText}>Ronda {gameDoc.round} / 3</Text>
        <Text style={styles.score}>{myScore} - {opponentScore}</Text>
      </View>

      {/* Jugadores */}
      <View style={styles.playersRow}>
        <View style={[styles.playerInfo, isMyTurn && styles.activeTurn]}>
          <Image
            source={user?.photoURL ? { uri: user.photoURL } : AVATARS[user?.avatar || 'avatar_1']}
            style={styles.playerAvatar}
          />
          <Text style={styles.playerName}>{user?.username}</Text>
          <Text style={[styles.symbolLabel, { color: COLORS.X }]}>X</Text>
          {isMyTurn && <Text style={styles.turnIndicator}>TU TURNO</Text>}
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={[styles.playerInfo, !isMyTurn && styles.activeTurn]}>
          <Image
            source={AVATARS[opponentAvatar] || AVATARS['avatar_1']}
            style={styles.playerAvatar}
          />
          <Text style={styles.playerName}>{opponentUsername}</Text>
          <Text style={[styles.symbolLabel, { color: COLORS.O }]}>O</Text>
          {!isMyTurn && <Text style={styles.turnIndicator}>SU TURNO</Text>}
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Timer
          secondsLeft={secondsLeft}
          isMyTurn={isMyTurn}
          turboActive={gameState.turboActive && gameState.turboPlayer === user?.uid}
        />
      </View>

      {/* Mensaje de ronda */}
      {roundMessage && (
        <View style={styles.roundMessage}>
          <Text style={styles.roundMessageText}>{roundMessage}</Text>
        </View>
      )}

      {/* Tablero */}
      <View style={styles.boardContainer}>
        <Board
          board={gameState.board}
          onCellPress={handleCellPress}
          disabled={!isMyTurn}
          blindActive={isBlind}
          confusionActive={isConfused}
          mySymbol={mySymbol}
          winningCells={winningCells}
        />
      </View>

      {/* Comodines */}
      <View style={styles.wildcardsContainer}>
        <WildcardBar
          playerGems={user?.gems || 0}
          wildcardUsed={gameState.wildcardUsed}
          isMyTurn={isMyTurn}
          shieldActive={shieldActive}
          onUseWildcard={handleWildcard}
        />
      </View>

      {/* Rendirse */}
      <TouchableOpacity style={styles.forfeitBtn} onPress={handleForfeit}>
        <Text style={styles.forfeitText}>Rendirse</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loading: { color: COLORS.textSecondary, fontSize: 16 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  roundText: { color: COLORS.textSecondary, fontSize: 13 },
  score: { color: COLORS.text, fontSize: 22, fontWeight: '900' },
  playersRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  playerInfo: {
    alignItems: 'center', flex: 1,
    padding: 8, borderRadius: 12,
    borderWidth: 1, borderColor: 'transparent',
  },
  activeTurn: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,245,255,0.05)' },
  playerAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 4 },
  playerName: { color: COLORS.text, fontSize: 12, fontWeight: 'bold' },
  symbolLabel: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  turnIndicator: { color: COLORS.primary, fontSize: 9, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 },
  vs: { color: COLORS.textSecondary, fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 },
  timerContainer: { marginBottom: 16 },
  boardContainer: { alignItems: 'center', marginBottom: 16 },
  wildcardsContainer: { marginBottom: 12 },
  forfeitBtn: { alignSelf: 'center', padding: 8 },
  forfeitText: { color: COLORS.danger, fontSize: 13, opacity: 0.7 },
  roundMessage: {
    position: 'absolute', top: '45%', left: 0, right: 0,
    alignItems: 'center', zIndex: 100,
  },
  roundMessageText: {
    backgroundColor: COLORS.surface, color: COLORS.primary,
    fontSize: 20, fontWeight: 'bold', padding: 16,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary,
    textAlign: 'center',
  },
});
