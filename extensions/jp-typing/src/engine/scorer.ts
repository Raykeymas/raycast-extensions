import type { ScoreState, StepOutcome, TypingMetrics } from "../types";

// スコア状態の初期化
export function createScoreState(): ScoreState {
  return {
    correct: 0,
    total: 0,
    mistakes: 0,
    streak: 0,
    streakMax: 0,
    skips: 0,
    startedAt: Date.now(),
  };
}

// スコアの更新
export function updateScore(state: ScoreState, outcome: StepOutcome): ScoreState {
  const newState = { ...state };

  if (outcome.accepted) {
    newState.total += 1;

    if (outcome.mistake) {
      newState.mistakes += 1;
      newState.streak = 0;
    } else {
      newState.correct += 1;
      newState.streak += 1;
      if (newState.streak > newState.streakMax) {
        newState.streakMax = newState.streak;
      }
    }
  }

  return newState;
}

// スキップの処理
export function skipScore(state: ScoreState): ScoreState {
  return {
    ...state,
    skips: state.skips + 1,
    streak: 0,
  };
}

// メトリクスへの変換
export function toMetrics(state: ScoreState, nowMs: number): TypingMetrics {
  const elapsedMs = nowMs - state.startedAt;

  // CPM (characters per minute)
  const cpm = elapsedMs > 0 ? Math.round((state.correct * 60000) / elapsedMs) : 0;

  // WPM (words per minute) - 5打を1語として換算
  const wpm = cpm > 0 ? Math.round(cpm / 5) : 0;

  // 正確性
  const accuracy = state.total > 0 ? state.correct / state.total : 1;

  return {
    cpm,
    wpm,
    accuracy,
    mistakes: state.mistakes,
    streakMax: state.streakMax,
    skips: state.skips,
  };
}
