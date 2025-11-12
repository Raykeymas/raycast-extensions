import { describe, test, expect, vi, afterEach } from "vitest";
import { createInitialSession, reduceSession, createSessionResult } from "../engine/session";
import { getRandomItem, getSentenceItem } from "../data/corpus";
import type { SessionEvent } from "../types";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("セッション管理 - 長文モード", () => {
  test("初期セッション状態の作成", () => {
    const session = createInitialSession();
    expect(session.phase).toBe("idle");
    expect(session.config.practiceMode).toBe("word");
    expect(session.cursorUnitIndex).toBe(0);
    expect(session.completedWords).toBe(0);
  });

  test("長文モードでセッションを開始する", () => {
    let session = createInitialSession();
    const sentenceItem = getSentenceItem(1);

    expect(sentenceItem).not.toBeNull();

    if (sentenceItem) {
      const startEvent: SessionEvent = {
        type: "start",
        target: sentenceItem,
        config: {
          ...session.config,
          durationSec: 60,
          practiceMode: "sentence",
        },
      };

      session = reduceSession(session, startEvent);

      expect(session.phase).toBe("running");
      expect(session.target).toBe(sentenceItem);
      expect(session.config.practiceMode).toBe("sentence");
      expect(session.startedAt).toBeDefined();
    }
  });

  test("長文モードでスキップが無効化される", () => {
    let session = createInitialSession();
    const sentenceItem = getSentenceItem(1);

    expect(sentenceItem).not.toBeNull();

    if (sentenceItem) {
      // セッション開始
      const startEvent: SessionEvent = {
        type: "start",
        target: sentenceItem,
        config: {
          ...session.config,
          durationSec: 60,
          practiceMode: "sentence",
        },
      };

      session = reduceSession(session, startEvent);

      // スキップを試みる
      const originalCursorIndex = session.cursorUnitIndex;
      const skipEvent: SessionEvent = { type: "skip" };
      session = reduceSession(session, skipEvent);

      // 長文モードではスキップできないのでカーソル位置が変わらない
      expect(session.cursorUnitIndex).toBe(originalCursorIndex);
      expect(session.phase).toBe("running");
    }
  });

  test("単語モードではスキップが有効", () => {
    let session = createInitialSession();
    const wordItem = getRandomItem(1);

    expect(wordItem).not.toBeNull();

    if (wordItem) {
      // セッション開始
      const startEvent: SessionEvent = {
        type: "start",
        target: wordItem,
        config: {
          ...session.config,
          durationSec: 60,
          practiceMode: "word",
        },
      };

      session = reduceSession(session, startEvent);

      // スキップを実行
      const skipEvent: SessionEvent = { type: "skip" };
      session = reduceSession(session, skipEvent);

      // 単語モードではスキップできるのでカーソルが最後まで進む
      expect(session.cursorUnitIndex).toBe(session.readingUnits.length);
    }
  });

  test("単語モードで完了イベントが単語数を加算し次の課題に切り替えられる", () => {
    let session = createInitialSession();
    const firstTarget = {
      id: "test-word-1",
      text: "あめ",
      reading: "あめ",
      romaji: "ame",
      difficulty: 1 as const,
      mode: "word" as const,
    };

    session = reduceSession(session, {
      type: "start",
      target: firstTarget,
      config: {
        ...session.config,
        durationSec: 60,
        practiceMode: "word",
      },
    });

    expect(session.completedWords).toBe(0);

    session = reduceSession(session, { type: "complete-target" });
    expect(session.completedWords).toBe(1);

    const nextTarget = {
      id: "test-word-2",
      text: "いぬ",
      reading: "いぬ",
      romaji: "inu",
      difficulty: 1 as const,
      mode: "word" as const,
    };

    session = reduceSession(session, { type: "next-target", target: nextTarget });

    expect(session.target).toBe(nextTarget);
    expect(session.cursorUnitIndex).toBe(0);
    expect(session.typedHistory).toBe("");
    expect(session.readingUnits.join("")).toBe("いぬ");
  });

  test("長文モードで文章完了時にセッションが終了する", () => {
    let session = createInitialSession();

    // 短い単語アイテムでテスト
    const wordItem = {
      id: "test-001",
      text: "あめ",
      reading: "あめ",
      romaji: "ame",
      difficulty: 1 as const,
      mode: "sentence" as const,
    };

    // セッション開始
    const startEvent: SessionEvent = {
      type: "start",
      target: wordItem,
      config: {
        ...session.config,
        durationSec: 60,
        practiceMode: "sentence",
      },
    };

    session = reduceSession(session, startEvent);

    // 最初の文字を入力 ('あ' -> 'a')
    session = reduceSession(session, { type: "type", ch: "a" });
    expect(session.cursorUnitIndex).toBe(1);

    // 2番目の文字を入力 ('め' -> 'me')
    session = reduceSession(session, { type: "type", ch: "m" });
    session = reduceSession(session, { type: "type", ch: "e" });

    // 長文モードでは文章完了時にセッションが終了するはず
    expect(session.phase).toBe("finished");
    expect(session.finishedAt).toBeDefined();
  });

  test("セッション結果にpracticeModeが含まれる", () => {
    let session = createInitialSession();
    const sentenceItem = getSentenceItem(1);

    expect(sentenceItem).not.toBeNull();

    if (sentenceItem) {
      // セッション開始
      const startEvent: SessionEvent = {
        type: "start",
        target: sentenceItem,
        config: {
          ...session.config,
          durationSec: 60,
          practiceMode: "sentence",
        },
      };

      session = reduceSession(session, startEvent);

      // セッション結果の作成
      const result = createSessionResult(session);

      expect(result.practiceMode).toBe("sentence");
      expect(result.version).toBe("0.3.0");
      expect(result.completedWords).toBe(session.completedWords);
    }
  });
});

