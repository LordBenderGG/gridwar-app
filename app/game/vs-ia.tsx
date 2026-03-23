import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import AdBanner from '../../components/AdBanner';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CellValue, checkWinner, isBoardFull } from '../../services/game';
import { getBestMove, getEasyMove, getMediumMove } from '../../services/ia';
import Board from '../../components/Board';
import Timer from '../../components/Timer';
import { useAuthStore } from '../../store/authStore';
import { useColors } from '../../hooks/useColors';
import { TIMER_TOTAL } from '../../constants/theme';
import { playSound } from '../../services/sound';
import '../../i18n';

type Difficulty = 'easy' | 'medium' | 'hard';

const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingTop: 50, paddingHorizontal: 16, alignItems: 'center' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 12 },
  backText: { color: COLORS.primary, fontSize: 14 },
  title: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', letterSpacing: 1, marginBottom: 16, textAlign: 'center' },
  diffRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  diffBtn: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  diffBtnActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(0,245,255,0.1)' },
  diffText: { color: COLORS.textSecondary, fontSize: 13 },
  diffTextActive: { color: COLORS.primary, fontWeight: 'bold' },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 12 },
  scoreText: { color: COLORS.text, fontSize: 16, fontWeight: 'bold' },
  roundText: { color: COLORS.textSecondary, fontSize: 14 },
  boardContainer: { alignItems: 'center', marginTop: 16 },
  turnText: { color: COLORS.textSecondary, marginTop: 12, fontSize: 14 },
  message: { marginVertical: 8, backgroundColor: COLORS.surfaceLight, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  messageText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 16 },
  gameOverContainer: { alignItems: 'center', marginTop: 40 },
  gameOverText: { fontSize: 32, fontWeight: '900', marginBottom: 8 },
  win: { color: COLORS.success },
  loss: { color: COLORS.danger },
  shame: { color: COLORS.textSecondary, fontSize: 14, fontStyle: 'italic', marginBottom: 20 },
  replayBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  replayText: { color: COLORS.background, fontWeight: 'bold', fontSize: 15 },
});

export default function VsIAScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const COLORS = useColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [board, setBoard] = useState<CellValue[]>(Array(9).fill(''));
  const boardRef = useRef<CellValue[]>(Array(9).fill(''));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_TOTAL);
  const [score, setScore] = useState({ player: 0, ia: 0 });
  const [round, setRound] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownLastSecRef = useRef<number>(-1);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameOver) return;
    countdownLastSecRef.current = -1;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, TIMER_TOTAL - elapsed);
      setSecondsLeft(left);
      if (left <= 5 && left > 0 && isPlayerTurn && left !== countdownLastSecRef.current) {
        countdownLastSecRef.current = left;
        playSound('countdown');
      }
      if (left === 0 && isPlayerTurn) {
        clearInterval(timerRef.current!);
        handleTimerUp();
      }
    }, 500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isPlayerTurn, round, gameOver]);

  useEffect(() => {
    if (!isPlayerTurn && !gameOver) {
      const timeout = setTimeout(() => {
        const currentBoard = boardRef.current;
        const move = difficulty === 'easy'
          ? getEasyMove(currentBoard)
          : difficulty === 'medium'
          ? getMediumMove(currentBoard)
          : getBestMove(currentBoard);
        if (move !== -1) handleMakeMove(move, 'O');
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [isPlayerTurn]);

  const handleTimerUp = () => {
    setIsPlayerTurn(false);
  };

  const handleMakeMove = (index: number, symbol: 'X' | 'O') => {
    const newBoard = [...boardRef.current];
    if (newBoard[index] !== '') return;
    newBoard[index] = symbol;
    boardRef.current = newBoard;
    setBoard(newBoard);
    if (symbol === 'X') playSound('tap');

    const winner = checkWinner(newBoard);
    const full = isBoardFull(newBoard);

    if (winner || full) {
      handleRoundEnd(winner, newBoard);
    } else {
      setIsPlayerTurn(symbol === 'O');
    }
  };

  const handleRoundEnd = (winner: CellValue | null, finalBoard: CellValue[]) => {
    const newScore = { ...score };
    let msg = '';
    if (winner === 'X') { newScore.player += 1; msg = t('game.roundWin'); playSound('win'); }
    else if (winner === 'O') { newScore.ia += 1; msg = ` ${t('game.roundLoss')}`; playSound('lose'); }
    else { msg = t('game.draw'); playSound('draw'); }

    setMessage(msg);
    setTimeout(() => {
        setMessage(null);
        if (newScore.player >= 2 || newScore.ia >= 2 || round === 3) {
          setScore(newScore);
          setGameOver(true);
        } else {
          setScore(newScore);
          setRound((r) => r + 1);
          boardRef.current = Array(9).fill('');
          setBoard(Array(9).fill(''));
          setIsPlayerTurn(true);
        }
    }, 1500);
  };

  const handleCellPress = (index: number) => {
    if (!isPlayerTurn || gameOver) return;
    handleMakeMove(index, 'X');
  };

  const resetGame = () => {
    const emptyBoard = Array(9).fill('');
    boardRef.current = emptyBoard;
    setBoard(emptyBoard);
    setScore({ player: 0, ia: 0 });
    setRound(1);
    setIsPlayerTurn(true);
    setGameOver(false);
    setMessage(null);
  };

  const playerWon = score.player > score.ia;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>{t('auth.back')}</Text>
      </TouchableOpacity>

      <Text style={styles.title}>{t('ia.title').toUpperCase()}</Text>

      {/* Dificultad */}
      <View style={styles.diffRow}>
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]}
            onPress={() => setDifficulty(d)}
          >
            <Text style={[styles.diffText, difficulty === d && styles.diffTextActive]}>
              {d === 'easy' ? t('ia.diffEasy') : d === 'medium' ? t('ia.diffMedium') : t('ia.diffHard')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>{t('ia.yourScore')}: {score.player}</Text>
        <Text style={styles.roundText}>{t('game.round', { round })}</Text>
        <Text style={styles.scoreText}>{t('ia.iaScore')}: {score.ia}</Text>
      </View>

      <Timer secondsLeft={secondsLeft} isMyTurn={isPlayerTurn} />

      {message && (
        <View style={styles.message}>
          <Text style={styles.messageText}>{message}</Text>
        </View>
      )}

      {gameOver ? (
        <View style={styles.gameOverContainer}>
          <Text style={[styles.gameOverText, playerWon ? styles.win : styles.loss]}>
            {playerWon ? ` ${t('result.victory')}` : score.player === score.ia ? ` ${t('game.draw')}` : ` ${t('result.defeat')} - ${t('ia.iaScore')}`}
          </Text>
          {!playerWon && difficulty === 'hard' && (
            <Text style={styles.shame}>{t('training.shameHard')}</Text>
          )}
          <AdBanner placement="training" style={{ marginBottom: 16 }} />
          <TouchableOpacity style={styles.replayBtn} onPress={resetGame}>
            <Text style={styles.replayText}>{t('result.playAgain')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.boardContainer}>
          <Board
            board={board}
            onCellPress={handleCellPress}
            disabled={!isPlayerTurn || gameOver}
            mySymbol="X"
            theme={user?.inventory?.active_theme ?? null}
          />
          <Text style={styles.turnText}>
            {isPlayerTurn ? ` ${t('game.yourTurn')} (X)` : ` ${t('ia.iaScore')} ${t('game.opponentTurn').toLowerCase()}...`}
          </Text>
        </View>
      )}
    </View>
  );
}
