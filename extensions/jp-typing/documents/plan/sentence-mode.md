# 長文モード実装計画

## 概要

現在の単語モードに加えて、文章単位で練習する長文モードを実装する。

## 1. 要件定義

### 単語モードと長文モードの位置づけ
- **単語モード**: 1単語ずつ練習。完了時に次の問題へ遷移（自動化は別タスクで検討）。
- **長文モード**: 文章全体を連続して入力。途中で次の問題には進まない。

注記: 現状の実装では単語完了時の自動遷移は未実装。長文モード追加と独立して扱う。

### 長文モードの要件
- 文章単位の練習（50-200字程度）
- 途中経過のリアルタイム表示
- 文章の途中でスキップ不可（またはペナルティ付き）
- 長文向けのメトリクス表示
- 進捗バーと残り文字数の表示
 - 表示方針: 初期実装は「読み（かな）ベース」でハイライト。原文（漢字仮名交じり）へのハイライトは将来の拡張（ルビ/セグメント対応）とする。

## 2. データ構造拡張

### CorpusItem拡張（モード区別 + 将来のルビ対応）
```typescript
export interface CorpusItem {
  id: string;
  text: string;
  reading: string;
  difficulty: 1 | 2 | 3;
  mode: "word" | "sentence"; // 新規追加
  // 将来拡張: 原文ハイライト用の読み対応セグメント（長文のみ任意）
  // 例: [{ text: "今日は", reading: "きょうは" }, { text: "いい", reading: "いい" }, ...]
  segments?: Array<{ text: string; reading: string }>;
}
```

### SessionConfig拡張
```typescript
export interface SessionConfig {
  durationSec: number;
  romajiProfile: RomajiProfileId;
  showReading: boolean;
  skipPenalty: boolean;
  practiceMode: "word" | "sentence"; // 新規追加
}
```

### SessionResult拡張（履歴区別のため）
```typescript
export interface SessionResult extends TypingMetrics {
  id: string;
  durationSec: number;
  finishedAt: string;
  version: string;
  practiceMode: "word" | "sentence"; // 新規追加（履歴で区別）
}
```

## 3. 長文コーパス準備

### 文章データ例（text/reading の対）
- **初級**: 簡単な短文（30-50字）
  - text: 「今日はいい天気ですね。」 / reading: 「きょうはいいてんきですね。」
  - text: 「猫が庭で遊んでいます。」 / reading: 「ねこがにわであそんでいます。」
  - text: 「学校に友達と行きます。」 / reading: 「がっこうにともだちといきます。」

- **中級**: 日常的な文章（50-80字）
  - text: 「図書館で本を借りてきたので、今晩読もうと思います。」 / reading: 「としょかんでほんをかりてきたので、こんばんよもうとおもいます。」
  - text: 「新しいスマートフォンを買ったので、設定をしています。」 / reading: 「あたらしいすまーとふぉんをかったので、せっていをしています。」
  - text: 「週末は映画を見て、美味しいものを食べる予定です。」 / reading: 「しゅうまつはえいがをみて、おいしいものをたべるよていです。」

- **上級**: 複雑な文章（80-120字）
  - text: 「環境問題を解決するためには、個人レベルでの取り組みと社会全体の制度改革が不可欠です。」 / reading: 「かんきょうもんだいをかいけつするためには、こじんれべるでのとりくみとしゃかいぜんたいのせいどかいかくがふかけつです。」
  - text: 「技術革新が進む現代では、継続的な学習と適応能力がこれまで以上に重要になっています。」 / reading: 「ぎじゅつかくしんがすすむげんだいでは、けいぞくてきながくしゅうとてきおうのうりょくがこれまでいじょうにじゅうようになっています。」

### コーパス拡張関数
```typescript
export function getSentenceItem(difficulty: 1 | 2 | 3, excludeIds: Set<string> = new Set()): CorpusItem | null {
  const candidates = SENTENCE_CORPUS.filter((item) => 
    item.difficulty === difficulty && 
    item.mode === "sentence" && 
    !excludeIds.has(item.id)
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}
```

備考: 文章アイテムは `text` と `reading` を必ずペアで持つ。原文ハイライトを行う場合は `segments` を用いる（任意）。

## 4. UI設計

### 初期画面にモード選択を追加
```
# 日本語タイピング練習

## 練習モードを選択
- [単語モード] 一語ずつ練習
- [長文モード] 文章で練習

## 設定
- 時間: 60秒
- 難易度: 初級
- ローマ字規則: JIS
- 読み表示: ON
```

### 長文モードの表示調整
- 進捗バー（全体の進捗率）
- 現在位置ハイライト（初期は読みベース）
- 残り文字数の表示
- 文章全体（原文）の表示（折り返し対応、原文ハイライトは将来対応）

### 進捗表示例（読みベースのハイライト + 原文表示）
```
## 原文: 今日はいい天気ですね。
かな: きょうは**い**いてんきですね。

---
### 📊 進捗: 15% (6/40文字)
### ⏱️ 残り時間: 0:45
### 🚀 CPM: 80 | WPM: 16
### 🎯 正確性: 95.0%
### 🔥 連続正打: 12 | ❌ ミス: 2
```

## 5. セッション管理拡張

### 練習モードによる挙動変更
- **単語モード**: 完了時に自動で次の問題へ
- **長文モード**: 文章全体で完了、時間切れまたは手動終了