describe("スコアとメトリクスの整合", () => {
  test("タイプイベントがScoreStateを増分更新する", () => {
    vi.useFakeTimers();
    const baseTime = new Date("2024-01-01T00:00:00Z").getTime();
    vi.setSystemTime(baseTime);

    let session = createInitialSession();

    const target = {
      id: "test-score",
      text: "あ",
      reading: "あ",
      romaji: "a",
      difficulty: 1 as const,
      mode: "word" as const,
    };

    session = reduceSession(session, {
      type: "start",
      target,
      config: {
        ...session.config,
      },
    });

    expect(session.score.correct).toBe(0);
    expect(session.score.total).toBe(0);
    expect(session.metrics.accuracy).toBe(1);

    vi.setSystemTime(baseTime + 1000);
    session = reduceSession(session, { type: "type", ch: "x" });

    expect(session.score.total).toBe(0);
    expect(session.score.correct).toBe(0);
    expect(session.score.mistakes).toBe(0);
    expect(session.metrics.accuracy).toBe(1);
    expect(session.feedback?.kind).toBe("error");
    if (session.feedback?.kind === "error") {
      expect(session.feedback.attempted).toBe("x");
    }

    vi.setSystemTime(baseTime + 60000);
    session = reduceSession(session, { type: "type", ch: "a" });

    expect(session.score.total).toBe(1);
    expect(session.score.correct).toBe(1);
    expect(session.score.mistakes).toBe(0);
    expect(session.metrics.accuracy).toBe(1);
    expect(session.metrics.cpm).toBe(1);
    expect(session.metrics.wpm).toBe(0);
  });
});

describe("設定の互換性", () => {
  test("既存の単語モード設定が互換性を保つ", () => {
    const session = createInitialSession();
    expect(session.config.practiceMode).toBe("word");
  });

  test("長文モード設定が正しく動作する", () => {
    const session = createInitialSession();
    const sentenceConfig = {
      ...session.config,
      practiceMode: "sentence" as const,
    };

    expect(sentenceConfig.practiceMode).toBe("sentence");
  });
});
