/**
 * Entrenamiento (Training) screen
 * - Full game rules: same timer, wildcards, Board, best-of-3
 * - Unlimited gems (playerGems = 999), no real cost
 * - No points / gems / Firebase writes
 * - AI difficulty auto-adapted to player's rank (can be overridden)
 * - Wildcard effects are local-only (no Firebase)
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Modal,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import Board from '../../components/Board';
import Timer from '../../components/Timer';
import WildcardBar from '../../components/WildcardBar';
import { AVATARS } from '../../components/AvatarPicker';
import { useColors } from '../../hooks/useColors';
import { TIMER_TOTAL } from '../../constants/theme';
import { checkWinner, isBoardFull, CellValue } from '../../services/game';
import { getEasyMove, getMediumMove, getBestMove } from '../../services/ia';
import '../../i18n';

// ── Types ──────────────────────────────────────────────────────────────────

type Difficulty = 'easy' | 'medium' | 'hard';

type Phase = 'menu' | 'playing' | 'result';

interface TrainingState {
  board: CellValue[];
  isPlayerTurn: boolean;
  wildcardUsed: boolean;
  frozenAI: boolean;
  frozenPlayer: boolean;       // IA usó freeze contra el jugador — pierde su turno
  shieldActive: boolean;
  turboActive: boolean;
  rivalTimerReduced: boolean;
  confusionActive: boolean;
  aiConfused: boolean;         // jugador usó confusion contra la IA
  earthquakeBoard: CellValue[] | null;
  teleportPending: boolean;
}

const INITIAL_STATE = (): TrainingState => ({
  board: Array(9).fill('') as CellValue[],
  isPlayerTurn: true,
  wildcardUsed: false,
  frozenAI: false,
  frozenPlayer: false,
  shieldActive: false,
  turboActive: false,
  rivalTimerReduced: false,
  confusionActive: false,
  aiConfused: false,
  earthquakeBoard: null,
  teleportPending: false,
});

// ── Rank → difficulty mapping ──────────────────────────────────────────────
const RANKS = ['Novato', 'Bronce', 'Plata', 'Oro', 'Diamante', 'Maestro', 'Leyenda'];

function rankToDifficulty(rank: string): Difficulty {
  const idx = RANKS.indexOf(rank);
  if (idx <= 0) return 'easy';      // Novato (or unknown)
  if (idx <= 2) return 'medium';    // Bronce, Plata
  return 'hard';                    // Oro, Diamante, Maestro, Leyenda
}

// ── AI wildcard simulation ─────────────────────────────────────────────────
// Wildcards the AI can randomly use on its turn (only a subset for training variety)
const AI_WILDCARDS = ['time_reduce', 'confusion', 'freeze', 'earthquake'];

function pickAIWildcard(): string {
  return AI_WILDCARDS[Math.floor(Math.random() * AI_WILDCARDS.length)];
}

// ── WINNING_COMBOS (for winningCells highlight) ────────────────────────────
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getWinningCells(board: CellValue[]): number[] {
  for (const [a, b, c] of WINNING_COMBOS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return [a, b, c];
    }
  }
  return [];
}

const createStyles = (COLORS: any) => StyleSheet.create({
  // Menu
  menuContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  menuContent: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    alignItems: 'center',
  },
  menuTitle: {
    color: COLORS.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
    textAlign: 'center',
  },
  menuSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  infoBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  infoItem: {
    color: COLORS.text,
    fontSize: 14,
  },
  diffSectionTitle: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  diffBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    marginBottom: 12,
  },
  diffBtnRecommended: {
    borderColor: COLORS.primary,
    backgroundColor: 'rgba(0,238,255,0.07)',
  },
  diffBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '700',
  },
  diffBtnTextRecommended: {
    color: COLORS.primary,
  },

  // Playing
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  backBtn: {
    padding: 8,
  },
  backBtnText: {
    color: COLORS.textMuted,
    fontSize: 18,
    fontWeight: '700',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  diffChip: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: 'rgba(255,214,0,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    gap: 24,
  },
  scoreBlock: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '900',
  },
  scoreDash: {
    color: COLORS.textMuted,
    fontSize: 24,
    fontWeight: '300',
  },
  duelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  duelCard: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  duelAvatarRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  duelAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  duelName: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '700',
  },
  duelTag: {
    color: COLORS.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  duelVs: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '900',
    marginHorizontal: 10,
  },
  aiBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  aiBadgeText: {
    fontSize: 10,
  },
  turnText: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  timerContainer: {
    marginBottom: 8,
  },
  alertBox: {
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
  },
  alertText: {
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
  roundMessageBox: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  roundMessageText: {
    backgroundColor: COLORS.surface,
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    textAlign: 'center',
  },
  boardContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  wildcardsContainer: {
    marginBottom: 12,
  },
  wildcardsOpenBtn: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  wildcardsOpenBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  emojiChatRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 10,
  },
  emojiBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  emojiBtnText: {
    fontSize: 17,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bubbleMine: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primary + '1A',
    borderColor: COLORS.primary,
  },
  bubbleAi: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.danger + '14',
    borderColor: COLORS.danger,
  },
  bubble: {
    minWidth: 44,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  bubbleText: {
    fontSize: 18,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 12,
    borderTopWidth: 1,
    borderColor: COLORS.border,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  modalClose: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },

  // Result
  resultContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: 16,
  },
  resultScore: {
    color: COLORS.text,
    fontSize: 48,
    fontWeight: '900',
    marginBottom: 8,
  },
  resultDiff: {
    color: COLORS.textMuted,
    fontSize: 14,
    marginBottom: 32,
  },
  shameText: {
    color: COLORS.danger,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  resultBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    marginBottom: 12,
  },
  resultBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

// ── Component ──────────────────────────────────────────────────────────────

export default function TrainingScreen() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  const [phase, setPhase] = useState<Phase>('menu');
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    rankToDifficulty(user?.rank ?? 'Novato')
  );

  // Score (rounds won per side)
  const [playerScore, setPlayerScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);

  // Contador de ronda para forzar re-disparo de useEffects
  const [roundKey, setRoundKey] = useState(0);

  // Per-round state
  const [gs, setGs] = useState<TrainingState>(INITIAL_STATE());
  const [secondsLeft, setSecondsLeft] = useState(TIMER_TOTAL);
  const [timerMax, setTimerMax] = useState(TIMER_TOTAL);
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<'victory' | 'defeat' | 'draw' | null>(null);

  // Teleport local state
  const [teleportMode, setTeleportMode] = useState(false);
  const [teleportFrom, setTeleportFrom] = useState<number | null>(null);
  const teleportModeRef = useRef(false);
  const teleportFromRef = useRef<number | null>(null);

  // Wildcard alert banner
  const [wildcardAlert, setWildcardAlert] = useState<{ message: string; color: string } | null>(null);
  const [showWildcardsModal, setShowWildcardsModal] = useState(false);
  const TRAINING_EMOJIS = ['😎', '🔥', '😂', '💀', '👏', '🫡'];
  const [myEmoji, setMyEmoji] = useState<string | null>(null);
  const [aiEmoji, setAiEmoji] = useState<string | null>(null);

  const timerStartRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishingRef = useRef(false);
  const gsRef = useRef<TrainingState>(INITIAL_STATE());
  const playerScoreRef = useRef(0);
  const aiScoreRef = useRef(0);

  const boardShakeAnim = useSharedValue(0);
  const boardShakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: boardShakeAnim.value }],
  }));

  const sendEmojiToChat = (emoji: string) => {
    setMyEmoji(emoji);
    setTimeout(() => setMyEmoji(null), 1800);
    setTimeout(() => {
      const aiPick = TRAINING_EMOJIS[Math.floor(Math.random() * TRAINING_EMOJIS.length)];
      setAiEmoji(aiPick);
      setTimeout(() => setAiEmoji(null), 1800);
    }, 500);
  };

  const handleWildcardFromModal = (wcId: string) => {
    setShowWildcardsModal(false);
    handleWildcard(wcId);
  };

  // Keep refs in sync
  useEffect(() => { gsRef.current = gs; }, [gs]);
  useEffect(() => { playerScoreRef.current = playerScore; }, [playerScore]);
  useEffect(() => { aiScoreRef.current = aiScore; }, [aiScore]);

  // ── Wildcard alert helper ────────────────────────────────────────────────
  const showAlert = (message: string, color: string) => {
    setWildcardAlert({ message, color });
    setTimeout(() => setWildcardAlert(null), 2500);
  };

  // ── Timer ────────────────────────────────────────────────────────────────
  const startTimer = useCallback((overrideSeconds?: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerStartRef.current = Date.now();
    const maxTime = overrideSeconds ?? TIMER_TOTAL;

    setTimerMax(maxTime);
    setSecondsLeft(maxTime);

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - timerStartRef.current) / 1000);
      const left = Math.max(0, maxTime - elapsed);
      setSecondsLeft(left);
      if (left === 0) {
        clearInterval(timerRef.current!);
        handleTimeUp();
      }
    }, 500);
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => () => { stopTimer(); }, []);

  // ── Handle time up ───────────────────────────────────────────────────────
  const handleTimeUp = useCallback(() => {
    const state = gsRef.current;
    if (!state.isPlayerTurn) return; // AI doesn't time-out in training
    // Player ran out of time → switch to AI turn
    setGs(prev => {
      const next = { ...prev, isPlayerTurn: false, wildcardUsed: false };
      gsRef.current = next;
      return next;
    });
  }, []);

  // ── AI move effect ───────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    const state = gsRef.current;
    if (state.isPlayerTurn) return;
    if (finishingRef.current) return;

    // Small delay for UX
    const delay = setTimeout(() => {
      const current = gsRef.current;

      // If AI is frozen, skip its turn
      if (current.frozenAI) {
        const nextGs: TrainingState = {
          ...current,
          frozenAI: false,
          isPlayerTurn: true,
          wildcardUsed: false,
          turboActive: false,
        };
        gsRef.current = nextGs;
        setGs(nextGs);
        startTimer(nextGs.rivalTimerReduced ? 15 : TIMER_TOTAL);
        return;
      }

      // AI may randomly use a wildcard (30% chance) on medium/hard
      const shouldUseWildcard =
        !current.wildcardUsed &&
        difficulty !== 'easy' &&
        Math.random() < 0.30;

      let updatedGs = { ...current };

      if (shouldUseWildcard) {
        const wcId = pickAIWildcard();
        updatedGs = applyAIWildcard(updatedGs, wcId);
      }

      // AI picks move — si está confundida juega aleatorio
      let move: number;
      if (updatedGs.aiConfused || difficulty === 'easy') move = getEasyMove(updatedGs.board);
      else if (difficulty === 'medium') move = getMediumMove(updatedGs.board);
      else move = getBestMove(updatedGs.board);

      if (move === -1) {
        // Board full — resolve round
        resolveRound(updatedGs.board, updatedGs);
        return;
      }

      const newBoard = [...updatedGs.board] as CellValue[];
      newBoard[move] = 'O';

      // Calcular segundos ANTES de limpiar el flag
      const playerSeconds = updatedGs.rivalTimerReduced ? 15 : TIMER_TOTAL;

      const nextGs: TrainingState = {
        ...updatedGs,
        board: newBoard,
        isPlayerTurn: true,
        wildcardUsed: false,
        turboActive: false,
        aiConfused: false,
        rivalTimerReduced: false,  // limpiar tras aplicarlo
        earthquakeBoard: null,
      };
      gsRef.current = nextGs;
      setGs(nextGs);

      startTimer(playerSeconds);

      resolveRound(newBoard, nextGs);
    }, 700);

    return () => clearTimeout(delay);
  }, [gs.isPlayerTurn, phase, roundKey]);

  // El timer se arranca explícitamente en cada punto donde el jugador recibe turno:
  // startMatch, AI effect (tras jugada IA o freeze), resolveRound, handleWildcard (turbo)

  // ── Detectar jugador congelado ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'playing') return;
    if (!gs.isPlayerTurn) return;
    if (!gs.frozenPlayer) return;
    if (finishingRef.current) return;
    // Jugador congelado: mostrar aviso y pasar turno a IA
    stopTimer();
    showAlert(t('training.frozenAlert'), '#00BFFF');
    const nextGs: TrainingState = {
      ...gsRef.current,
      frozenPlayer: false,
      isPlayerTurn: false,
      wildcardUsed: false,
    };
    gsRef.current = nextGs;
    setGs(nextGs);
  }, [gs.isPlayerTurn, gs.frozenPlayer, phase, roundKey]);

  // ── Apply AI wildcard locally ────────────────────────────────────────────
  const applyAIWildcard = (state: TrainingState, wcId: string): TrainingState => {
    // Si el jugador tiene escudo, bloquear el comodín de la IA
    if (state.shieldActive) {
      showAlert(t('training.shieldBlockedAI'), '#34C759');
      return { ...state, shieldActive: false };
    }
    switch (wcId) {
      case 'time_reduce':
        showAlert(t('game.alertTimerReduced'), '#FF6B35');
        return { ...state, rivalTimerReduced: true };
      case 'confusion':
        showAlert(t('game.alertConfusion'), '#FF69B4');
        return { ...state, confusionActive: true };
      case 'freeze':
        showAlert(t('training.aiFreezeAlert'), '#00BFFF');
        return { ...state, frozenPlayer: true };
      case 'earthquake': {
        const board = [...state.board] as CellValue[];
        const xPositions = board.map((v, i) => v === 'X' ? i : -1).filter(i => i !== -1);
        const emptyPositions = board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
        if (xPositions.length > 0 && emptyPositions.length > 0) {
          xPositions.forEach(i => { board[i] = ''; });
          const available = [...emptyPositions, ...xPositions];
          for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
          }
          xPositions.forEach((_, idx) => { board[available[idx]] = 'X'; });
        }
        boardShakeAnim.value = withSequence(
          withTiming(-18, { duration: 60 }), withTiming(18, { duration: 60 }),
          withTiming(-14, { duration: 60 }), withTiming(14, { duration: 60 }),
          withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }),
          withTiming(-6, { duration: 60 }),  withTiming(6, { duration: 60 }),
          withTiming(0, { duration: 60 }),
        );
        showAlert(t('game.alertEarthquake'), '#FF8C00');
        return { ...state, board };
      }
      default:
        return state;
    }
  };

  // Ref para roundKey para evitar stale closures en resolveRound
  const roundKeyRef = useRef(0);
  useEffect(() => { roundKeyRef.current = roundKey; }, [roundKey]);

  // ── Resolve round ────────────────────────────────────────────────────────
  const resolveRound = useCallback((board: CellValue[], state: TrainingState) => {
    const winner = checkWinner(board);
    const full = isBoardFull(board);
    if (!winner && !full) return;

    finishingRef.current = true;
    stopTimer();

    const pScore = playerScoreRef.current;
    const aScore = aiScoreRef.current;

    let newPScore = pScore;
    let newAScore = aScore;

    if (winner === 'X') {
      newPScore = pScore + 1;
      setPlayerScore(newPScore);
      playerScoreRef.current = newPScore;
      setRoundMessage(t('training.roundWin'));
    } else if (winner === 'O') {
      newAScore = aScore + 1;
      setAiScore(newAScore);
      aiScoreRef.current = newAScore;
      setRoundMessage(t('training.roundLoss'));
    } else {
      setRoundMessage(t('game.draw'));
    }

    setTimeout(() => {
      setRoundMessage(null);

      if (newPScore >= 2) {
        setMatchResult('victory');
        setPhase('result');
        return;
      }
      if (newAScore >= 2) {
        setMatchResult('defeat');
        setPhase('result');
        return;
      }
      // Fin del match: se jugaron 3 rondas (roundKeyRef.current === 2) y nadie llegó a 2 victorias
      if (roundKeyRef.current >= 2) {
        setMatchResult(newPScore > newAScore ? 'victory' : newPScore < newAScore ? 'defeat' : 'draw');
        setPhase('result');
        return;
      }

      // Next round
      const fresh = INITIAL_STATE();
      gsRef.current = fresh;
      setGs(fresh);
      setRoundKey(k => k + 1);
      teleportModeRef.current = false;
      teleportFromRef.current = null;
      setTeleportMode(false);
      setTeleportFrom(null);
      finishingRef.current = false;
      startTimer(TIMER_TOTAL);
    }, 1800);
  }, [t]);

  // ── Handle cell press ────────────────────────────────────────────────────
  const handleCellPress = (index: number) => {
    const state = gsRef.current;
    if (!state.isPlayerTurn) return;
    if (finishingRef.current) return;

    // Teleport mode — use refs to avoid stale closure
    if (teleportModeRef.current) {
      if (teleportFromRef.current === null) {
        // Primera selección: debe ser una ficha propia (X)
        if (state.board[index] === 'X') {
          teleportFromRef.current = index;
          setTeleportFrom(index);
        }
        // Si toca celda vacía u 'O', simplemente ignorar (el banner ya explica)
        return;
      } else {
        // Segunda selección: debe ser celda vacía
        if (state.board[index] !== '') {
          // Si toca otra ficha X, cambiar la selección de origen
          if (state.board[index] === 'X') {
            teleportFromRef.current = index;
            setTeleportFrom(index);
          }
          // Si toca una O, ignorar
          return;
        }
        const newBoard = [...state.board] as CellValue[];
        newBoard[teleportFromRef.current] = '';
        newBoard[index] = 'X';
        teleportModeRef.current = false;
        teleportFromRef.current = null;
        setTeleportMode(false);
        setTeleportFrom(null);
        // Tratar igual que un movimiento normal: pasar turno a IA
        const nextGs: TrainingState = {
          ...state,
          board: newBoard,
          isPlayerTurn: false,
          wildcardUsed: false,
          teleportPending: false,
          confusionActive: false,
          rivalTimerReduced: false,
        };
        gsRef.current = nextGs;
        setGs(nextGs);
        resolveRound(newBoard, nextGs);
        return;
      }
    }

    if (state.board[index] !== '') return;

    // Confusión: invertir el índice tocado (espejo en el tablero 3x3)
    const actualIndex = state.confusionActive ? (8 - index) : index;
    if (state.board[actualIndex] !== '') return;

    const newBoard = [...state.board] as CellValue[];
    newBoard[actualIndex] = 'X';

    const nextGs: TrainingState = {
      ...state,
      board: newBoard,
      isPlayerTurn: false,
      wildcardUsed: false,
      // clear confusion after player places their piece
      confusionActive: false,
      rivalTimerReduced: false,
    };
    gsRef.current = nextGs;
    setGs(nextGs);

    resolveRound(newBoard, nextGs);
  };

  // ── Handle player wildcard ───────────────────────────────────────────────
  const handleWildcard = (wcId: string) => {
    const state = gsRef.current;
    if (!state.isPlayerTurn || state.wildcardUsed || finishingRef.current) return;

    let next = { ...state, wildcardUsed: true };

    switch (wcId) {
      case 'turbo':
        next = { ...next, turboActive: true };
        showAlert(t('game.alertTurbo'), '#FFD700');
        // Reiniciar el timer con tiempo extendido
        startTimer(TIMER_TOTAL + 15);
        break;

      case 'time_reduce':
        // La IA no tiene timer — comodín no tiene efecto útil
        showAlert(t('training.aiNoTimer'), '#888888');
        next = { ...next, wildcardUsed: false }; // devolver el comodín
        break;

      case 'freeze':
        next = { ...next, frozenAI: true };
        showAlert(t('game.alertFreeze'), '#00BFFF');
        break;

      case 'shield':
        next = { ...next, shieldActive: true };
        showAlert(t('game.alertShield'), '#34C759');
        break;

      case 'teleport': {
        const hasX = next.board.some(v => v === 'X');
        if (!hasX) {
          showAlert(t('game.teleportAlertFrom'), '#00F5FF');
          next = { ...next, wildcardUsed: false };
          break;
        }
        next = { ...next, teleportPending: true };
        teleportModeRef.current = true;
        teleportFromRef.current = null;
        setTeleportMode(true);
        setTeleportFrom(null);
        break;
      }

      case 'confusion':
        next = { ...next, aiConfused: true };
        showAlert(t('training.aiConfused'), '#FF69B4');
        break;

      case 'sabotage': {
        const oPositions = next.board.map((v, i) => v === 'O' ? i : -1).filter(i => i !== -1);
        if (oPositions.length === 0) {
          showAlert(t('training.sabotageNoTarget'), '#FF4444');
          next = { ...next, wildcardUsed: false };
          break;
        }
        const victim = oPositions[Math.floor(Math.random() * oPositions.length)];
        const newBoard = [...next.board] as CellValue[];
        newBoard[victim] = '';
        next = { ...next, board: newBoard };
        showAlert(t('training.sabotageSuccess'), '#FF4444');
        break;
      }

      case 'earthquake': {
        const oPos = next.board.map((v, i) => v === 'O' ? i : -1).filter(i => i !== -1);
        const emp = next.board.map((v, i) => v === '' ? i : -1).filter(i => i !== -1);
        if (oPos.length > 0 && emp.length > 0) {
          const board = [...next.board] as CellValue[];
          oPos.forEach(i => { board[i] = ''; });
          const available = [...emp, ...oPos];
          for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
          }
          oPos.forEach((_, idx) => { board[available[idx]] = 'O'; });
          next = { ...next, board };
          boardShakeAnim.value = withSequence(
            withTiming(-18, { duration: 60 }), withTiming(18, { duration: 60 }),
            withTiming(-14, { duration: 60 }), withTiming(14, { duration: 60 }),
            withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }),
            withTiming(-6, { duration: 60 }),  withTiming(6, { duration: 60 }),
            withTiming(0, { duration: 60 }),
          );
          showAlert(t('game.alertEarthquake'), '#FF8C00');
        } else {
          showAlert(t('training.earthquakeNoTarget'), '#FF8C00');
          next = { ...next, wildcardUsed: false };
        }
        break;
      }

      default:
        break;
    }

    gsRef.current = next;
    setGs(next);
  };

  // ── Start match ──────────────────────────────────────────────────────────
  const startMatch = (diff: Difficulty) => {
    stopTimer();
    setDifficulty(diff);
    setPlayerScore(0);
    setAiScore(0);
    playerScoreRef.current = 0;
    aiScoreRef.current = 0;
    const fresh = INITIAL_STATE();
    gsRef.current = fresh;
    setGs(fresh);
    setRoundKey(k => k + 1);
    teleportModeRef.current = false;
    teleportFromRef.current = null;
    setTeleportMode(false);
    setTeleportFrom(null);
    setShowWildcardsModal(false);
    setMyEmoji(null);
    setAiEmoji(null);
    finishingRef.current = false;
    setMatchResult(null);
    setPhase('playing');
    // Primer turno del jugador
    startTimer(TIMER_TOTAL);
  };

  // ── Quit / play again ────────────────────────────────────────────────────
  const goToMenu = () => {
    stopTimer();
    finishingRef.current = false;
    teleportModeRef.current = false;
    teleportFromRef.current = null;
    setTeleportMode(false);
    setTeleportFrom(null);
    setShowWildcardsModal(false);
    setMyEmoji(null);
    setAiEmoji(null);
    setPhase('menu');
    setMatchResult(null);
  };

  // ── Difficulty label helper ──────────────────────────────────────────────
  const diffLabel = (d: Difficulty) => {
    if (d === 'easy') return t('ia.diffEasy');
    if (d === 'medium') return t('ia.diffMedium');
    return t('ia.diffHard');
  };

  // ── RENDER: menu ─────────────────────────────────────────────────────────
  if (phase === 'menu') {
    const autoD = rankToDifficulty(user?.rank ?? 'Novato');
    return (
      <ScrollView style={styles.menuContainer} contentContainerStyle={styles.menuContent}>
        <Text style={styles.menuTitle}>{t('training.title').toUpperCase()}</Text>
        <Text style={styles.menuSubtitle}>{t('training.subtitle')}</Text>

        <View style={styles.infoBox}>
          <Text style={styles.infoItem}>⚔️  {t('training.gemsUnlimited')}</Text>
          <Text style={styles.infoItem}>🚫  {t('training.noPrize')}</Text>
          <Text style={styles.infoItem}>🤖  {t('training.rankAdapted')}</Text>
        </View>

        <AdBanner style={{ marginBottom: 8 }} />

        <Text style={styles.diffSectionTitle}>{t('training.diffLabel').toUpperCase()}</Text>

        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.diffBtn, d === autoD && styles.diffBtnRecommended]}
            onPress={() => startMatch(d)}
          >
            <Text style={[styles.diffBtnText, d === autoD && styles.diffBtnTextRecommended]}>
              {diffLabel(d)}
              {d === autoD ? '  ★' : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  }

  // ── RENDER: result ───────────────────────────────────────────────────────
  if (phase === 'result') {
    const resultKey = matchResult === 'victory' ? 'training.victory'
      : matchResult === 'defeat' ? 'training.defeat'
      : 'training.draw';

    const color = matchResult === 'victory' ? COLORS.primary
      : matchResult === 'defeat' ? COLORS.danger
      : COLORS.accent;

    return (
      <View style={styles.resultContainer}>
        <Text style={[styles.resultTitle, { color }]}>{t(resultKey)}</Text>
        <Text style={styles.resultScore}>{playerScore} — {aiScore}</Text>
        <Text style={styles.resultDiff}>{diffLabel(difficulty)}</Text>
        {matchResult === 'defeat' && difficulty === 'hard' && (
          <Text style={styles.shameText}>{t('training.shameHard')}</Text>
        )}
        <TouchableOpacity style={[styles.resultBtn, { borderColor: COLORS.primary }]} onPress={() => startMatch(difficulty)}>
          <Text style={[styles.resultBtnText, { color: COLORS.primary }]}>{t('training.playAgain')}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.resultBtn, { borderColor: COLORS.textMuted }]} onPress={goToMenu}>
          <Text style={[styles.resultBtnText, { color: COLORS.textMuted }]}>{t('result.goHome')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── RENDER: playing ──────────────────────────────────────────────────────
  const winCells = getWinningCells(gs.board);
  const isConfused = gs.confusionActive;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToMenu} style={styles.backBtn}>
          <Text style={styles.backBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('training.title').toUpperCase()}</Text>
        <Text style={styles.diffChip}>{diffLabel(difficulty)}</Text>
      </View>

      {/* Scoreboard */}
      <View style={styles.scoreRow}>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>{t('ia.yourScore')}</Text>
          <Text style={[styles.scoreValue, { color: COLORS.primary }]}>{playerScore}</Text>
        </View>
        <Text style={styles.scoreDash}>—</Text>
        <View style={styles.scoreBlock}>
          <Text style={styles.scoreLabel}>{t('ia.iaScore')}</Text>
          <Text style={[styles.scoreValue, { color: COLORS.danger }]}>{aiScore}</Text>
        </View>
      </View>

      <View style={styles.duelRow}>
        <View style={styles.duelCard}>
          <View style={[styles.duelAvatarRing, { borderColor: COLORS.primary }]}> 
            <Image
              source={user?.photoURL ? { uri: user.photoURL } : AVATARS[user?.avatar || 'avatar_1']}
              style={styles.duelAvatar}
            />
          </View>
          <Text style={styles.duelName}>{user?.username || 'Jugador'}</Text>
          <Text style={styles.duelTag}>TU</Text>
        </View>
        <Text style={styles.duelVs}>VS</Text>
        <View style={styles.duelCard}>
          <View style={[styles.duelAvatarRing, { borderColor: COLORS.danger }]}> 
            <Image source={AVATARS['avatar_8']} style={styles.duelAvatar} />
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>🤖</Text>
            </View>
          </View>
          <Text style={styles.duelName}>IA GRIDWAR</Text>
          <Text style={styles.duelTag}>{diffLabel(difficulty)}</Text>
        </View>
      </View>

      {/* Turn indicator */}
      <Text style={[styles.turnText, { color: gs.isPlayerTurn ? COLORS.primary : COLORS.danger }]}> 
        {gs.isPlayerTurn ? t('training.yourTurn') : t('training.iaTurn')}
      </Text>

      <AdBanner style={{ marginBottom: 8 }} />

      {/* Timer (only shown on player's turn) */}
      {gs.isPlayerTurn && (
        <View style={styles.timerContainer}>
          <Timer
            secondsLeft={secondsLeft}
            isMyTurn={gs.isPlayerTurn}
            turboActive={gs.turboActive}
            maxTime={timerMax}
          />
        </View>
      )}

      {/* Wildcard alert */}
      {wildcardAlert && (
        <View style={[styles.alertBox, { borderColor: wildcardAlert.color }]}>
          <Text style={[styles.alertText, { color: wildcardAlert.color }]}>
            {wildcardAlert.message}
          </Text>
        </View>
      )}

      {/* Teleport banner */}
      {teleportMode && (
        <View style={styles.teleportBanner}>
          <Text style={styles.teleportBannerText}>
            {teleportFrom === null ? t('game.teleportSelectFrom') : t('game.teleportSelectTo')}
          </Text>
        </View>
      )}

      {/* Round message */}
      {roundMessage && (
        <View style={styles.roundMessageBox}>
          <Text style={styles.roundMessageText}>{roundMessage}</Text>
        </View>
      )}

      {(myEmoji || aiEmoji) && (
        <View style={styles.chatBubbleRow}>
          <View style={[styles.bubble, styles.bubbleMine]}>
            <Text style={styles.bubbleText}>{myEmoji || ' '}</Text>
          </View>
          <View style={[styles.bubble, styles.bubbleAi]}>
            <Text style={styles.bubbleText}>{aiEmoji || ' '}</Text>
          </View>
        </View>
      )}

      {/* Board */}
      <Animated.View style={[styles.boardContainer, boardShakeStyle]}>
        <Board
          board={gs.board}
          onCellPress={handleCellPress}
          disabled={!gs.isPlayerTurn || finishingRef.current}
          confusionActive={isConfused}
          mySymbol="X"
          winningCells={winCells}
          teleportMode={teleportMode}
          teleportFrom={teleportFrom}
          theme={user?.inventory?.active_theme ?? null}
        />
      </Animated.View>

      <TouchableOpacity style={styles.wildcardsOpenBtn} onPress={() => setShowWildcardsModal(true)}>
        <Text style={styles.wildcardsOpenBtnText}>{t('training.showWildcards')}</Text>
      </TouchableOpacity>

      <View style={styles.emojiChatRow}>
        {TRAINING_EMOJIS.map((emoji) => (
          <TouchableOpacity key={emoji} style={styles.emojiBtn} onPress={() => sendEmojiToChat(emoji)}>
            <Text style={styles.emojiBtnText}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Modal
        visible={showWildcardsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowWildcardsModal(false)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.modalBackdrop} onPress={() => setShowWildcardsModal(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('profile.wildcards')}</Text>
              <TouchableOpacity onPress={() => setShowWildcardsModal(false)}>
                <Text style={styles.modalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.wildcardsContainer}>
              <WildcardBar
                wildcards={{ turbo: 99, time_reduce: 99, teleport: 99, shield: 99, confusion: 99, sabotage: 99, freeze: 99, earthquake: 99 }}
                wildcardUsed={gs.wildcardUsed}
                isMyTurn={gs.isPlayerTurn}
                shieldActive={false}
                onUseWildcard={handleWildcardFromModal}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}
