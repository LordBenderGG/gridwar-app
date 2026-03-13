import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CellValue, checkWinner, isBoardFull } from '../../services/game';
import { getBestMove, getEasyMove, getMediumMove } from '../../services/ia';
import Board from '../../components/Board';
import Timer from '../../components/Timer';
import { COLORS, TIMER_TOTAL } from '../../constants/theme';

type Difficulty = 'easy' | 'medium' | 'hard';

export default function VsIAScreen() {
  const router = useRouter();
  const [board, setBoard] = useState<CellValue[]>(Array(9).fill(''));
  const [isPlayerTurn, setIsPlayerTurn] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(TIMER_TOTAL);
  const [score, setScore] = useState({ player: 0, ia: 0 });
  const [round, setRound] = useState(1);
  const [difficulty, setDifficulty] = useState<Difficulty>('hard');
  const [gameOver, setGameOver] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (gameOver) return;
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const left = Math.max(0, TIMER_TOTAL - elapsed);
      setSecondsLeft(left);
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
        const move = difficulty === 'easy'
          ? getEasyMove(board)
          : difficulty === 'medium'
          ? getMediumMove(board)
          : getBestMove(board);
        if (move !== -1) handleMakeMove(move, 'O');
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [isPlayerTurn]);

  const handleTimerUp = () => {
    setIsPlayerTurn(false);
  };

  const handleMakeMove = (index: number, symbol: 'X' | 'O') => {
    const newBoard = [...board];
    if (newBoard[index] !== '') return;
    newBoard[index] = symbol;
    setBoard(newBoard);

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
    if (winner === 'X') { newScore.player += 1; msg = '¡Ganaste la ronda! 🎉'; }
    else if (winner === 'O') { newScore.ia += 1; msg = '¡IA gana la ronda! 🤖'; }
    else { msg = '¡Empate!'; }

    setMessage(msg);
    setTimeout(() => {
      setMessage(null);
      if (newScore.player >= 2 || newScore.ia >= 2 || round >= 3) {
        setScore(newScore);
        setGameOver(true);
      } else {
        setScore(newScore);
        setRound((r) => r + 1);
        setBoard(Array(9).fill(''));
        setIsPlayerTurn(true);
      }
    }, 1500);
    setScore(newScore);
  };

  const handleCellPress = (index: number) => {
    if (!isPlayerTurn || gameOver) return;
    handleMakeMove(index, 'X');
  };

  const resetGame = () => {
    setBoard(Array(9).fill(''));
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
        <Text style={styles.backText}>← Volver</Text>
      </TouchableOpacity>

      <Text style={styles.title}>VS INTELIGENCIA ARTIFICIAL</Text>

      {/* Dificultad */}
      <View style={styles.diffRow}>
        {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.diffBtn, difficulty === d && styles.diffBtnActive]}
            onPress={() => setDifficulty(d)}
          >
            <Text style={[styles.diffText, difficulty === d && styles.diffTextActive]}>
              {d === 'easy' ? 'Fácil' : d === 'medium' ? 'Normal' : 'Imposible'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.scoreRow}>
        <Text style={styles.scoreText}>Tú: {score.player}</Text>
        <Text style={styles.roundText}>Ronda {round}/3</Text>
        <Text style={styles.scoreText}>IA: {score.ia}</Text>
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
            {playerWon ? '🏆 ¡GANASTE!' : score.player === score.ia ? '🤝 ¡EMPATE!' : '🤖 ¡TE GANÓ LA IA!'}
          </Text>
          {!playerWon && difficulty === 'hard' && (
            <Text style={styles.shame}>Ni a la IA le puedes ganar... 😂</Text>
          )}
          <TouchableOpacity style={styles.replayBtn} onPress={resetGame}>
            <Text style={styles.replayText}>Jugar de nuevo</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.boardContainer}>
          <Board
            board={board}
            onCellPress={handleCellPress}
            disabled={!isPlayerTurn || gameOver}
            mySymbol="X"
          />
          <Text style={styles.turnText}>
            {isPlayerTurn ? '🎯 Tu turno (X)' : '🤖 IA pensando...'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
