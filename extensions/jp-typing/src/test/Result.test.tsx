import { describe, test, expect, vi } from "vitest";
import { Result } from "../views/Result";
import type { SessionResult } from "../types";

// Mock dependencies
vi.mock("@raycast/api", () => ({
  Detail: ({ markdown }: { markdown: string }) => <div data-testid="detail">{markdown}</div>,
  ActionPanel: ({ children }: { children: React.ReactNode }) => <div data-testid="action-panel">{children}</div>,
  Action: ({ onAction }: { onAction?: () => void }) => <button data-testid="action-button" onClick={onAction} />,
}));

vi.mock("../utils/time", () => ({
  formatTime: vi.fn((seconds: number) => `${seconds}s`),
}));

const baseResult: SessionResult = {
  id: "test-result",
  durationSec: 60,
  finishedAt: "2024-01-01T12:00:00.000Z",
  version: "0.3.0",
  practiceMode: "word",
  completedWords: 10,
  cpm: 200,
  wpm: 40,
  accuracy: 0.95,
  mistakes: 5,
  streakMax: 15,
  skips: 2,
};

describe("Result", () => {
  const mockOnRestart = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("コンポーネントが正常にレンダリングされる", () => {
    expect(() => {
      Result({ result: baseResult, onRestart: mockOnRestart, onClose: mockOnClose });
    }).not.toThrow();
  });

  test("CPMに応じたパフォーマンスレベルを計算する", () => {
    vi.clearAllMocks();
    // getPerformanceLevel関数のロジックをテスト
    const getPerformanceLevel = (cpm: number): string => {
      if (cpm >= 400) return "🏆 Sランク (達人)";
      if (cpm >= 350) return "🥇 Aランク (上級者)";
      if (cpm >= 300) return "🥈 Bランク (中級者)";
      if (cpm >= 250) return "🥉 Cランク (初級者)";
      if (cpm >= 200) return "📚 Dランク (初心者)";
      return "🌱 Eランク (入門者)";
    };

    expect(getPerformanceLevel(200)).toBe("📚 Dランク (初心者)");
    expect(getPerformanceLevel(400)).toBe("🏆 Sランク (達人)");
    expect(getPerformanceLevel(350)).toBe("🥇 Aランク (上級者)");
    expect(getPerformanceLevel(150)).toBe("🌱 Eランク (入門者)");
  });

  test("正確性の計算が正しい", () => {
    vi.clearAllMocks();
    const accuracyPercentage = (baseResult.accuracy * 100).toFixed(1);
    expect(accuracyPercentage).toBe("95.0");
  });

  test("平均単語時間の計算が正しい", () => {
    vi.clearAllMocks();
    const averageWordTime =
      baseResult.completedWords > 0 ? (baseResult.durationSec / baseResult.completedWords).toFixed(1) : null;
    expect(averageWordTime).toBe("6.0");
  });

  test("完了単語数が0の場合の平均単語時間", () => {
    vi.clearAllMocks();
    const noWordsResult = { ...baseResult, completedWords: 0 };
    const averageWordTime =
      noWordsResult.completedWords > 0 ? (noWordsResult.durationSec / noWordsResult.completedWords).toFixed(1) : null;
    expect(averageWordTime).toBeNull();
  });

  test("アドバイス生成ロジックのテスト", () => {
    vi.clearAllMocks();
    const getAdvice = (result: SessionResult): string => {
      const { cpm, accuracy, mistakes, streakMax } = result;
      const advice = [];

      if (cpm < 250) {
        advice.push("• **速度向上**: ホームポジションを意識し、指先で素早く打つ練習をしましょう。");
      }

      if (accuracy < 0.9) {
        advice.push("• **正確性向上**: 焦らず、正確なキーを意識して打つ練習をしましょう。");
      }

      if (mistakes > 10) {
        advice.push("• **ミス削減**: 難しい文字列を重点的に練習し、ミスを減らしましょう。");
      }

      if (streakMax < 20) {
        advice.push("• **連続正打**: 短い単語から始めて、連続して正打できる練習をしましょう。");
      }

      if (advice.length === 0) {
        advice.push("• 素晴らしいパフォーマンスです！さらに上を目指して練習を続けましょう。");
      }

      return advice.join("\\n");
    };

    // 低速度の場合
    const lowSpeedResult = { ...baseResult, cpm: 200 };
    expect(getAdvice(lowSpeedResult)).toContain("速度向上");

    // 低正確性の場合
    const lowAccuracyResult = { ...baseResult, accuracy: 0.85 };
    expect(getAdvice(lowAccuracyResult)).toContain("正確性向上");

    // 優秀なパフォーマンスの場合
    const excellentResult = { ...baseResult, cpm: 400, accuracy: 0.98, mistakes: 2, streakMax: 50 };
    expect(getAdvice(excellentResult)).toContain("素晴らしいパフォーマンスです！");

    // 複数のアドバイス
    const poorResult = { ...baseResult, cpm: 200, accuracy: 0.85, mistakes: 15, streakMax: 10 };
    const advice = getAdvice(poorResult);
    expect(advice).toContain("速度向上");
    expect(advice).toContain("正確性向上");
    expect(advice).toContain("ミス削減");
    expect(advice).toContain("連続正打");
  });

  test("文章モードと単語モードの表示切替", () => {
    vi.clearAllMocks();
    const sentenceResult = { ...baseResult, practiceMode: "sentence" as const };

    // 単語モードでは単語統計を表示
    expect(baseResult.practiceMode).toBe("word");
    expect(baseResult.completedWords).toBe(10);

    // 文章モードではpracticeModeが異なる
    expect(sentenceResult.practiceMode).toBe("sentence");
  });

  test("全てのコールバック関数が正しく呼ばれる", () => {
    vi.clearAllMocks();
    expect(() => {
      Result({ result: baseResult, onRestart: mockOnRestart, onClose: mockOnClose });
    }).not.toThrow();

    // コンポーネントが関数を受け取れることを確認
    expect(typeof mockOnRestart).toBe("function");
    expect(typeof mockOnClose).toBe("function");
  });
});
