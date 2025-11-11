import type {
  SessionState,
  SessionEvent,
  CorpusItem,
  SessionConfig,
  SessionResult,
  InputFeedback,
  Kana,
  RomajiProfile,
  RomanizerState,
} from "../types";
import { ROMAJI_PROFILES } from "./romanizer";
import { normalizeReading, stepRomanizer } from "./romanizer";
import { createScoreState, updateScore, skipScore, toMetrics } from "./scorer";

// 初期セッション状態の作成
export function createInitialSession(): SessionState {
  const score = createScoreState();
  return {
    id: generateSessionId(),
    phase: "idle",
    readingUnits: [],
    cursorUnitIndex: 0,
    typedBuffer: "",
    typedHistory: "",
    metrics: toMetrics(score, score.startedAt),
    score,
    config: {
      durationSec: 30,
      difficulty: 2,
      romajiProfile: "hepburn",
      showReading: true,
      practiceMode: "word",
    },
    feedback: { kind: "idle" },
    completedWords: 0,
  };
}

// セッション状態の更新（FSM）
export function reduceSession(state: SessionState, event: SessionEvent): SessionState {
  switch (event.type) {
    case "start":
      return handleStart(state, event);
    case "pause":
      return handlePause(state);
    case "resume":
      return handleResume(state);
    case "finish":
      return handleFinish(state);
    case "tick":
      return handleTick(state);
    case "type":
      return handleType(state, event);
    case "backspace":
      return handleBackspace(state);
    case "skip":
      return handleSkip(state);
    case "complete-target":
      return handleCompleteTarget(state);
    case "next-target":
      return handleNextTarget(state, event);
    default:
      return state;
  }
}

// 開始処理
function handleStart(
  state: SessionState,
  event: { type: "start"; target: CorpusItem; config: SessionConfig },
): SessionState {
  const readingUnits = normalizeReading(event.target.reading);
  const startedAtMs = Date.now();
  const score = { ...createScoreState(), startedAt: startedAtMs };
  return {
    ...state,
    id: generateSessionId(),
    phase: "running",
    startedAt: new Date(startedAtMs).toISOString(),
    target: event.target,
    readingUnits,
    cursorUnitIndex: 0,
    typedBuffer: "",
    typedHistory: "",
    config: event.config,
    metrics: toMetrics(score, startedAtMs),
    score,
    feedback: { kind: "idle" },
    completedWords: 0,
  };
}

// 一時停止処理
function handlePause(state: SessionState): SessionState {
  if (state.phase !== "running") return state;
  return {
    ...state,
    phase: "paused",
  };
}

// 再開処理
function handleResume(state: SessionState): SessionState {
  if (state.phase !== "paused") return state;
  return {
    ...state,
    phase: "running",
  };
}

// 終了処理
function handleFinish(state: SessionState): SessionState {
  if (state.phase === "finished") return state;
  return {
    ...state,
    phase: "finished",
    finishedAt: new Date().toISOString(),
  };
}

// タイマティック処理
function handleTick(state: SessionState): SessionState {
  if (state.phase !== "running") return state;

  const startedAt = state.startedAt ? new Date(state.startedAt).getTime() : Date.now();
  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);

  if (elapsedSec >= state.config.durationSec) {
    return handleFinish(state);
  }

  return state;
}

// タイプ処理
function handleType(state: SessionState, event: { type: "type"; ch: string }): SessionState {
  if (state.phase !== "running") return state;

  const profile = ROMAJI_PROFILES[state.config.romajiProfile] ?? ROMAJI_PROFILES.jis;
  const romanizerState = {
    unitIndex: state.cursorUnitIndex,
    unitProgress: 0,
    buffer: state.typedBuffer,
  };

  const outcome = stepRomanizer(romanizerState, event.ch, state.readingUnits, profile);

  if (!outcome.accepted) {
    if (outcome.mistake) {
      return {
        ...state,
        feedback: createFeedback("error", event.ch),
      };
    }
    return state; // 入力が受け付けられなかった場合は状態を更新しない
  }

  // メトリクスの更新
  const updatedScore = updateScore(state.score, outcome);
  const updatedMetrics = toMetrics(updatedScore, Date.now());
  const typedChar = event.ch.toLowerCase();

  const updatedState = {
    ...state,
    cursorUnitIndex: outcome.state.unitIndex,
    typedBuffer: outcome.state.buffer,
    typedHistory: state.typedHistory + typedChar,
    metrics: updatedMetrics,
    score: updatedScore,
    feedback: createFeedback(outcome.mistake ? "error" : "progress"),
  };

  // 長文モードで文章完了の場合はセッション終了
  if (state.config.practiceMode === "sentence" && updatedState.cursorUnitIndex >= updatedState.readingUnits.length) {
    return handleFinish(updatedState);
  }

  return updatedState;
}

