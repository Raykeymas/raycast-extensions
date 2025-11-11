import { describe, test, expect } from "vitest";
import { createScoreState, updateScore, skipScore, toMetrics } from "../engine/scorer";
import type { StepOutcome } from "../types";

describe("createScoreState", () => {
  test("初期スコア状態を正しく作成する", () => {
    const state = createScoreState();

    expect(state.correct).toBe(0);
    expect(state.total).toBe(0);
    expect(state.mistakes).toBe(0);
    expect(state.streak).toBe(0);
    expect(state.streakMax).toBe(0);
    expect(state.skips).toBe(0);
    expect(state.startedAt).toBeGreaterThan(0);
  });
});

describe("updateScore", () => {
  test("正しい入力を正しく処理する", () => {
    let state = createScoreState();

    const correctOutcome: StepOutcome = {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: { unitIndex: 1, unitProgress: 0, buffer: "" },
    };

    state = updateScore(state, correctOutcome);

    expect(state.correct).toBe(1);
    expect(state.total).toBe(1);
    expect(state.mistakes).toBe(0);
    expect(state.streak).toBe(1);
    expect(state.streakMax).toBe(1);
  });

  test("ミスを正しく処理する", () => {
    let state = createScoreState();

    const mistakeOutcome: StepOutcome = {
      accepted: true,
      completedUnit: false,
      advancedUnits: 0,
      mistake: true,
      state: { unitIndex: 0, unitProgress: 0, buffer: "x" },
    };

    state = updateScore(state, mistakeOutcome);

    expect(state.correct).toBe(0);
    expect(state.total).toBe(1);
    expect(state.mistakes).toBe(1);
    expect(state.streak).toBe(0);
    expect(state.streakMax).toBe(0);
  });

  test("連続正打を正しく記録する", () => {
    let state = createScoreState();

    const correctOutcome: StepOutcome = {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: { unitIndex: 1, unitProgress: 0, buffer: "" },
    };

    // 3回連続で正しい入力
    state = updateScore(state, correctOutcome);
    state = updateScore(state, correctOutcome);
    state = updateScore(state, correctOutcome);

    expect(state.correct).toBe(3);
    expect(state.streak).toBe(3);
    expect(state.streakMax).toBe(3);
  });

  test("ミスで連続正打がリセットされる", () => {
    let state = createScoreState();

    const correctOutcome: StepOutcome = {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: { unitIndex: 1, unitProgress: 0, buffer: "" },
    };

    const mistakeOutcome: StepOutcome = {
      accepted: true,
      completedUnit: false,
      advancedUnits: 0,
      mistake: true,
      state: { unitIndex: 0, unitProgress: 0, buffer: "x" },
    };

    // 2回正入力後、1回ミス
    state = updateScore(state, correctOutcome);
    state = updateScore(state, correctOutcome);
    expect(state.streak).toBe(2);
    expect(state.streakMax).toBe(2);

    state = updateScore(state, mistakeOutcome);
    expect(state.streak).toBe(0);
    expect(state.streakMax).toBe(2); // 最大記録は維持
  });
});

describe("skipScore", () => {
  test("スキップを正しく処理する", () => {
    let state = createScoreState();

    // まずいくつか正入力
    const correctOutcome: StepOutcome = {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: { unitIndex: 1, unitProgress: 0, buffer: "" },
    };

    state = updateScore(state, correctOutcome);
    state = updateScore(state, correctOutcome);
    expect(state.streak).toBe(2);

    // スキップ
    state = skipScore(state);

    expect(state.skips).toBe(1);
    expect(state.streak).toBe(0); // 連続正打はリセット
    expect(state.correct).toBe(2); // 正打数は維持
  });
});

describe("toMetrics", () => {
  test("メトリクスを正しく計算する", () => {
    const now = Date.now();
    const startedAt = now - 60000; // 1分前

    let state = createScoreState();
    state.startedAt = startedAt;

    // 30回正入力、3回ミス
    for (let i = 0; i < 30; i++) {
      const correctOutcome: StepOutcome = {
        accepted: true,
        completedUnit: true,
        advancedUnits: 1,
        mistake: false,
        state: { unitIndex: i + 1, unitProgress: 0, buffer: "" },
      };
      state = updateScore(state, correctOutcome);
    }

    for (let i = 0; i < 3; i++) {
      const mistakeOutcome: StepOutcome = {
        accepted: true,
        completedUnit: false,
        advancedUnits: 0,
        mistake: true,
        state: { unitIndex: 30, unitProgress: 0, buffer: "x" },
      };
      state = updateScore(state, mistakeOutcome);
    }

    const metrics = toMetrics(state, now);

    expect(metrics.cpm).toBe(30); // 30文字/分
    expect(metrics.wpm).toBe(6); // 30/5 = 6単語/分
    expect(metrics.accuracy).toBeCloseTo(30 / 33, 2); // 30/33 ≈ 0.91
    expect(metrics.mistakes).toBe(3);
    expect(metrics.streakMax).toBe(30);
    expect(metrics.skips).toBe(0);
  });

  test("経過時間が0の場合のメトリクス", () => {
    const now = Date.now();
    const state = createScoreState();
    state.startedAt = now; // 同じ時刻

    const metrics = toMetrics(state, now);

    expect(metrics.cpm).toBe(0);
    expect(metrics.wpm).toBe(0);
    expect(metrics.accuracy).toBe(1); // デフォルト値
  });

  test("正確性の計算", () => {
    const now = Date.now();
    let state = createScoreState();

    // 5回正入力、5回ミス
    for (let i = 0; i < 5; i++) {
      const correctOutcome: StepOutcome = {
        accepted: true,
        completedUnit: true,
        advancedUnits: 1,
        mistake: false,
        state: { unitIndex: i + 1, unitProgress: 0, buffer: "" },
      };
      state = updateScore(state, correctOutcome);
    }

    for (let i = 0; i < 5; i++) {
      const mistakeOutcome: StepOutcome = {
        accepted: true,
        completedUnit: false,
        advancedUnits: 0,
        mistake: true,
        state: { unitIndex: 5, unitProgress: 0, buffer: "x" },
      };
      state = updateScore(state, mistakeOutcome);
    }

    const metrics = toMetrics(state, now + 60000); // 1分後

    expect(metrics.accuracy).toBeCloseTo(0.5, 2); // 5/10 = 0.5
  });
});
