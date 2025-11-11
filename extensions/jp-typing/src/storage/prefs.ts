import { LocalStorage, getPreferenceValues } from "@raycast/api";
import type { SessionConfig } from "../types";
import { STORAGE_KEYS } from "./schema";

// デフォルト設定
export const DEFAULT_CONFIG: SessionConfig = {
  durationSec: 30,
  difficulty: 2,
  romajiProfile: "hepburn",
  showReading: true,
  practiceMode: "word", // デフォルトは単語モード
};

type TypingPreferences = Preferences.Typing & { defaultDifficulty?: string };

// 設定を読み込む
export async function loadPrefs(): Promise<Partial<SessionConfig>> {
  try {
    const stored = await LocalStorage.getItem<string>(STORAGE_KEYS.PREFS);
    if (!stored) return {};

    return JSON.parse(stored) as Partial<SessionConfig>;
  } catch (error) {
    console.error("Failed to load preferences:", error);
    return {};
  }
}

// 設定を保存する
export async function savePrefs(prefs: Partial<SessionConfig>): Promise<void> {
  try {
    await LocalStorage.setItem(STORAGE_KEYS.PREFS, JSON.stringify(prefs));
  } catch (error) {
    console.error("Failed to save preferences:", error);
    throw error;
  }
}

// 完全な設定を取得する（デフォルト値とマージ）
export async function getConfig(): Promise<SessionConfig> {
  let preferenceOverrides: Partial<SessionConfig> = {};

  try {
    const preferences = getPreferenceValues<TypingPreferences>();
    preferenceOverrides = preferencesToConfig(preferences);
  } catch (error) {
    console.error("Failed to load Raycast preferences:", error);
  }

  const storedPrefs = await loadPrefs();

  // 優先順位: デフォルト < ローカル保存 < Raycastプリファレンス
  // Raycastのプリファレンス変更が即時反映されるよう、最後に適用する
  // undefined をマージで上書きしないように、未定義キーは除外する
  const definedStored: Partial<SessionConfig> = Object.fromEntries(
    Object.entries(storedPrefs).filter(([, v]) => v !== undefined),
  ) as Partial<SessionConfig>;

  const definedOverrides: Partial<SessionConfig> = Object.fromEntries(
    Object.entries(preferenceOverrides).filter(([, v]) => v !== undefined),
  ) as Partial<SessionConfig>;

  return {
    ...DEFAULT_CONFIG,
    ...definedStored,
    ...definedOverrides,
  };
}

function preferencesToConfig(preferences: TypingPreferences): Partial<SessionConfig> {
  const overrides: Partial<SessionConfig> = {
    romajiProfile: preferences.romajiProfile,
    showReading: preferences.showReading,
    practiceMode: preferences.practiceMode,
  };

  const parsedDuration = Number.parseInt(preferences.defaultDurationSec, 10);
  if (!Number.isNaN(parsedDuration)) {
    overrides.durationSec = parsedDuration;
  }

  const rawDifficulty = preferences.defaultDifficulty ?? "";
  const parsedDifficulty = Number.parseInt(rawDifficulty, 10);
  if (!Number.isNaN(parsedDifficulty) && [1, 2, 3].includes(parsedDifficulty)) {
    overrides.difficulty = parsedDifficulty as SessionConfig["difficulty"];
  }

  return overrides;
}