// バックスペース処理
function handleBackspace(state: SessionState): SessionState {
  if (state.phase !== "running") return state;

  const profile = ROMAJI_PROFILES[state.config.romajiProfile] ?? ROMAJI_PROFILES.jis;
  const newHistory = state.typedHistory.slice(0, -1);
  const romanizerState = replayRomanizer(newHistory, state.readingUnits, profile);

  return {
    ...state,
    cursorUnitIndex: romanizerState.unitIndex,
    typedBuffer: romanizerState.buffer,
    typedHistory: newHistory,
    feedback: { kind: "progress", timestamp: Date.now() },
  };
}

// スキップ処理
function handleSkip(state: SessionState): SessionState {
  if (state.phase !== "running") return state;

  // 長文モードではスキップ不可
  if (state.config.practiceMode === "sentence") {
    return state;
  }

  // メトリクスの更新
  const updatedScore = skipScore(state.score);
  const updatedMetrics = toMetrics(updatedScore, Date.now());

  return {
    ...state,
    cursorUnitIndex: state.readingUnits.length, // 最後までスキップ
    typedBuffer: "",
    typedHistory: "",
    metrics: updatedMetrics,
    score: updatedScore,
    feedback: { kind: "progress", timestamp: Date.now() },
  };
}

function handleCompleteTarget(state: SessionState): SessionState {
  if (state.phase !== "running") return state;
  return {
    ...state,
    completedWords: state.completedWords + 1,
  };
}

function handleNextTarget(state: SessionState, event: { type: "next-target"; target: CorpusItem }): SessionState {
  if (state.phase !== "running") return state;

  const readingUnits = normalizeReading(event.target.reading);

  return {
    ...state,
    target: event.target,
    readingUnits,
    cursorUnitIndex: 0,
    typedBuffer: "",
    typedHistory: "",
    feedback: { kind: "progress", timestamp: Date.now() },
  };
}

// ヘルパー関数
function generateSessionId(): string {
  return `sess-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createFeedback(kind: InputFeedback["kind"], attempted?: string): InputFeedback {
  if (kind === "error") {
    return {
      kind,
      attempted,
      timestamp: Date.now(),
    };
  }
  if (kind === "progress") {
    return {
      kind,
      timestamp: Date.now(),
    };
  }
  return { kind: "idle" };
}

function replayRomanizer(
  history: string,
  readingUnits: Kana[],
  profile: RomajiProfile = ROMAJI_PROFILES.jis,
): RomanizerState {
  let state: RomanizerState = {
    unitIndex: 0,
    unitProgress: 0,
    buffer: "",
  };

  for (const ch of history) {
    const outcome = stepRomanizer(state, ch, readingUnits, profile);
    if (!outcome.accepted) {
      break;
    }
    state = outcome.state;
  }

  return state;
}

// 残り時間の計算
export function getRemainingSeconds(state: SessionState): number {
  if (!state.startedAt || state.phase !== "running") return state.config.durationSec;

  const startedAt = new Date(state.startedAt).getTime();
  const elapsedSec = Math.floor((Date.now() - startedAt) / 1000);
  return Math.max(0, state.config.durationSec - elapsedSec);
}

// セッション結果の作成
export function createSessionResult(state: SessionState): SessionResult {
  return {
    id: state.id,
    durationSec: state.config.durationSec,
    ...state.metrics,
    finishedAt: state.finishedAt || new Date().toISOString(),
    version: "0.3.0",
    practiceMode: state.config.practiceMode,
    completedWords: state.completedWords,
  };
}
