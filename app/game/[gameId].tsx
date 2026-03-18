import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { Animated as RNAnimated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ref, onValue, get, update } from 'firebase/database';
import { rtdb, auth } from '../../services/firebase';
import {
  subscribeToGame, subscribeToGameDoc, makeMove, skipTurn,
  checkWinner, isBoardFull, finishRound, forfeitGame, finishNoCombatChallenge,
  CellValue, GameState, GameDoc, applyEarthquakeBoard, sendChatEmoji,
} from '../../services/game';
import { applyWildcard, applyTeleportMove } from '../../services/wildcards';
import { updateMissionProgress } from '../../services/missions';
import { useAuthStore } from '../../store/authStore';
import Board from '../../components/Board';
import Timer from '../../components/Timer';
import WildcardBar from '../../components/WildcardBar';
import { AVATARS } from '../../components/AvatarPicker';
import { resolveFrameColor, resolveNameColor } from '../../components/PlayerCard';
import { useColors } from '../../hooks/useColors';
import { TIMER_TOTAL } from '../../constants/theme';
import { playSound } from '../../services/sound';
import '../../i18n';

// Mensaje temporal que aparece en pantalla cuando el rival activa un comodín
interface WildcardAlert {
  message: string;
  color: string;
}

export default function GameScreen() {
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { gameId, myUid: routeUidParam } = useLocalSearchParams<{ gameId: string; myUid?: string }>();
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const { t } = useTranslation();

  const [gameDoc, setGameDoc] = useState<GameDoc | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loadStuck, setLoadStuck] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_TOTAL);
  const [timerMax, setTimerMax] = useState(TIMER_TOTAL);
  const [mySymbol, setMySymbol] = useState<'X' | 'O'>('X');
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [shieldActive, setShieldActive] = useState(false);
  const [wildcardAlert, setWildcardAlert] = useState<WildcardAlert | null>(null);
  const [moveDebug, setMoveDebug] = useState<string>('');

  // ── Teletransporte ────────────────────────────────────────────────────
  // teleportMode: true cuando el jugador activó el comodín y debe elegir
  // origen (propia ficha) y luego destino (celda libre).
  const [teleportMode, setTeleportMode] = useState(false);
  const [teleportFrom, setTeleportFrom] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownLastSecRef = useRef<number>(-1);
  const finishingRoundRef = useRef(false);
  const roundUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const frozenSkipInProgressRef = useRef(false); // evita doble skipTurn cuando congelado
  const turnSkipInProgressRef = useRef(false);
  const noCombatClosingRef = useRef(false);
  const shakeAnim = useSharedValue(0);
  const boardShakeAnim = useSharedValue(0);
  // Guardamos la versión anterior de gameState para detectar cambios de flags
  const prevGameStateRef = useRef<GameState | null>(null);
  // Ref para saber si el modo teleport fue activado localmente (evitar reset por RTDB)
  const teleportModeRef = useRef(false);
  // Ref del gameDoc para acceder al valor más reciente dentro de callbacks/effects
  const gameDocRef = useRef<GameDoc | null>(null);
  const gameStateRef = useRef<GameState | null>(null);

  // ── Chat emojis (Fase 1B) ─────────────────────────────────────────────
  const CHAT_EMOJIS = ['😂', '💀', '🤡', '😎', '🔥', '👏', '😴', '🫵'];
  // Emoji flotante sobre avatar del emisor
  const [floatingEmoji, setFloatingEmoji] = useState<{ emoji: string; isMine: boolean } | null>(null);
  const emojiFloatAnim = useRef(new RNAnimated.Value(0)).current;
  const emojiOpacityAnim = useRef(new RNAnimated.Value(0)).current;

  const routeUid = typeof routeUidParam === 'string' ? routeUidParam : '';
  const authUid = auth.currentUser?.uid || '';
  const storeUid = user?.uid || '';
  const sessionUid = authUid || storeUid || '';
  const candidateUids = useMemo(
    () => [sessionUid, routeUid].filter((v, i, arr) => !!v && arr.indexOf(v) === i),
    [sessionUid, routeUid]
  );
  const myUid = useMemo(() => {
    if (!gameDoc) return candidateUids[0] || '';
    const match = candidateUids.find((id) => id === gameDoc.player1 || id === gameDoc.player2);
    if (match) return match;
    return '';
  }, [candidateUids, gameDoc?.player1, gameDoc?.player2]);
  const lastChatTsRef = useRef<number>(0);

  const showFloatingEmoji = (emoji: string, isMine: boolean) => {
    emojiFloatAnim.setValue(0);
    emojiOpacityAnim.setValue(1);
    setFloatingEmoji({ emoji, isMine });
    RNAnimated.parallel([
      RNAnimated.timing(emojiFloatAnim, { toValue: -50, duration: 2000, useNativeDriver: true }),
      RNAnimated.sequence([
        RNAnimated.delay(1200),
        RNAnimated.timing(emojiOpacityAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ]),
    ]).start(() => setFloatingEmoji(null));
  };

  // Suscripción al campo chat en RTDB
  useEffect(() => {
    if (!gameId || !myUid) return;
    const chatRef = ref(rtdb, `games/${gameId}/chat`);
    const unsub = onValue(chatRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.val() as { uid: string; emoji: string; ts: number };
      if (!data?.emoji || !data?.ts) return;
      if (data.ts <= lastChatTsRef.current) return;
      lastChatTsRef.current = data.ts;
      const isMine = data.uid === myUid;
      showFloatingEmoji(data.emoji, isMine);
    });
    return () => unsub();
  }, [gameId, myUid]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeAnim.value }],
  }));

  const boardShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: boardShakeAnim.value }],
  }));

  // ── Mostrar alerta visual de comodín ─────────────────────────────────
  const showWildcardAlert = (message: string, color: string) => {
    setWildcardAlert({ message, color });
    setTimeout(() => setWildcardAlert(null), 2500);
  };

  const showMoveDebug = (reason: string) => {
    setMoveDebug(reason);
  };

  const computeTurnDuration = (state: GameState) => {
    const turboBonus = state.turboActive && state.turboPlayer === myUid ? 10 : 0;
    const rivalReducedForMe =
      state.rivalTimerReduced
      && (!state.rivalTimerReducedTarget || state.rivalTimerReducedTarget === myUid);
    return rivalReducedForMe ? 15 : TIMER_TOTAL + turboBonus;
  };

  // ── Suscripción al GameDoc (Firestore) ───────────────────────────────
  useEffect(() => {
    if (!gameId || !myUid) return;
    const unsubDoc = subscribeToGameDoc(gameId, (docData) => {
      setGameDoc(docData);
      gameDocRef.current = docData;
      setMySymbol(docData.player1 === myUid ? 'X' : 'O');
      if (docData.status === 'finished') {
        router.replace({
          pathname: '/game/resultado',
          params: {
            gameId,
            winnerId: docData.winner || '',
            myUid,
            endReason: docData.endReason || 'normal',
          },
        });
      }
    });
    return () => unsubDoc();
  }, [gameId, myUid]);

  // ── Suscripción al GameState (Realtime Database) ─────────────────────
  useEffect(() => {
    if (!gameId || !myUid) return;
    const unsubState = subscribeToGame(gameId, (state) => {
      const prev = prevGameStateRef.current;

      // Detectar cambios de flags para mostrar feedback al jugador afectado
      if (prev) {
        // Rival activó time_reduce → aplica a mi próximo turno
        if (
          !prev.rivalTimerReduced
          && state.rivalTimerReduced
          && (!state.rivalTimerReducedTarget || state.rivalTimerReducedTarget === myUid)
        ) {
          showWildcardAlert(t('game.alertTimerReduced'), '#FF6B35');
        }
        // Rival activó confusion → yo soy el objetivo
        if (!prev.confusionActive && state.confusionActive && state.confusionTarget === myUid) {
          showWildcardAlert(t('game.alertConfusion'), '#FF69B4');
        }
        // Rival activó shield → yo tengo escudo activo en su contra
        if (!prev.shieldActive && state.shieldActive && state.shieldPlayer !== myUid) {
          showWildcardAlert(t('game.alertShieldRival'), '#34C759');
        }
        // Turbo activado por mí → confirmar visualmente
        if (!prev.turboActive && state.turboActive && state.turboPlayer === myUid) {
          showWildcardAlert(t('game.alertTurbo'), '#FFD700');
        }
      }

      setGameState(state);
      gameStateRef.current = state;
      setShieldActive(state.shieldActive && state.shieldPlayer !== myUid);
      // Solo resetear finishingRoundRef cuando cambia el turno activo
      // (indica que la ronda fue procesada y comenzó una nueva).
      if (prev && prev.currentTurn !== state.currentTurn) {
        finishingRoundRef.current = false;
        turnSkipInProgressRef.current = false;
        if (roundUnlockTimeoutRef.current) {
          clearTimeout(roundUnlockTimeoutRef.current);
          roundUnlockTimeoutRef.current = null;
        }
      }

      const boardWasReset =
        Array.isArray(state.board)
        && state.board.every((cell) => cell === '')
        && state.lastMove === null;
      if (boardWasReset) {
        finishingRoundRef.current = false;
        if (roundUnlockTimeoutRef.current) {
          clearTimeout(roundUnlockTimeoutRef.current);
          roundUnlockTimeoutRef.current = null;
        }
      }
      prevGameStateRef.current = state;

      // Auto-saltar turno si estoy congelado (sin esperar que toque el tablero)
      if (state.frozenPlayer === myUid && state.currentTurn === myUid && gameDocRef.current) {
        if (!frozenSkipInProgressRef.current) {
          frozenSkipInProgressRef.current = true;
          showWildcardAlert(t('game.alertFrozen'), '#00BFFF');
          const doc = gameDocRef.current;
          const opponentId = doc.player1 === myUid ? doc.player2 : doc.player1;
          setTimeout(() => {
            skipTurn(gameId!, opponentId, state, myUid, { trackIdleTimeout: false }).finally(() => {
              frozenSkipInProgressRef.current = false;
            });
          }, 1500);
        }
      }

      // Solo salir del modo teleport si el servidor confirma que ya fue ejecutado
      // y el teleport NO fue iniciado por nosotros (es decir, fue completado)
      if (!state.teleportPending && !teleportModeRef.current) {
        setTeleportMode(false);
        setTeleportFrom(null);
      }

    });
    return () => unsubState();
  }, [gameId, myUid]);

  useEffect(() => {
    finishingRoundRef.current = false;
    if (roundUnlockTimeoutRef.current) {
      clearTimeout(roundUnlockTimeoutRef.current);
      roundUnlockTimeoutRef.current = null;
    }
  }, [gameDoc?.round]);

  useEffect(() => {
    return () => {
      if (roundUnlockTimeoutRef.current) clearTimeout(roundUnlockTimeoutRef.current);
    };
  }, []);

  // Reset fuerte al entrar a un gameId nuevo (evita locks residuales entre partidas).
  useEffect(() => {
    finishingRoundRef.current = false;
    frozenSkipInProgressRef.current = false;
    prevGameStateRef.current = null;
    gameDocRef.current = null;
    gameStateRef.current = null;
    turnSkipInProgressRef.current = false;
    noCombatClosingRef.current = false;
    if (roundUnlockTimeoutRef.current) {
      clearTimeout(roundUnlockTimeoutRef.current);
      roundUnlockTimeoutRef.current = null;
    }
    teleportModeRef.current = false;
    setTeleportMode(false);
    setTeleportFrom(null);
    setRoundMessage(null);
    setWildcardAlert(null);
    setMoveDebug('');
  }, [gameId]);

  useEffect(() => {
    if (!gameId || !gameDoc || !gameState) return;
    if (noCombatClosingRef.current) return;
    const noMovesDetected =
      gameState.lastMove === null
      || (Array.isArray(gameState.board) && gameState.board.every((c) => c === ''));

    const shouldFinishNoCombat =
      gameDoc.type !== 'tournament'
      && gameDoc.round === 1
      && noMovesDetected
      && Number(gameState.idleTimeoutCount || 0) >= 2
      && gameDoc.status !== 'finished';

    if (!shouldFinishNoCombat) return;

    noCombatClosingRef.current = true;
    finishNoCombatChallenge(gameId, gameDoc.player1, gameDoc.player2)
      .catch(() => {})
      .finally(() => {
        noCombatClosingRef.current = false;
      });
  }, [gameId, gameDoc?.type, gameDoc?.round, gameDoc?.status, gameDoc?.player1, gameDoc?.player2, gameState?.idleTimeoutCount, gameState?.lastMove]);

  useEffect(() => {
    if (!gameId || !gameDoc || !gameState) return;
    if (noCombatClosingRef.current) return;
    if (gameDoc.type === 'tournament') return;
    if (gameDoc.round !== 1) return;
    if (gameDoc.status === 'finished') return;
    const noMovesDetected =
      gameState.lastMove === null
      || (Array.isArray(gameState.board) && gameState.board.every((c) => c === ''));
    if (!noMovesDetected) return;

    const idleCount = Number(gameState.idleTimeoutCount || 0);
    if (idleCount < 1) return;

    // Fallback: si ya hubo al menos 1 timeout registrado y el turno actual
    // tambien vencio por reloj, cerrar por no combate aunque ese segundo skip
    // no haya sido procesado por el cliente propietario del turno.
    const turnDuration = computeTurnDuration(gameState);
    const elapsed = Date.now() - Number(gameState.timerStart || 0);
    if (elapsed < turnDuration + 1200) return;

    noCombatClosingRef.current = true;
    finishNoCombatChallenge(gameId, gameDoc.player1, gameDoc.player2)
      .catch(() => {})
      .finally(() => {
        noCombatClosingRef.current = false;
      });
  }, [gameId, gameDoc?.type, gameDoc?.round, gameDoc?.status, gameDoc?.player1, gameDoc?.player2, gameState?.idleTimeoutCount, gameState?.lastMove, gameState?.timerStart, gameState?.rivalTimerReduced, gameState?.rivalTimerReducedTarget, gameState?.currentTurn]);

  useEffect(() => {
    if (gameDoc && gameState) {
      setLoadStuck(false);
      return;
    }
    const timer = setTimeout(() => {
      if (!gameDoc || !gameState) setLoadStuck(true);
    }, 7000);
    return () => clearTimeout(timer);
  }, [gameDoc, gameState]);

  // ── Terremoto: animación + reubicar fichas del rival ─────────────────
  useEffect(() => {
    if (!gameState || !myUid || !gameId) return;
    const isMyTurn = gameState.currentTurn === myUid;
    if (!isMyTurn || !gameState.earthquakeActive || gameState.earthquakeTarget !== myUid) return;

    // Animación de sacudida intensa del tablero
    boardShakeAnim.value = withSequence(
      withTiming(-18, { duration: 60 }),
      withTiming(18, { duration: 60 }),
      withTiming(-14, { duration: 60 }),
      withTiming(14, { duration: 60 }),
      withTiming(-10, { duration: 60 }),
      withTiming(10, { duration: 60 }),
      withTiming(-6, { duration: 60 }),
      withTiming(6, { duration: 60 }),
      withTiming(0, { duration: 60 }),
    );

    // Reubicar fichas del rival aleatoriamente (mis fichas quedan intactas)
    const opponentSymbol: CellValue = mySymbol === 'X' ? 'O' : 'X';
    const newBoard = [...gameState.board];
    const opponentPositions = newBoard.map((v, i) => v === opponentSymbol ? i : -1).filter(i => i !== -1);
    const emptyPositions = newBoard.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);

    if (opponentPositions.length > 0 && emptyPositions.length > 0) {
      // Quitar las fichas del rival
      opponentPositions.forEach(i => { newBoard[i] = ''; });
      // Mezclar posiciones disponibles (vacías + donde estaban las fichas del rival)
      const availablePositions = [...emptyPositions, ...opponentPositions];
      // Shuffle Fisher-Yates
      for (let i = availablePositions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availablePositions[i], availablePositions[j]] = [availablePositions[j], availablePositions[i]];
      }
      // Colocar fichas del rival en nuevas posiciones aleatorias
      opponentPositions.forEach((_, idx) => {
        newBoard[availablePositions[idx]] = opponentSymbol;
      });

      // Actualizar tablero en RTDB después de la animación
      setTimeout(async () => {
        await applyEarthquakeBoard(gameId!, newBoard);
      }, 400);
    }

    showWildcardAlert(t('game.alertEarthquake'), '#FF8C00');
  }, [gameState?.earthquakeActive, gameState?.currentTurn]);

  // ── Timer ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!gameState || !myUid) return;
    if (timerRef.current) clearInterval(timerRef.current);
    countdownLastSecRef.current = -1;

    // turbo reinicia timerStart en RTDB, por lo que timerStart ya está actualizado.
    // Solo necesitamos calcular maxTime según los flags del estado actual.
    const isMyTurn = gameState.currentTurn === myUid;
    const turboBonus = (gameState.turboActive && gameState.turboPlayer === myUid) ? 15 : 0;
    const rivalReducedForMe =
      gameState.rivalTimerReduced
      && isMyTurn
      && (gameState.rivalTimerReducedTarget ? gameState.rivalTimerReducedTarget === myUid : true);
    const maxTime = rivalReducedForMe ? 15 : TIMER_TOTAL + turboBonus;
    setTimerMax(maxTime);

    const updateTimer = () => {
      const elapsed = Math.floor((Date.now() - gameState.timerStart) / 1000);
      const left = Math.max(0, maxTime - elapsed);
      setSecondsLeft(left);
      if (left <= 5 && left > 0 && isMyTurn && left !== countdownLastSecRef.current) {
        countdownLastSecRef.current = left;
        playSound('countdown');
      }
      if (left === 0 && gameState.currentTurn === myUid) {
        clearInterval(timerRef.current!);
        handleTimeUp(gameState);
      }
    };

    updateTimer();
    timerRef.current = setInterval(updateTimer, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.timerStart, gameState?.currentTurn, gameState?.turboActive, gameState?.rivalTimerReduced]);

  const handleTimeUp = async (state: GameState) => {
    if (!gameId || !gameDocRef.current || !state.currentTurn || turnSkipInProgressRef.current) return;
    if (state.currentTurn !== myUid) return;

    const timedOutPlayer = state.currentTurn;
    const doc = gameDocRef.current;
    if (timedOutPlayer !== doc.player1 && timedOutPlayer !== doc.player2) return;

    const noMovesDetected =
      state.lastMove === null
      || (Array.isArray(state.board) && state.board.every((c) => c === ''));

    const directNoCombatClose =
      doc.type !== 'tournament'
      && doc.round === 1
      && noMovesDetected
      && Number(state.idleTimeoutCount || 0) >= 1;

    if (directNoCombatClose) {
      turnSkipInProgressRef.current = true;
      try {
        await finishNoCombatChallenge(gameId, doc.player1, doc.player2).catch(() => {});
      } finally {
        turnSkipInProgressRef.current = false;
      }
      return;
    }

    const opponentId = doc.player1 === timedOutPlayer ? doc.player2 : doc.player1;
    turnSkipInProgressRef.current = true;
    try {
      const skipResult = await skipTurn(gameId, opponentId, state, timedOutPlayer, {
        trackIdleTimeout: true,
      }).catch(() => null);

      // Fallback robusto: leer estado LIVE tras el skip para evitar carreras
      // entre clientes donde skipResult puede llegar null por no-commit local.
      const liveAfterSnap = await get(ref(rtdb, `games/${gameId}`)).catch(() => null);
      const liveAfter = liveAfterSnap?.exists() ? (liveAfterSnap.val() as GameState) : null;
      const idleCount = liveAfter ? Number(liveAfter.idleTimeoutCount || 0) : Number(skipResult?.idleTimeoutCount || 0);
      const noMovesYet = liveAfter
        ? (liveAfter.lastMove === null || (Array.isArray(liveAfter.board) && liveAfter.board.every((c) => c === '')))
        : noMovesDetected;

      const shouldFinishNoCombat =
        doc.type !== 'tournament'
        && doc.round === 1
        && noMovesYet
        && idleCount >= 2;

      if (shouldFinishNoCombat) {
        await finishNoCombatChallenge(gameId, doc.player1, doc.player2).catch(() => {});
      }
    } finally {
      turnSkipInProgressRef.current = false;
    }
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

    if (roundUnlockTimeoutRef.current) clearTimeout(roundUnlockTimeoutRef.current);
    roundUnlockTimeoutRef.current = setTimeout(() => {
      finishingRoundRef.current = false;
      roundUnlockTimeoutRef.current = null;
    }, 5000);

    const opponentId = currentGameDoc.player1 === myUid
      ? currentGameDoc.player2
      : currentGameDoc.player1;
    const winnerId = winner
      ? (winner === (currentGameDoc.player1 === myUid ? 'X' : 'O') ? myUid : opponentId)
      : null;

    const { matchWinner } = await finishRound(
      gameId!,
      winnerId,
      currentGameDoc.score,
      currentGameDoc.player1,
      currentGameDoc.player2
    );

    if (matchWinner) {
      if (matchWinner === myUid) playSound('win');
      else playSound('lose');
      router.replace({
        pathname: '/game/resultado',
        params: { gameId, winnerId: matchWinner, myUid, endReason: 'normal' },
      });
    } else {
    const msg = winnerId === myUid ? t('game.roundWin') : winnerId ? t('game.roundLoss') : t('game.draw');
      if (winnerId === myUid) playSound('win');
      else if (winnerId) playSound('lose');
      else playSound('draw');
      setRoundMessage(msg);
      setTimeout(() => setRoundMessage(null), 2000);
    }
  }, [gameId, myUid]);

  // ── Presionar celda del tablero ───────────────────────────────────────
  const handleCellPress = async (index: number) => {
    if (!gameDoc || !gameState || !myUid) {
      showMoveDebug('blocked:missing_state_or_uid');
      return;
    }
    if (myUid !== gameDoc.player1 && myUid !== gameDoc.player2) {
      showMoveDebug('blocked:not_player');
      return;
    }
    if (finishingRoundRef.current) {
      showMoveDebug('blocked:round_finishing');
      return;
    }

    // ── Modo teletransporte activo ──
    if (teleportMode) {
      const hasOwnPiece = gameState.board.some((c) => c === mySymbol);
      if (!hasOwnPiece) {
        // Evita soft-lock cuando se activa teleport sin fichas propias en tablero.
        teleportModeRef.current = false;
        setTeleportMode(false);
        setTeleportFrom(null);
        await update(ref(rtdb, `games/${gameId}`), {
          teleportPending: false,
          teleportPlayer: null,
          wildcardUsed: false,
        }).catch(() => {});
        showWildcardAlert(t('game.teleportAlertFrom'), '#00F5FF');
      } else {
      if (teleportFrom === null) {
        // Primera selección: debe ser una ficha propia
        if (gameState.board[index] === mySymbol) {
          setTeleportFrom(index);
        } else {
          showWildcardAlert(t('game.teleportAlertFrom'), '#00F5FF');
        }
        return;
      } else {
        // Segunda selección: debe ser una celda vacía
        if (gameState.board[index] !== '') {
          showWildcardAlert(t('game.teleportAlertTo'), '#00F5FF');
          return;
        }
        // Ejecutar el teleport
        const teleportedBoard = [...gameState.board] as CellValue[];
        teleportedBoard[index] = mySymbol;
        teleportedBoard[teleportFrom] = '';
        await applyTeleportMove(gameId!, gameState.board, teleportFrom, index, mySymbol);
        teleportModeRef.current = false;
        setTeleportMode(false);
        setTeleportFrom(null);
        await resolveRound(teleportedBoard, gameDoc);
        // El jugador aún tiene su turno para hacer el movimiento normal
        return;
      }
      }
    }

    // Resolver usando estado LIVE de RTDB para evitar tocar sobre estado stale.
    const liveSnap = await get(ref(rtdb, `games/${gameId}`));
    if (!liveSnap.exists()) {
      showMoveDebug('blocked:live_missing');
      return;
    }
    const liveState = liveSnap.val() as typeof gameState;

    const actingPlayer = liveState.currentTurn;
    if (actingPlayer !== myUid) {
      showMoveDebug(`blocked:not_turn(${String(actingPlayer)}!=${myUid})`);
      return;
    }
    if (actingPlayer !== gameDoc.player1 && actingPlayer !== gameDoc.player2) {
      showMoveDebug('blocked:turn_uid_not_in_game');
      return;
    }
    if (!Array.isArray(liveState.board)) {
      showMoveDebug('blocked:live_board_invalid');
      return;
    }
    if (liveState.board[index] !== '') {
      showMoveDebug('blocked:cell_busy_live');
      return;
    }

    // ── Jugador congelado ──
    if (liveState.frozenPlayer === actingPlayer) {
      if (frozenSkipInProgressRef.current) return; // ya se está procesando vía auto-skip
      frozenSkipInProgressRef.current = true;
      Alert.alert(t('game.frozenTitle'), t('game.frozenMsg'));
      const opponentId = gameDoc.player1 === actingPlayer ? gameDoc.player2 : gameDoc.player1;
      skipTurn(gameId!, opponentId, liveState, actingPlayer, { trackIdleTimeout: false }).finally(() => {
        frozenSkipInProgressRef.current = false;
      });
      showMoveDebug('blocked:frozen_skip');
      return;
    }

    playSound('tap');

    let moveResult: Awaited<ReturnType<typeof makeMove>> | null = null;
    try {
      moveResult = await makeMove(
        gameId!,
        index,
        myUid,
        gameDoc.player1,
        gameDoc.player2
      );
    } catch {
      showMoveDebug('blocked:makeMove_exception');
      return;
    }
    if (!moveResult?.ok) {
      console.warn('[makeMove rejected]', moveResult?.reason || 'unknown');
      showMoveDebug(`blocked:${moveResult?.reason || 'unknown'}`);
      return;
    }
    showMoveDebug('ok:move_committed');
    await resolveRound(moveResult.board, gameDoc);
  };

  // ── Usar comodín ──────────────────────────────────────────────────────
  const handleWildcard = async (wildcardId: string) => {
    if (!gameDoc || !gameState || !myUid || !user) return;
    if (gameState.currentTurn !== myUid) return;
    if (finishingRoundRef.current) return;

    // Escudo activo: el rival bloqueó el comodín
    if (shieldActive) {
      Alert.alert(t('game.shieldBlocked'), t('game.shieldBlockedMsg'));
      return;
    }

    const opponentId = gameDoc.player1 === myUid ? gameDoc.player2 : gameDoc.player1;

    // Helper para decrementar localmente el inventario
    const decrementLocal = () => {
      const current = (user.wildcards as unknown as Record<string, number>)[wildcardId] ?? 0;
      if (current > 0) {
        updateUser({
          wildcards: {
            ...user.wildcards,
            [wildcardId]: current - 1,
          },
        });
      }
    };

    // Si el jugador activa teletransporte, entrar en modo selección local
    if (wildcardId === 'teleport') {
      const hasOwnPiece = gameState.board.some((c) => c === mySymbol);
      if (!hasOwnPiece) {
        showWildcardAlert(t('game.teleportAlertFrom'), '#00F5FF');
        return;
      }
      try {
        const ok = await applyWildcard(gameId!, wildcardId, myUid, opponentId, gameState.board, mySymbol);
        if (ok) {
          decrementLocal();
          playSound('wildcard');
          updateMissionProgress(myUid, 'wildcards').catch(() => {});
          teleportModeRef.current = true;
          setTeleportMode(true);
          setTeleportFrom(null);
          setWildcardAlert(null);
        }
      } catch {
        // Error de red — no hacer nada, el jugador conserva su comodín
      }
      return;
    }

    try {
      const applied = await applyWildcard(gameId!, wildcardId, myUid, opponentId, gameState.board, mySymbol);
      if (applied) {
        decrementLocal();
        playSound('wildcard');
        updateMissionProgress(myUid, 'wildcards').catch(() => {});
      } else if (wildcardId === 'sabotage') {
        Alert.alert(t('game.sabotageEmpty'), t('game.sabotageEmptyMsg'));
      }
    } catch {
      // Error de red — no hacer nada
    }
  };

  const handleForfeit = () => {
    Alert.alert(t('game.forfeitTitle'), t('game.forfeitMsg'), [
      { text: t('game.forfeitCancel'), style: 'cancel' },
      {
        text: t('game.forfeitConfirm'), style: 'destructive', onPress: async () => {
          if (!gameDoc || !myUid) return;
          const opponentId = gameDoc.player1 === myUid ? gameDoc.player2 : gameDoc.player1;
          await forfeitGame(gameId!, myUid, opponentId);
          router.replace({
            pathname: '/game/resultado',
            params: { gameId, winnerId: opponentId, myUid },
          });
        },
      },
    ]);
  };

  if (!gameDoc || !gameState) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>{t('game.waiting')}</Text>
        {loadStuck && (
          <TouchableOpacity style={styles.recoverBtn} onPress={() => router.back()}>
            <Text style={styles.recoverBtnText}>Volver</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (!myUid) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>Reconectando sesion...</Text>
      </View>
    );
  }

  if (myUid !== gameDoc.player1 && myUid !== gameDoc.player2) {
    return (
      <View style={styles.center}>
        <Text style={styles.loading}>No tienes acceso a esta partida.</Text>
        <TouchableOpacity style={styles.recoverBtn} onPress={() => router.back()}>
          <Text style={styles.recoverBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isMyTurn = gameState.currentTurn === myUid;
  const opponentId = gameDoc.player1 === myUid ? gameDoc.player2 : gameDoc.player1;
  const opponentUsername = gameDoc.player1 === myUid ? gameDoc.player2Username : gameDoc.player1Username;
  const opponentAvatar = gameDoc.player1 === myUid ? gameDoc.player2Avatar : gameDoc.player1Avatar;
  const opponentPhotoURL = gameDoc.player1 === myUid ? gameDoc.player2PhotoURL : gameDoc.player1PhotoURL;
  const myScore = gameDoc.score[myUid || ''] || 0;
  const opponentScore = gameDoc.score[opponentId] || 0;

  // Personalización por jugador
  const isPlayer1 = gameDoc.player1 === myUid;
  const myFrame = isPlayer1 ? gameDoc.player1Frame : gameDoc.player2Frame;
  const myNameColor = isPlayer1 ? gameDoc.player1NameColor : gameDoc.player2NameColor;
  const opponentFrame = isPlayer1 ? gameDoc.player2Frame : gameDoc.player1Frame;
  const opponentNameColor = isPlayer1 ? gameDoc.player2NameColor : gameDoc.player1NameColor;
  const myFrameColor = resolveFrameColor(myFrame ?? null);
  const myDisplayNameColor = resolveNameColor(myNameColor ?? null);
  const opponentFrameColor = resolveFrameColor(opponentFrame ?? null);
  const opponentDisplayNameColor = resolveNameColor(opponentNameColor ?? null);

  const isConfused = gameState.confusionActive && gameState.confusionTarget === myUid;

  return (
    <Animated.View style={[styles.container, shakeStyle]}>
      {/* Ronda y marcador */}
      <View style={styles.scoreRow}>
        <Text style={styles.roundText}>{t('game.round', { round: gameDoc.round })}</Text>
        <Text style={styles.score}>{myScore} - {opponentScore}</Text>
      </View>

      {/* Jugadores */}
      <View style={styles.playersRow}>
        <View style={[styles.playerInfo, isMyTurn && styles.activeTurn]}>
          <View style={[styles.avatarRing, { borderColor: myFrameColor }]}>
            <Image
              source={user?.photoURL ? { uri: user.photoURL } : AVATARS[user?.avatar || 'avatar_1']}
              style={styles.playerAvatar}
            />
          </View>
          <Text style={[styles.playerName, { color: myDisplayNameColor }]}>{user?.username}</Text>
          <Text style={[styles.symbolLabel, { color: COLORS.X }]}>{mySymbol}</Text>
          {isMyTurn && <Text style={styles.turnIndicator}>{t('game.yourTurn')}</Text>}
        </View>

        <Text style={styles.vs}>VS</Text>

        <View style={[styles.playerInfo, !isMyTurn && styles.activeTurn]}>
          <View style={[styles.avatarRing, { borderColor: opponentFrameColor }]}>
            <Image
              source={opponentPhotoURL ? { uri: opponentPhotoURL } : (AVATARS[opponentAvatar] || AVATARS['avatar_1'])}
              style={styles.playerAvatar}
            />
          </View>
          <Text style={[styles.playerName, { color: opponentDisplayNameColor }]}>{opponentUsername}</Text>
          <Text style={[styles.symbolLabel, { color: COLORS.O }]}>
            {mySymbol === 'X' ? 'O' : 'X'}
          </Text>
          {!isMyTurn && <Text style={styles.turnIndicator}>{t('game.opponentTurn')}</Text>}
        </View>
      </View>

      {/* Timer */}
      <View style={styles.timerContainer}>
        <Timer
          secondsLeft={secondsLeft}
          isMyTurn={isMyTurn}
          turboActive={gameState.turboActive && gameState.turboPlayer === myUid}
          maxTime={timerMax}
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
              ? t('game.teleportSelectFrom')
              : t('game.teleportSelectTo')}
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
      <Animated.View style={[styles.boardContainer, boardShakeStyle]}>
        <Board
          board={gameState.board}
          onCellPress={handleCellPress}
          disabled={!isMyTurn}
          confusionActive={isConfused}
          mySymbol={mySymbol}
          winningCells={[]}
          teleportMode={teleportMode}
          teleportFrom={teleportFrom}
          theme={gameDoc?.boardTheme ?? null}
        />
      </Animated.View>

      {!!moveDebug && (
        <View style={styles.moveDebugBox}>
          <Text style={styles.moveDebugText}>DEBUG ONLINE: {moveDebug}</Text>
        </View>
      )}

      {/* Comodines */}
      <View style={styles.wildcardsContainer}>
        <WildcardBar
          wildcards={user?.wildcards || {}}
          wildcardUsed={gameState.wildcardUsed}
          isMyTurn={isMyTurn}
          shieldActive={shieldActive}
          onUseWildcard={handleWildcard}
        />
      </View>

      {/* Chat emojis (Fase 1B) */}
      <View style={styles.chatEmojiRow}>
        {CHAT_EMOJIS.map((emoji) => (
          <TouchableOpacity
            key={emoji}
            style={styles.chatEmojiBtn}
            onPress={() => {
              if (!myUid) return;
              sendChatEmoji(gameId!, myUid, emoji).catch(() => {});
              updateMissionProgress(myUid, 'chat').catch(() => {});
            }}
          >
            <Text style={styles.chatEmojiText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Emoji flotante sobre avatar */}
      {floatingEmoji && (
        <RNAnimated.View
          style={[
            styles.floatingEmojiContainer,
            floatingEmoji.isMine ? styles.floatingEmojiLeft : styles.floatingEmojiRight,
            {
              opacity: emojiOpacityAnim,
              transform: [{ translateY: emojiFloatAnim }],
            },
          ]}
          pointerEvents="none"
        >
          <Text style={styles.floatingEmojiText}>{floatingEmoji.emoji}</Text>
        </RNAnimated.View>
      )}

      {/* Rendirse */}
      <TouchableOpacity style={styles.forfeitBtn} onPress={handleForfeit}>
        <Text style={styles.forfeitText}>{t('game.forfeit')}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loading: { color: COLORS.textSecondary, fontSize: 16 },
  recoverBtn: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 22,
  },
  recoverBtnText: { color: COLORS.primary, fontWeight: '700' },
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
  activeTurn: { borderColor: COLORS.primary, backgroundColor: COLORS.primary + '0D' },
  avatarRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, padding: 2, marginBottom: 4, justifyContent: 'center', alignItems: 'center' },
  playerAvatar: { width: 44, height: 44, borderRadius: 22 },
  playerName: { color: COLORS.text, fontSize: 12, fontWeight: 'bold' },
  symbolLabel: { fontSize: 16, fontWeight: '900', marginTop: 2 },
  turnIndicator: { color: COLORS.primary, fontSize: 9, fontWeight: 'bold', marginTop: 2, letterSpacing: 0.5 },
  vs: { color: COLORS.textSecondary, fontSize: 18, fontWeight: 'bold', marginHorizontal: 8 },
  timerContainer: { marginBottom: 8 },
  boardContainer: { alignItems: 'center', marginBottom: 16 },
  moveDebugBox: {
    marginBottom: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.warning,
    backgroundColor: COLORS.warning + '1A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  moveDebugText: {
    color: COLORS.warning,
    fontSize: 11,
    fontWeight: '700',
  },
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
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '14',
    alignItems: 'center',
  },
  teleportBannerText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  chatEmojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 6,
  },
  chatEmojiBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chatEmojiText: {
    fontSize: 18,
  },
  floatingEmojiContainer: {
    position: 'absolute',
    top: 120,
    zIndex: 200,
  },
  floatingEmojiLeft: {
    left: 24,
  },
  floatingEmojiRight: {
    right: 24,
  },
  floatingEmojiText: {
    fontSize: 40,
  },
});
