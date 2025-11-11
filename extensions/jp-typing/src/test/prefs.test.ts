import { describe, test, expect, beforeEach, vi } from "vitest";
import { getConfig } from "../storage/prefs";
import { LocalStorage, getPreferenceValues } from "@raycast/api";

vi.mock("@raycast/api", () => {
  const storageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };

  return {
    LocalStorage: storageMock,
    getPreferenceValues: vi.fn(),
  };
});

const mockedLocalStorage = LocalStorage as unknown as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

const mockedGetPreferenceValues = getPreferenceValues as unknown as ReturnType<typeof vi.fn>;

const basePreferences = {
  defaultDurationSec: "60",
  defaultDifficulty: "2",
  romajiProfile: "hepburn",
  showReading: true,
  practiceMode: "word",
} as Preferences.Typing & { defaultDifficulty?: string };

describe("getConfig", () => {
  beforeEach(() => {
    mockedLocalStorage.getItem.mockReset();
    mockedLocalStorage.setItem.mockReset();
    mockedLocalStorage.removeItem.mockReset();
    mockedLocalStorage.getItem.mockResolvedValue(undefined);

    mockedGetPreferenceValues.mockReset();
    mockedGetPreferenceValues.mockReturnValue(basePreferences);
  });

  test("Raycastのプリファレンスを適用してモード・時間・難易度を設定できる", async () => {
    mockedGetPreferenceValues.mockReturnValue({
      ...basePreferences,
      practiceMode: "sentence",
      defaultDurationSec: "180",
      defaultDifficulty: "3",
    });

    const config = await getConfig();

    expect(config.practiceMode).toBe("sentence");
    expect(config.durationSec).toBe(180);
    expect(config.difficulty).toBe(3);
  });

  test("Raycastプリファレンスがローカル保存より優先される", async () => {
    mockedGetPreferenceValues.mockReturnValue({
      ...basePreferences,
      practiceMode: "sentence",
    });

    mockedLocalStorage.getItem.mockResolvedValue(
      JSON.stringify({
        practiceMode: "word",
        durationSec: 30,
        difficulty: 1,
      }),
    );

    const config = await getConfig();

    // Raycastプリファレンスが最終的に上書きされる
    expect(config.practiceMode).toBe("sentence");
    // durationSecもRaycast（デフォルト60）が優先される
    expect(config.durationSec).toBe(60);
    // difficultyもRaycast（デフォルト2）が優先される
    expect(config.difficulty).toBe(2);
  });

  test("Raycastプリファレンス未設定時はデフォルト値を保持する", async () => {
    mockedGetPreferenceValues.mockReturnValue({
      ...basePreferences,
      // 未設定を想定（Raycast 側に項目がないケース）
      defaultDurationSec: undefined as unknown as string,
      defaultDifficulty: undefined,
    });

    const config = await getConfig();

    expect(config.durationSec).toBe(30);
    expect(config.difficulty).toBe(2);
  });

  test("Raycastプリファレンスに無効値があってもデフォルトを保持する", async () => {
    mockedGetPreferenceValues.mockReturnValue({
      ...basePreferences,
      defaultDurationSec: "abc", // 無効
      defaultDifficulty: "99", // 範囲外
    });

    const config = await getConfig();

    expect(config.durationSec).toBe(30);
    expect(config.difficulty).toBe(2);
  });
});