### イベント処理の調整
```typescript
// 長文モードではスキップを無効化
function handleSkip(state: SessionState): SessionState {
  if (state.config.practiceMode === "sentence") {
    // 長文モードではスキップ不可
    return state;
  }
  // 既存の単語モード処理（単語完了→次問題へ遷移など）
  return handleSkipForWordMode(state);
}

// 長文モード完了時の処理
function handleType(state: SessionState, event: { type: "type"; ch: string }): SessionState {
  const updated = // 既存の処理
  
  // 長文モードで文章完了の場合はセッション終了
  if (state.config.practiceMode === "sentence" && 
      updated.cursorUnitIndex >= updated.readingUnits.length) {
    return handleFinish(updated);
  }
  
  return updated;
}
```

## 6. メトリクス調整

### 長文向けの追加表示
- 進捗率（完成文字数/総文字数）
- 残り文字数
- 文章単位のWPM計算調整

### 表示の改善
```typescript
// 長文モードでの進捗表示
const generateProgressDisplay = useCallback(() => {
  if (!sessionState.target) return "";

  const { text, reading } = sessionState.target;
  const { cursorUnitIndex, readingUnits } = sessionState;
  const isSentenceMode = sessionState.config.practiceMode === "sentence";

  // 進捗率計算
  const progressPercent = Math.round((cursorUnitIndex / readingUnits.length) * 100);
  const remainingChars = readingUnits.length - cursorUnitIndex;

  // 完了している場合
  if (cursorUnitIndex >= readingUnits.length) {
    return `## ✅ ${text}`;
  }

  // 読みの表示（長文モードでは非推奨）
  const readingDisplay = config.showReading && !isSentenceMode ? `\n\n**読み:** ${reading}` : "";

  // 進捗のハイライト
  const completedUnits = readingUnits.slice(0, cursorUnitIndex);
  const currentUnit = readingUnits[cursorUnitIndex];
  const remainingUnits = readingUnits.slice(cursorUnitIndex + 1);

  let display = `## ${completedUnits.join("")}**${currentUnit}**${remainingUnits.join("")}${readingDisplay}`;
  
  // 長文モードでは進捗情報を追加
  if (isSentenceMode) {
    display += `\n\n### 📊 進捗: ${progressPercent}% (${cursorUnitIndex}/${readingUnits.length}文字)`;
  }

  return display;
}, [sessionState, config.showReading]);
```

## 7. 設定管理拡張

### デフォルト設定追加
```typescript
export const DEFAULT_CONFIG: SessionConfig = {
  durationSec: 60,
  romajiProfile: "jis",
  showReading: true,
  skipPenalty: false,
  practiceMode: "word", // デフォルトは単語モード
};
```

### LocalStorageスキーマ拡張
```typescript
interface Preferences {
  durationSec: number;
  romajiProfile: RomajiProfileId;
  showReading: boolean;
  skipPenalty: boolean;
  practiceMode: "word" | "sentence";
}
```

履歴スキーマへの追記（バージョン更新を伴う）
```typescript
// schema.ts の例
export const SCHEMA_VERSION = "0.2.0"; // 0.1.0 から更新

// SessionResult に practiceMode を追加したため、履歴の保存/読み出しで未定義の場合は "word" を既定扱いとする。
```

## 8. 実装順序

1. **型定義拡張** - `types/index.ts`にモード関連の型（`practiceMode`、`CorpusItem.mode`、任意`segments`、`SessionResult.practiceMode`）を追加
2. **コーパス拡張** - `data/corpus.ts`に長文データと取得関数を追加
3. **設定管理** - `storage/prefs.ts`にモード選択を追加
4. **セッション管理** - `engine/session.ts`で長文モードの挙動（スキップ無効/完了で終了）を実装
5. **UI実装** - `views/Practice.tsx`でモード選択と長文表示（読みベース）を実装
6. **テスト追加** - 各機能のテストを実装
7. （任意）**原文ハイライト** - `segments` を利用した原文側ハイライトを実装

## 9. 主要な変更点

- **練習モード**: 単語モードと長文モードの選択
- **UI拡張**: 初期画面にモード選択、長文で進捗バー表示
- **挙動変更**: 長文モードではスキップ無効化、文章単位の練習
- **データ追加**: 50-120字程度の日本語文章コーパス

## 10. 互換性

- 既存の単語モードは互換維持（挙動は従来どおり）
- デフォルト設定は単語モード
- 設定はLocalStorageに保存
- 履歴スキーマは `practiceMode` 追加で `0.2.0` に更新。旧データ（0.1.0）は `practiceMode: "word"` とみなして読み出す（マイグレーション不要）。

## 11. テスト計画

### 単体テスト
- 長文コーパスの取得関数
- セッション管理のモード別挙動
- メトリクス計算の正確性
 - スキップ無効化の確認（sentenceモード）

### 統合テスト
- モード選択から練習完了までのフロー
- 設定の保存と読み込み
- UIの表示とインタラクション
 - （任意）segments による原文ハイライト一致

### 手動テスト
- 各難易度の長文練習
- 途中終了と再開
- 設定変更の反映確認

## 12. 今後の拡張案

- 自作文モード（ユーザーが文章を登録）
- 速度調整機能（WPM目標設定）
- 長文コーパスのカテゴリ分類（ニュース、小説など）
- 音声読み上げ機能
