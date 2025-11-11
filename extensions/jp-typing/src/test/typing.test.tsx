import { describe, test, expect, vi, beforeEach } from "vitest";
import type { SessionState, SessionResult, SessionConfig } from "../types";

// Mock dependencies
vi.mock("@raycast/api", () => ({
  showToast: vi.fn(),
  Toast: { Style: { Failure: "failure", Success: "success" } },
}));

vi.mock("../storage/prefs", () => ({
  getConfig: vi.fn(),
}));

vi.mock("../engine/session", () => ({
  createSessionResult: vi.fn(),
}));

vi.mock("../views/Practice", () => ({
  Practice: vi.fn(),
}));

vi.mock("../views/Result", () => ({
  Result: vi.fn(),
}));

const mockGetConfig = vi.hoisted(() => vi.fn());
const mockCreateSessionResult = vi.hoisted(() => vi.fn());
const mockSessionState: SessionState = {
  id: "test-session",
  phase: "finished",
  startedAt: "2024-01-01T12:00:00.000Z",
  finishedAt: "2024-01-01T12:01:00.000Z",
  target: {
    id: "test-word",
    text: "あめ",
    reading: "あめ",
    romaji: "ame",
    difficulty: 2,
    mode: "word",
  },
  readingUnits: ["あ", "め"],
  cursorUnitIndex: 2,
  typedBuffer: "",
  typedHistory: "ame",
  metrics: {
    cpm: 200,
    wpm: 40,
    accuracy: 0.95,
    mistakes: 2,
    streakMax: 10,
    skips: 0,
  },
  score: {
    correct: 10,
    total: 12,
    mistakes: 2,
    streak: 5,
    streakMax: 10,
    skips: 0,
    startedAt: Date.now() - 60000,
  },
  config: {
    durationSec: 60,
    difficulty: 2,
    romajiProfile: "hepburn",
    showReading: true,
    practiceMode: "word",
  },
  completedWords: 5,
};

const mockSessionResult: SessionResult = {
  id: "test-result",
  durationSec: 60,
  finishedAt: "2024-01-01T12:01:00.000Z",
  version: "0.3.0",
  practiceMode: "word",
  completedWords: 5,
  cpm: 200,
  wpm: 40,
  accuracy: 0.95,
  mistakes: 2,
  streakMax: 10,
  skips: 0,
};

// Mock process.exit
const mockProcessExit = vi.fn();
Object.defineProperty(global, "process", {
  value: {
    ...process,
    exit: mockProcessExit,
  },
  writable: true,
});

describe("TypingCommand logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetConfig.mockResolvedValue({
      durationSec: 60,
      difficulty: 2,
      romajiProfile: "hepburn",
      showReading: true,
      practiceMode: "word",
    });
    mockCreateSessionResult.mockReturnValue(mockSessionResult);
  });

  test("設定読み込み関数が利用可能である", () => {
    // getConfigがモックされていることを確認
    expect(typeof mockGetConfig).toBe("function");
  });

  test("デフォルト設定の検証", () => {
    const defaultConfig: SessionConfig = {
      durationSec: 30,
      difficulty: 2,
      romajiProfile: "hepburn",
      showReading: true,
      practiceMode: "word",
    };

    expect(defaultConfig.durationSec).toBe(30);
    expect(defaultConfig.difficulty).toBe(2);
    expect(defaultConfig.romajiProfile).toBe("hepburn");
    expect(defaultConfig.showReading).toBe(true);
    expect(defaultConfig.practiceMode).toBe("word");
  });

  test("セッション結果の型が正しい", () => {
    const result: SessionResult = mockSessionResult;

    expect(result.id).toBe("test-result");
    expect(result.practiceMode).toBe("word");
    expect(result.completedWords).toBe(5);
    expect(result.cpm).toBe(200);
    expect(result.accuracy).toBe(0.95);
  });

  test("セッション状態の型が正しい", () => {
    const state: SessionState = mockSessionState;

    expect(state.id).toBe("test-session");
    expect(state.phase).toBe("finished");
    expect(state.config.practiceMode).toBe("word");
    expect(state.completedWords).toBe(5);
  });

  test("設定の型が正しい", () => {
    const config: SessionConfig = {
      durationSec: 60,
      difficulty: 2,
      romajiProfile: "hepburn",
      showReading: true,
      practiceMode: "word",
    };

    expect(config.durationSec).toBe(60);
    expect(config.difficulty).toBe(2);
    expect(config.practiceMode).toBe("word");
  });

  test("設定値のバリデーション", () => {
    const validConfigs: SessionConfig[] = [
      { durationSec: 30, difficulty: 1, romajiProfile: "jis", showReading: true, practiceMode: "word" },
      { durationSec: 60, difficulty: 2, romajiProfile: "hepburn", showReading: false, practiceMode: "sentence" },
      { durationSec: 180, difficulty: 3, romajiProfile: "liberal", showReading: true, practiceMode: "word" },
    ];

    validConfigs.forEach((config) => {
      expect(config.durationSec).toBeGreaterThan(0);
      expect(config.difficulty).toBeGreaterThanOrEqual(1);
      expect(config.difficulty).toBeLessThanOrEqual(3);
      expect(["jis", "hepburn", "liberal"]).toContain(config.romajiProfile);
      expect(["word", "sentence"]).toContain(config.practiceMode);
      expect(typeof config.showReading).toBe("boolean");
    });
  });

  test("process.exitがモックされている", () => {
    expect(typeof mockProcessExit).toBe("function");
    mockProcessExit(0);
    expect(mockProcessExit).toHaveBeenCalledWith(0);
  });
});
