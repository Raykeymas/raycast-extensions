// かな・読みの最小単位（拗音・促音は1単位に正規化）
export type Kana = string;

export interface CorpusItem {
  id: string;
  text: string; // 表示用（日本語）
  reading: string; // ひらがな
  romaji: string; // 表示用ローマ字（デフォルトはJIS準拠）
  difficulty: 1 | 2 | 3;
  mode: "word" | "sentence"; // 練習モード
  // 将来拡張: 原文ハイライト用の読み対応セグメント（長文のみ任意）
  // 例: [{ text: "今日は", reading: "きょうは" }, { text: "いい", reading: "いい" }, ...]
  segments?: Array<{ text: string; reading: string }>;
}

export interface SessionConfig {
  durationSec: number; // 30/60/180
  difficulty: 1 | 2 | 3; // 1: 初級, 2: 中級, 3: 上級
  romajiProfile: RomajiProfileId; // 'jis' | 'hepburn' | 'liberal'
  showReading: boolean;
  practiceMode: "word" | "sentence"; // 練習モード
}

export interface TypingMetrics {
  cpm: number; // characters per minute
  wpm: number; // words per minute（5打=1語換算）
  accuracy: number; // 0..1
  mistakes: number;
  streakMax: number;
  skips: number;
}

export type SessionPhase = "idle" | "running" | "paused" | "finished";

export type InputFeedback =
  | { kind: "idle" }
  | { kind: "progress"; timestamp: number }
  | { kind: "error"; attempted?: string; timestamp: number };

export interface SessionState {
  id: string;
  phase: SessionPhase;
  startedAt?: string; // ISO
  finishedAt?: string; // ISO
  target?: CorpusItem;
  readingUnits: Kana[]; // 例: ['し', 'ん', 'か', 'ん', 'せ', 'ん']
  cursorUnitIndex: number; // 0..N
  typedBuffer: string; // 入力中のローマ字バッファ（単位境界またぎ対応）
  typedHistory: string; // 受理済みのローマ字入力履歴（バックスペース再計算用）
  metrics: TypingMetrics;
  score: ScoreState;
  config: SessionConfig;
  feedback?: InputFeedback;
  completedWords: number; // 単語モードで完了した単語数
}

export interface SessionResult extends TypingMetrics {
  id: string; // sess-...
  durationSec: number;
  finishedAt: string; // ISO
  version: string; // スキーマバージョン
  practiceMode: "word" | "sentence"; // 練習モード（履歴で区別）
  completedWords: number; // 単語モードで完了した単語数
}

export type RomajiProfileId = "jis" | "hepburn" | "liberal";

// Romanizer関連
export interface RomanizerState {
  unitIndex: number; // 現在の読み単位
  unitProgress: number; // 現ローマ字表現での一致進捗
  buffer: string; // 未確定入力
}

export interface StepOutcome {
  accepted: boolean; // 入力が有効
  completedUnit: boolean; // 単位確定
  advancedUnits: number; // 進んだ単位数（0/1）
  mistake: boolean; // 誤打（視覚強調用）
  state: RomanizerState; // 新状態
}

export interface RomajiProfile {
  id: RomajiProfileId;
  // 例: { 'し': ['shi','si'], 'つ': ['tsu','tu'], 'しゃ': ['sha','sya'] }
  map: Record<Kana, string[]>;
}

// Scorer関連
export interface ScoreState {
  correct: number;
  total: number;
  mistakes: number;
  streak: number;
  streakMax: number;
  skips: number;
  startedAt: number; // ms
}

// Session FSM関連
export type SessionEvent =
  | { type: "start"; target: CorpusItem; config: SessionConfig }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "finish" }
  | { type: "tick" }
  | { type: "type"; ch: string }
  | { type: "backspace" }
  | { type: "skip" }
  | { type: "complete-target" }
  | { type: "next-target"; target: CorpusItem };
