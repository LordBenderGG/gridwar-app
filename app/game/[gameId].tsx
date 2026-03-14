import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import {
  subscribeToGame, subscribeToGameDoc, makeMove, skipTurn,
  checkWinner, isBoardFull, finishRound, forfeitGame,
  CellValue, GameState, GameDoc,
} from '../../services/game';
import { applyWildcard, applyTeleportMove } from '../../services/wildcards';
import { useAuthStore } from '../../store/authStore';
import Board from '../../components/Board';
import Timer from '../../components/Timer';
import WildcardBar from '../../components/WildcardBar';
import { AVATARS } from '../../components/AvatarPicker';
import { COLORS, TIMER_TOTAL } from '../../constants/theme';

// Mensaje temporal que aparece en pantalla cuando el rival activa un comodín
interface WildcardAlert {
  message: string;
  color: string;
}

export default function GameScreen() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const router = useRouter();
  const { user } = useAuthStore();

  const [gameDoc, setGameDoc] = useState<GameDoc | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_TOTAL);
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X');
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [wildcardAlert, setWildcardAlert] = useState<WildcardAlert | null>(null);

  // ── Teletransporte ────────────────────────────────────────────────────
  // teleportMode: true cuando el jugador activó el comodín y debe elegir
  // origen (propia ficha) y luego destino (celda libre).
  const [teleportMode, setTeleportMode] = useState(false);
  const [teleportFrom, setTeleportFrom] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRoundRef = useRef(false);
  const shakeAnim = useSharedValue(0);
  // Guardamos la versión anterior de gameState para detectar cambios de flags
  const prevGameStateRef = useRef<GameState | null>(null);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  // ── Mostrar alerta visual de comodín ─────────────────────────────────
  const showWildcardAlert = (message: string, color: string) => {
    setWildcardAlert({ message, color });
    setTimeout(() => setWildcardAlert(null), 2500);
  };

  // ── Suscripción al GameDoc (Firestore) ───────────────────────────────
  useEffect(() => {
    if (!gameId || !user) return;
    const unsubDoc = subscribeToGameDoc(gameId, (docData) => {
      setGameDoc(docData);
      setMySymbol(docData.player1 === user.uid ? 'X' : 'O');
      if (docData.status === 'finished' && docData.winner) {
        router.replace({
          pathname: '/game/resultado',
          params: { gameId, winnerId: docData.winner, myUid: user.uid },
        });
      }
    });
    return () => unsubDoc();
  }, [gameId, user?.uid]);

  // ── Suscripción al GameState (Realtime Database) ─────────────────────
  useEffect(() => {
    if (!gameId || !user) return;
    const unsubState = subscribeToGame(gameId, (state) => {
      const prev = prevGameStateRef.current;

      // Detectar cambios de flags para mostrar feedback al jugador afectado
      if (prev && user) {
        // Rival activó freeze → yo soy el rival congelado
        if (!prev.frozenPlayer && state.frozenPlayer === user.uid) {
          showWildcardAlert('❄️ ¡Te congelaron! Pierdes este turno', '#00BFFF');
        }
        // Rival activó time_reduce → aplica a mi próximo turno
        if (!prev.rivalTimerReduced && state.rivalTimerReduced && state.currentTurn !== user.uid) {
          showWildcardAlert('⏱️ ¡Tu rival redujo tu tiempo a 15s!', '#FF6B35');
        }
        // Rival activó blind → yo soy el objetivo
        if (!prev.blindActive && state.blindActive && state.blindTarget === user.uid) {
          showWildcardAlert('🙈 ¡Tablero oculto este turno!', '#9B59B6');
        }
        // Rival activó confusion → yo soy el objetivo
        if (!prev.confusionActive && state.confusionActive && state.confusionTarget === user.uid) {
          showWildcardAlert('😵 ¡Confusión! Las fichas están invertidas', '#FF69B4');
        }
        // Rival activó shield → yo tengo escudo activo en su contra
        if (!prev.shieldActive && state.shieldActive && state.shieldPlayer !== user.uid) {
          showWildcardAlert('🛡️ ¡El rival activó un escudo!', '#34C759');
        }
        // Rival activó sabotage → detectado por cambio en board con sus fichas movidas
        // (difícil detectar directamente; se muestra en el tablero visualmente)

        // Turbo activado por mí → confirmar visualmente
        if (!prev.turboActive && state.turboActive && state.turboPlayer === user.uid) {
          showWildcardAlert('⚡ ¡Turbo! Timer reiniciado a 30s', '#FFD700');
        }
      }

      setGameState(state);
      setShieldActive(state.shieldActive && state.shieldPlayer !== user.uid);
      finishingRoundRef.current = false;
      prevGameStateRef.current = state;

      // Si el teleport fue completado por el servidor (teleportPending=false),
      // salir del modo teleport local
      if (!state.teleportPending) {
        setTeleportMode(false);
        setTeleportFrom(null);
      }
    });
    return () => unsubState();
  }, [gameId, user?.uid]);

  // ── Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || !user) return;
    if (timerRef.current) clearInterval(timerRef.current);

    // turbo reinicia timerStart en RTDB, por lo que timerStart ya está actualizado.
    // Solo necesitamos calcular maxTime según los flags del estado actual.
    const isMyTurn = gameState.currentTurn === user.uid;
    const turboBonus = (gameState.turboActive && gameState.turboPlayer === user.uid) ? 15 : 0;
    const rivalReducedForMe = gameState.rivalTimerReduced && isMyTurn;
    const maxTime = rivalReducedForMe ? 15 : TIMER_TOTAL + turboBonus;

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - gameState.timerStart) / 1000);
      const left = Math.max(0, maxTime - elapsed);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timerRef.current!);
        if (isMyTurn) {
          handleTimeUp(gameState);
        }
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.timerStart, gameState?.currentTurn, gameState?.turboActive, gameState?.rivalTimerReduced]);

  const handleTimeUp = async (state: GameState) => {
    if (!gameDoc || !user) return;
    const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
    await skipTurn(gameId!, opponentId);
  };

  const resolveRound = useCallback(async (
    newBoard: CellValue[],
    currentGameDoc: GameDoc,
  ) => {
    if (finishingRoundRef.current) return;
    finishingRoundRef.current = true;

    const winner = checkWinner(newBoard);
    const full = isBoardFull(newBoard);
    if (!winner && !full) {
      finishingRoundRef.current = false;
      return;
    }

    const opponentId = currentGameDoc.player1 === user!.uid
      ? currentGameDoc.player2
      : currentGameDoc.player1;
    const winnerId = winner
      ? (winner === (currentGameDoc.player1 === user!.uid ? 'X' : 'O') ? user!.uid : opponentId)
      : null;

    const { matchWinner } = await finishRound(
      gameId!,
      winnerId,
      currentGameDoc.score,
      currentGameDoc.player1,
      currentGameDoc.player2
    );

    if (matchWinner) {
      router.replace({
        pathname: '/game/resultado',
        params: { gameId, winnerId: matchWinner, myUid: user!.uid },
      });
    } else {
      const msg = winnerId === user!.uid ? '¡Ganaste la ronda!' : winnerId ? 'Perdiste la ronda' : '¡Empate!';
      setRoundMessage(msg);
      setTimeout(() => setRoundMessage(null), 2000);
    }
  }, [gameId, user?.uid]);

  // ── Presionar celda del tablero ───────────────────────────────────────
  const handleCellPress = async (index: number) => {
    if (!gameDoc || !gameState || !user) return;
    if (gameState.currentTurn !== user.uid) return;
    if (finishingRoundRef.current) return;

    // ── Modo teletransporte activo ──
    if (teleportMode) {
      if (teleportFrom === null) {
        // Primera selección: debe ser una ficha propia
        if (gameState.board[index] === mySymbol) {
          setTeleportFrom(index);
        } else {
          Alert.alert('Teletransporte 🌀', 'Toca una de TUS fichas para moverla');
        }
        return;
      } else {
        // Segunda selección: debe ser una celda vacía
        if (gameState.board[index] !== '') {
          Alert.alert('Teletransporte 🌀', 'Toca una celda VACÍA como destino');
          return;
        }
        // Ejecutar el teleport
        await applyTeleportMove(gameId!, gameState.board, teleportFrom, index, mySymbol);
        setTeleportMode(false);
        setTeleportFrom(null);
        // El jugador aún tiene su turno para hacer el movimiento normal
        return;
      }
    }

    // ── Jugador congelado ──
    if (gameState.frozenPlayer === user.uid) {
      Alert.alert('Congelado ❄️', 'Pierdes este turno');
      const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
      await skipTurn(gameId!, opponentId);
      return;
    }

    const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;
    await makeMove(gameId!, index, user.uid, mySymbol, gameState.board, opponentId, gameState.frozenPlayer);

    const newBoard = [...gameState.board];
    newBoard[index] = mySymbol;
    await resolveRound(newBoard, gameDoc);
  };

  // ── Usar comodín ──────────────────────────────────────────────────────
  const handleWildcard = async (wildcardId: string) => {
    if (!gameDoc || !gameState || !user) return;

    // Escudo activo: el rival bloqueó el comodín
    if (shieldActive) {
      Alert.alert('🛡️ Bloqueado', 'El rival activó un escudo. Tu comodín fue bloqueado.');
      return;
    }

    const opponentId = gameDoc.player1 === user.uid ? gameDoc.player2 : gameDoc.player1;

    // Si el jugador activa teletransporte, entrar en modo selección local
    if (wildcardId === 'teleport') {
      await applyWildcard(gameId!, wildcardId, user.uid, opponentId, gameState.board, user.gems, mySymbol);
      setTeleportMode(true);
      setTeleportFrom(null);
      Alert.alert('Teletransporte 🌀', 'Toca una de tus fichas para moverla, luego toca la celda destino');
      return;
    }

    await applyWildcard(gameId!, wildcardId, user.uid, opponentId, gameState.board, user.gems, mySymbol);
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
          <Text style={[styles.symbolLabel, { color: COLORS.X }]}>{mySymbol}</Text>
          {isMyTurn && <Text style={styles.turnIndicator}>TU TURNO</Text>}
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={[styles.playerInfo, !isMyTurn && styles.activeTurn]}>
          <Image
            source={AVATARS[opponentAvatar] || AVATARS['avatar_1']}
            style={styles.playerAvatar}
          />
          <Text style={styles.playerName}>{opponentUsername}</Text>
          <Text style={[styles.symbolLabel, { color: COLORS.O }]}>
            {mySymbol === 'X' ? 'O' : 'X'}
          </Text>
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

      {/* Alerta de comodín del rival */}
      {wildcardAlert && (
        <View style={[styles.wildcardAlertBox, { borderColor: wildcardAlert.color }]}>
          <Text style={[styles.wildcardAlertText, { color: wildcardAlert.color }]}>
            {wildcardAlert.message}
          </Text>
        </View>
      )}

      {/* Indicador modo teletransporte */}
      {teleportMode && (
        <View style={styles.teleportBanner}>
          <Text style={styles.teleportBannerText}>
            {teleportFrom === null
              ? '🌀 Toca una de tus fichas para moverla'
              : '🌀 Ahora toca la celda destino (vacía)'}
          </Text>
        </View>
      )}

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
          disabled={!isMyTurn || finishingRoundRef.current}
          blindActive={isBlind}
          confusionActive={isConfused}
          mySymbol={mySymbol}
          winningCells={[]}
          teleportMode={teleportMode}
          teleportFrom={teleportFrom}
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
  timerContainer: { marginBottom: 8 },
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
  wildcardAlertBox: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  wildcardAlertText: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  teleportBanner: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#00F5FF',
    backgroundColor: 'rgba(0,245,255,0.08)',
    alignItems: 'center',
  },
  teleportBannerText: {
    color: '#00F5FF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
