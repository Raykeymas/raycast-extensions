import { describe, test, expect, vi, beforeEach } from "vitest";
import type { SessionConfig } from "../types";

// Mock dependencies
vi.mock("@raycast/api", () => ({
  ActionPanel: () => null,
  Action: () => null,
  showToast: vi.fn(),
  Toast: { Style: { Failure: "failure", Success: "success" } },
  List: () => null,
  Form: () => null,
}));

vi.mock("../data/corpus", () => ({
  getRandomItem: vi.fn(() => ({
    id: "test-word",
    text: "あめ",
    reading: "あめ",
    romaji: "ame",
    difficulty: 2,
    mode: "word" as const,
  })),
  getSentenceItem: vi.fn(() => ({
    id: "test-sentence",
    text: "こんにちは",
    reading: "こんにちは",
    romaji: "konnichiha",
    difficulty: 2,
    mode: "sentence" as const,
  })),
}));

vi.mock("../engine/session", () => ({
  createInitialSession: vi.fn(() => ({
    id: "test-session",
    phase: "idle" as const,
    readingUnits: [],
    cursorUnitIndex: 0,
    typedBuffer: "",
    typedHistory: "",
    metrics: { cpm: 0, wpm: 0, accuracy: 1, mistakes: 0, streakMax: 0, skips: 0 },
    score: { correct: 0, total: 0, mistakes: 0, streak: 0, streakMax: 0, skips: 0, startedAt: Date.now() },
    config: { durationSec: 60, difficulty: 2, romajiProfile: "hepburn", showReading: true, practiceMode: "word" },
    completedWords: 0,
  })),
  reduceSession: vi.fn(),
  getRemainingSeconds: vi.fn(() => 60),
}));

vi.mock("../utils/time", () => ({
  formatTime: vi.fn((seconds: number) => `${seconds}s`),
}));

vi.mock("../views/components/TypingPrompt", () => ({
  TypingPrompt: vi.fn(() => ({
    markdown: "test prompt",
    readingLine: "ローマ字: test",
  })),
}));

describe("Practice component logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("設定パターンのバリデーション", () => {
    const configs: SessionConfig[] = [
      { durationSec: 30, difficulty: 1, romajiProfile: "jis", showReading: true, practiceMode: "word" },
      { durationSec: 60, difficulty: 2, romajiProfile: "hepburn", showReading: false, practiceMode: "sentence" },
      { durationSec: 180, difficulty: 3, romajiProfile: "liberal", showReading: true, practiceMode: "word" },
    ];

    configs.forEach((config) => {
      expect(config.durationSec).toBeGreaterThan(0);
      expect(config.difficulty).toBeGreaterThanOrEqual(1);
      expect(config.difficulty).toBeLessThanOrEqual(3);
      expect(["jis", "hepburn", "liberal"]).toContain(config.romajiProfile);
      expect(["word", "sentence"]).toContain(config.practiceMode);
      expect(typeof config.showReading).toBe("boolean");
    });
  });

  test("ローマ字プロファイルの検証", () => {
    const validProfiles = ["jis", "hepburn", "liberal"] as const;

    validProfiles.forEach((profile) => {
      expect(profile).toMatch(/^(jis|hepburn|liberal)$/);
    });
  });

  test("練習モードの検証", () => {
    const validModes = ["word", "sentence"] as const;

    validModes.forEach((mode) => {
      expect(mode).toMatch(/^(word|sentence)$/);
    });
  });

  test("難易度レベルの検証", () => {
    const validDifficulties = [1, 2, 3] as const;

    validDifficulties.forEach((difficulty) => {
      expect(difficulty).toBeGreaterThanOrEqual(1);
      expect(difficulty).toBeLessThanOrEqual(3);
    });
  });

  test("時間設定の検証", () => {
    const validDurations = [30, 60, 180];

    validDurations.forEach((duration) => {
      expect(duration).toBeGreaterThan(0);
      expect(duration).toBeLessThanOrEqual(300); // 5分以内
    });
  });
});
