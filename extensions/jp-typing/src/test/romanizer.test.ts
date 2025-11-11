import { describe, test, expect } from "vitest";
import { normalizeReading, stepRomanizer, ROMAJI_PROFILES } from "../engine/romanizer";
import type { RomanizerState } from "../types";

describe("normalizeReading", () => {
  test("基本的なひらがなを正しく分割する", () => {
    expect(normalizeReading("あめ")).toEqual(["あ", "め"]);
    expect(normalizeReading("かぜ")).toEqual(["か", "ぜ"]);
    expect(normalizeReading("いぬ")).toEqual(["い", "ぬ"]);
  });

  test("拗音を正しく認識する", () => {
    expect(normalizeReading("しゃ")).toEqual(["しゃ"]);
    expect(normalizeReading("きょ")).toEqual(["きょ"]);
    expect(normalizeReading("ちゅ")).toEqual(["ちゅ"]);
  });

  test("促音を正しく認識する", () => {
    expect(normalizeReading("がっこう")).toEqual(["が", "っ", "こ", "う"]);
    expect(normalizeReading("きって")).toEqual(["き", "っ", "て"]);
  });

  test("長音を正しく認識する", () => {
    expect(normalizeReading("おばあさん")).toEqual(["お", "ば", "あ", "さ", "ん"]);
    expect(normalizeReading("ゆうめい")).toEqual(["ゆ", "う", "め", "い"]);
  });

  test("複合的な文字列を正しく分割する", () => {
    expect(normalizeReading("きょうがっこう")).toEqual(["きょ", "う", "が", "っ", "こ", "う"]);
    expect(normalizeReading("ちゅうがっこう")).toEqual(["ちゅ", "う", "が", "っ", "こ", "う"]);
  });

  test("句読点を単独の単位として保持する", () => {
    expect(normalizeReading("ねこ、いぬ。")).toEqual(["ね", "こ", "、", "い", "ぬ", "。"]);
  });
});

describe("stepRomanizer", () => {
  const jisProfile = ROMAJI_PROFILES.jis;

  test("基本的な文字の入力を正しく処理する", () => {
    const readingUnits = ["あ", "め"];
    let state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    // 'a'を入力
    let result = stepRomanizer(state, "a", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.advancedUnits).toBe(1);
    expect(result.mistake).toBe(false);
    expect(result.state.unitIndex).toBe(1);

    state = result.state;

    // 'me'を入力
    result = stepRomanizer(state, "m", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(false);
    expect(result.mistake).toBe(false);

    state = result.state;
    result = stepRomanizer(state, "e", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.advancedUnits).toBe(1);
  });

  test("表記ゆれを許容する", () => {
    const readingUnits = ["し"];
    let state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    // Hepburnプロファイルで'si'を入力
    const hepburnProfile = ROMAJI_PROFILES.hepburn;
    let result = stepRomanizer(state, "s", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "i", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
  });

  test("拗音の入力を正しく処理する", () => {
    const readingUnits = ["しゃ"];
    let state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    // 'sha'を入力
    let result = stepRomanizer(state, "s", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "h", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "a", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
  });

  test("誤った入力を検出する", () => {
    const readingUnits = ["あ"];
    const state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    // 'k'を入力（'a'ではない）
    const result = stepRomanizer(state, "k", readingUnits, jisProfile);
    expect(result.accepted).toBe(false);
    expect(result.mistake).toBe(true);
  });

  test("大文字小文字を区別しない", () => {
    const readingUnits = ["あ"];
    const state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    // 'A'を入力
    const result = stepRomanizer(state, "A", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.mistake).toBe(false);
  });

  test("句読点の入力を受け付ける", () => {
    const readingUnits = ["、", "。"];
    let state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    let result = stepRomanizer(state, ",", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.advancedUnits).toBe(1);
    expect(result.mistake).toBe(false);

    state = result.state;

    result = stepRomanizer(state, ".", readingUnits, jisProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.advancedUnits).toBe(1);
    expect(result.mistake).toBe(false);
  });
});

describe("ローマ字プロファイル", () => {
  test("JISプロファイルの基本文字", () => {
    const jisProfile = ROMAJI_PROFILES.jis;
    expect(jisProfile.map["し"]).toEqual(["shi"]);
    expect(jisProfile.map["つ"]).toEqual(["tsu"]);
    expect(jisProfile.map["ふ"]).toEqual(["fu"]);
  });

  test("Hepburnプロファイルの表記ゆれ", () => {
    const hepburnProfile = ROMAJI_PROFILES.hepburn;
    expect(hepburnProfile.map["し"]).toEqual(["shi", "si"]);
    expect(hepburnProfile.map["つ"]).toEqual(["tsu", "tu"]);
    expect(hepburnProfile.map["ふ"]).toEqual(["fu", "hu"]);
    expect(hepburnProfile.map["ん"]).toEqual(["n", "nn"]);
  });

  test("Liberalプロファイルの寛容な表記", () => {
    const liberalProfile = ROMAJI_PROFILES.liberal;
    expect(liberalProfile.map["し"]).toContain("shi");
    expect(liberalProfile.map["し"]).toContain("si");
    expect(liberalProfile.map["し"]).toContain("ci");
    expect(liberalProfile.map["か"]).toContain("ka");
    expect(liberalProfile.map["か"]).toContain("ca");
  });

  test("じゃじゅじょにzyazyuzyoを許容する", () => {
    const hepburnProfile = ROMAJI_PROFILES.hepburn;
    expect(hepburnProfile.map["じゃ"]).toContain("ja");
    expect(hepburnProfile.map["じゃ"]).toContain("jya");
    expect(hepburnProfile.map["じゃ"]).toContain("zya");
    expect(hepburnProfile.map["じゅ"]).toContain("ju");
    expect(hepburnProfile.map["じゅ"]).toContain("jyu");
    expect(hepburnProfile.map["じゅ"]).toContain("zyu");
    expect(hepburnProfile.map["じょ"]).toContain("jo");
    expect(hepburnProfile.map["じょ"]).toContain("jyo");
    expect(hepburnProfile.map["じょ"]).toContain("zyo");
  });

  test("zyazyuzyoの実際の入力テスト", () => {
    const readingUnits = ["じゃ", "じゅ", "じょ"];
    const hepburnProfile = ROMAJI_PROFILES.hepburn;
    let state: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };

    // 'zya'でじゃを入力
    let result = stepRomanizer(state, "z", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);
    expect(result.mistake).toBe(false);

    state = result.state;
    result = stepRomanizer(state, "y", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);
    expect(result.mistake).toBe(false);

    state = result.state;
    result = stepRomanizer(state, "a", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.mistake).toBe(false);
    expect(result.state.unitIndex).toBe(1);

    // 'zyu'でじゅを入力
    state = result.state;
    result = stepRomanizer(state, "z", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "y", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "u", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.mistake).toBe(false);
    expect(result.state.unitIndex).toBe(2);

    // 'zyo'でじょを入力
    state = result.state;
    result = stepRomanizer(state, "z", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "y", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);

    state = result.state;
    result = stepRomanizer(state, "o", readingUnits, hepburnProfile);
    expect(result.accepted).toBe(true);
    expect(result.completedUnit).toBe(true);
    expect(result.mistake).toBe(false);
    expect(result.state.unitIndex).toBe(3);
  });
});
