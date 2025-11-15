import type { Kana, RomajiProfile, RomajiProfileId, RomanizerState, StepOutcome } from "../types";

const JIS_MAP: Record<Kana, string[]> = {
  // 基本五十音
  あ: ["a"],
  い: ["i"],
  う: ["u"],
  え: ["e"],
  お: ["o"],
  か: ["ka"],
  き: ["ki"],
  く: ["ku"],
  け: ["ke"],
  こ: ["ko"],
  さ: ["sa"],
  し: ["shi"],
  す: ["su"],
  せ: ["se"],
  そ: ["so"],
  た: ["ta"],
  ち: ["chi"],
  つ: ["tsu"],
  て: ["te"],
  と: ["to"],
  な: ["na"],
  に: ["ni"],
  ぬ: ["nu"],
  ね: ["ne"],
  の: ["no"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu"],
  へ: ["he"],
  ほ: ["ho"],
  ま: ["ma"],
  み: ["mi"],
  む: ["mu"],
  め: ["me"],
  も: ["mo"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  ん: ["n"],

  // 濁音
  が: ["ga"],
  ぎ: ["gi"],
  ぐ: ["gu"],
  げ: ["ge"],
  ご: ["go"],
  ざ: ["za"],
  じ: ["ji"],
  ず: ["zu"],
  ぜ: ["ze"],
  ぞ: ["zo"],
  だ: ["da"],
  ぢ: ["di"],
  づ: ["du"],
  で: ["de"],
  ど: ["do"],
  ば: ["ba"],
  び: ["bi"],
  ぶ: ["bu"],
  べ: ["be"],
  ぼ: ["bo"],
  ぱ: ["pa"],
  ぴ: ["pi"],
  ぷ: ["pu"],
  ぺ: ["pe"],
  ぽ: ["po"],

  // 拗音
  きゃ: ["kya"],
  きゅ: ["kyu"],
  きょ: ["kyo"],
  しゃ: ["sha"],
  しゅ: ["shu"],
  しょ: ["sho"],
  ちゃ: ["cha"],
  ちゅ: ["chu"],
  ちょ: ["cho"],
  にゃ: ["nya"],
  にゅ: ["nyu"],
  にょ: ["nyo"],
  ひゃ: ["hya"],
  ひゅ: ["hyu"],
  ひょ: ["hyo"],
  みゃ: ["mya"],
  みゅ: ["myu"],
  みょ: ["myo"],
  りゃ: ["rya"],
  りゅ: ["ryu"],
  りょ: ["ryo"],
  ぎゃ: ["gya"],
  ぎゅ: ["gyu"],
  ぎょ: ["gyo"],
  じゃ: ["ja"],
  じゅ: ["ju"],
  じょ: ["jo"],
  びゃ: ["bya"],
  びゅ: ["byu"],
  びょ: ["byo"],
  ぴゃ: ["pya"],
  ぴゅ: ["pyu"],
  ぴょ: ["pyo"],

  // 促音（小さい'っ'）
  っ: [], // 促音は単独では入力されない

  // 長音
  ー: [], // 長音は直前の母音の伸長として処理

  // 句読点
  "、": [","],
  "。": ["."],
};

const HEPBURN_MAP: Record<Kana, string[]> = {
  ...JIS_MAP,
  し: ["shi", "si"],
  ち: ["chi", "ti"],
  つ: ["tsu", "tu"],
  ふ: ["fu", "hu"],
  じ: ["ji", "zi"],
  しゃ: ["sha", "sya"],
  しゅ: ["shu", "syu"],
  しょ: ["sho", "syo"],
  ちゃ: ["cha", "tya"],
  ちゅ: ["chu", "tyu"],
  ちょ: ["cho", "tyo"],
  じゃ: ["ja", "jya", "zya"],
  じゅ: ["ju", "jyu", "zyu"],
  じょ: ["jo", "jyo", "zyo"],
  ん: ["n", "nn"],
};

const LIBERAL_MAP: Record<Kana, string[]> = {
  ...HEPBURN_MAP,
  あ: ["a"],
  い: ["i", "yi"],
  う: ["u", "wu"],
  え: ["e"],
  お: ["o"],
  か: ["ka", "ca"],
  き: ["ki"],
  く: ["ku", "cu"],
  け: ["ke"],
  こ: ["ko", "co"],
  さ: ["sa"],
  し: ["shi", "si", "ci"],
  す: ["su"],
  せ: ["se", "ce"],
  そ: ["so"],
  た: ["ta"],
  ち: ["chi", "ti"],
  つ: ["tsu", "tu"],
  て: ["te"],
  と: ["to"],
  は: ["ha"],
  ひ: ["hi"],
  ふ: ["fu", "hu"],
  へ: ["he"],
  ほ: ["ho"],
  や: ["ya"],
  ゆ: ["yu"],
  よ: ["yo"],
  ら: ["ra"],
  り: ["ri"],
  る: ["ru"],
  れ: ["re"],
  ろ: ["ro"],
  わ: ["wa"],
  を: ["wo"],
  ん: ["n", "nn"],
};

// ローマ字プロファイル定義
export const ROMAJI_PROFILES: Record<RomajiProfileId, RomajiProfile> = {
  jis: {
    id: "jis",
    map: JIS_MAP,
  },
  hepburn: {
    id: "hepburn",
    map: HEPBURN_MAP,
  },
  liberal: {
    id: "liberal",
    map: LIBERAL_MAP,
  },
};

// かなを読み単位に正規化（拗音・促音の処理）
export function normalizeReading(textKana: string): Kana[] {
  const units: Kana[] = [];
  let i = 0;

  while (i < textKana.length) {
    const char = textKana[i];
    const nextChar = textKana[i + 1];

    // 拗音の検出（きゃ、きゅ、きょなど）
    if (nextChar && isSmallKana(nextChar)) {
      units.push(char + nextChar);
      i += 2;
    }
    // 促音の検出
    else if (char === "っ") {
      // 促音は次の文字に依存するので、ここでは単独で追加
      units.push(char);
      i += 1;
    }
    // 長音の検出
    else if (char === "ー") {
      // 長音は前の文字に依存するので、ここでは単独で追加
      units.push(char);
      i += 1;
    }
    // 通常の文字
    else {
      units.push(char);
      i += 1;
    }
  }

  return units;
}

function isSmallKana(char: string): boolean {
  return ["ゃ", "ゅ", "ょ", "ぁ", "ぃ", "ぅ", "ぇ", "ぉ"].includes(char);
}

export function toRomajiUnits(readingUnits: Kana[], profile: RomajiProfile): string[] {
  return readingUnits.map((unit, index) => {
    if (unit === "っ") {
      const nextUnit = readingUnits[index + 1];
      if (!nextUnit) {
        return "xtu";
      }
      const nextRomajis = profile.map[nextUnit] || [];
      const nextFirst = nextRomajis[0]?.[0];
      return nextFirst ? nextFirst : "xtu";
    }

    if (unit === "ー") {
      return "-";
    }

    const romajis = profile.map[unit];
    if (romajis && romajis.length > 0) {
      return romajis[0];
    }

    return unit;
  });
}

export function romanizeReading(reading: string, profileId: RomajiProfileId): string {
  const profile = ROMAJI_PROFILES[profileId];
  const units = normalizeReading(reading);
  return toRomajiUnits(units, profile).join("");
}

// Romanizerの作成
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function createRomanizer(readingUnits: Kana[], profile: RomajiProfile): RomanizerState {
  return {
    unitIndex: 0,
    unitProgress: 0,
    buffer: "",
  };
}

// 1文字入力の処理
export function stepRomanizer(
  state: RomanizerState,
  ch: string,
  readingUnits: Kana[],
  profile: RomajiProfile,
): StepOutcome {
  const newState: RomanizerState = {
    ...state,
    buffer: state.buffer + ch.toLowerCase(),
  };

  // 現在の単位を取得
  if (state.unitIndex >= readingUnits.length) {
    return {
      accepted: false,
      completedUnit: false,
      advancedUnits: 0,
      mistake: true,
      state: newState,
    };
  }

  const currentUnit = readingUnits[state.unitIndex];
  const possibleRomajis = profile.map[currentUnit] || [];

  // 促音の処理
  if (currentUnit === "っ") {
    return handleSokuon(newState, readingUnits, profile);
  }

  // 長音の処理
  if (currentUnit === "ー") {
    return handleChoon(newState, readingUnits, profile);
  }

  // 通常の文字の処理
  const matchedRomaji = possibleRomajis.find((romaji) => romaji.startsWith(newState.buffer));

  if (!matchedRomaji) {
    // マッチするローマ字がない
    return {
      accepted: false,
      completedUnit: false,
      advancedUnits: 0,
      mistake: true,
      state: newState,
    };
  }

  // 完全一致の場合
  if (matchedRomaji === newState.buffer) {
    const nextIndex = state.unitIndex + 1;
    return {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: {
        unitIndex: nextIndex,
        unitProgress: 0,
        buffer: "",
      },
    };
  }

  // 部分一致の場合
  return {
    accepted: true,
    completedUnit: false,
    advancedUnits: 0,
    mistake: false,
    state: newState,
  };
}

// 促音の処理
function handleSokuon(state: RomanizerState, readingUnits: Kana[], profile: RomajiProfile): StepOutcome {
  // 促音は次の文字が子音の場合にのみ有効
  const nextUnit = readingUnits[state.unitIndex + 1];
  if (!nextUnit) {
    return {
      accepted: false,
      completedUnit: false,
      advancedUnits: 0,
      mistake: true,
      state,
    };
  }

  const nextRomajis = profile.map[nextUnit] || [];
  const nextFirstChar = nextRomajis[0]?.[0];

  // 促音の入力パターンをチェック
  if (state.buffer === "lt" || state.buffer === "xt") {
    return {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: {
        unitIndex: state.unitIndex + 1,
        unitProgress: 0,
        buffer: "",
      },
    };
  }

  // 重ね子音のチェック
  if (nextFirstChar && state.buffer === nextFirstChar) {
    return {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: {
        unitIndex: state.unitIndex + 1,
        unitProgress: 0,
        buffer: state.buffer, // 次の文字のためにバッファを保持
      },
    };
  }

  return {
    accepted: false,
    completedUnit: false,
    advancedUnits: 0,
    mistake: true,
    state,
  };
}

// 長音の処理
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function handleChoon(state: RomanizerState, readingUnits: Kana[], profile: RomajiProfile): StepOutcome {
  // 長音は直前の母音を伸長
  if (state.buffer === "-") {
    return {
      accepted: true,
      completedUnit: true,
      advancedUnits: 1,
      mistake: false,
      state: {
        unitIndex: state.unitIndex + 1,
        unitProgress: 0,
        buffer: "",
      },
    };
  }

  return {
    accepted: false,
    completedUnit: false,
    advancedUnits: 0,
    mistake: true,
    state,
  };
}

// バックスペースの処理
export function backspaceRomanizer(state: RomanizerState): RomanizerState {
  if (state.buffer.length > 0) {
    return {
      ...state,
      buffer: state.buffer.slice(0, -1),
    };
  } else if (state.unitIndex > 0) {
    // 前の単位に戻る
    return {
      unitIndex: state.unitIndex - 1,
      unitProgress: 0,
      buffer: "", // 簡略化のためバッファをクリア
    };
  }

  return state;
}
