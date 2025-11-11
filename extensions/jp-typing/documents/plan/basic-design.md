# 日本語タイピング練習（Raycast拡張）— 基本設計 v0.1

- 版: v0.1（初回ドラフト）
- 対象: Raycast Extension（TypeScript, @raycast/api）
- 目的: 要件定義（requirements.md）に基づき、MVP実装の構成・モジュール・データ・フローを定義する。

## 1. 全体方針 / アーキテクチャ概要
- 構成: 単一拡張内に「コマンド（練習）」＋「エンジン層」＋「ストレージ層」＋「内蔵コーパス」。
- 依存: `@raycast/api` / `@raycast/utils` のみ（MVPは新規依存なし）。
- 画面方針: Raycastの `Form` と `Detail` を組み合わせ、Typing用のテキスト入力と進捗の可視化を同画面で行う。
- 入力方針: IME OFF を推奨（ASCIIのみ受理）。`onChange` で入力テキストを取得し、エンジンで即時判定。
- データ保持: 履歴は LocalStorage（JSON）に保存。ローテーションで保持件数を管理。

## 2. 画面・コマンド構成
- コマンド（MVP）
  - `typing`: 日本語タイピング練習（viewモード）。
- 画面遷移
  - 起動（説明/設定表示の簡易セクション）→ 練習画面（入力・進捗）→ 結果表示（保存・再挑戦）。
- 主要UI
  - `Form`（`TextField` で入力）+ `Detail`（出題・ハイライト・残り時間・メトリクス）。
  - `ActionPanel`（開始/一時停止/再開/スキップ/終了）。

## 3. ディレクトリ/ファイル配置（提案）
- `src/commands/typing.tsx`: エントリ。画面切替、セッション開始/終了、ショートカット。
- `src/views/Practice.tsx`: 練習画面（Form + Detail UI）。
- `src/views/Result.tsx`: 結果画面（サマリ/保存/再挑戦）。
- `src/engine/session.ts`: セッション状態管理（FSM）。
- `src/engine/romanizer.ts`: ローマ字判定エンジン（表記ゆれ対応）。
- `src/engine/scorer.ts`: 採点/メトリクス（CPM/WPM/正確性/連続正打）。
- `src/data/corpus.ts`: 内蔵コーパス（単語/短文）。
- `src/storage/history.ts`: 履歴の保存/取得/ローテーション。
- `src/storage/schema.ts`: スキーマ定義/バージョン。
- `src/utils/time.ts`: タイマ、フォーマット等。

## 4. 型定義 / データモデル
```ts
// かな・読みの最小単位（拗音・促音は1単位に正規化）
export type Kana = string;

export interface CorpusItem {
  id: string;
  text: string;       // 表示用（日本語）
  reading: string;    // ひらがな
  difficulty: 1 | 2 | 3;
}

export interface SessionConfig {
  durationSec: number;            // 30/60/180
  romajiProfile: RomajiProfileId; // 'jis' | 'hepburn' | 'liberal'
  showReading: boolean;
  skipPenalty: boolean;
}

export interface TypingMetrics {
  cpm: number; // characters per minute
  wpm: number; // words per minute（5打=1語換算）
  accuracy: number; // 0..1
  mistakes: number;
  streakMax: number;
  skips: number;
}

export type SessionPhase = 'idle' | 'running' | 'paused' | 'finished';

export interface SessionState {
  id: string;
  phase: SessionPhase;
  startedAt?: string; // ISO
  finishedAt?: string; // ISO
  target?: CorpusItem;
  readingUnits: Kana[];  // 例: ['し', 'ん', 'か', 'ん', 'せ', 'ん']
  cursorUnitIndex: number; // 0..N
  typedBuffer: string;     // 入力中のローマ字バッファ（単位境界またぎ対応）
  metrics: TypingMetrics;
  config: SessionConfig;
}

export interface SessionResult extends TypingMetrics {
  id: string;              // sess-...
  durationSec: number;
  finishedAt: string;      // ISO
  version: string;         // スキーマバージョン
}

export type RomajiProfileId = 'jis' | 'hepburn' | 'liberal';
```

## 5. ローマ字変換エンジン（設計）
- 目的: 読み（かな）列に対し、ユーザのローマ字入力を逐次照合し、正打/誤打/進捗を判定。
- 基本戦略
  - 読みをモーラ単位に分割（拗音/促音の正規化含む）。
  - 各単位に許容ローマ字列（複数）を割当（プロファイル依存）。
  - 入力は1文字ずつ `typedBuffer` に連結し、先頭から最長一致で単位を確定（貪欲）。
  - 曖昧性（例: n/nn, ltsu/xtu+重子音）はトランジションで許容。
- 主な仕様
  - 大文字/小文字非区別。
  - 記号/句読点はエスケープテーブルで判定。
  - バックスペースは `typedBuffer` または前単位へロールバック。
- 代表API（想定）
```ts
export interface RomanizerState {
  unitIndex: number;    // 現在の読み単位
  unitProgress: number; // 現ローマ字表現での一致進捗
  buffer: string;       // 未確定入力
}

export interface StepOutcome {
  accepted: boolean;        // 入力が有効
  completedUnit: boolean;   // 単位確定
  advancedUnits: number;    // 進んだ単位数（0/1）
  mistake: boolean;         // 誤打（視覚強調用）
  state: RomanizerState;    // 新状態
}

export interface RomajiProfile {
  id: RomajiProfileId;
  // 例: { 'し': ['shi','si'], 'つ': ['tsu','tu'], 'しゃ': ['sha','sya'] }
  map: Record<Kana, string[]>;
}

export function createRomanizer(readingUnits: Kana[], profile: RomajiProfile): RomanizerState;
export function stepRomanizer(state: RomanizerState, ch: string): StepOutcome;
export function normalizeReading(textKana: string): Kana[]; // 促音・拗音の正規化
```

## 6. 採点/メトリクス計算
- 更新トリガ: `stepRomanizer` 実行ごとに計測を更新。
- 指標
  - CPM = 正打文字数 / 経過分
  - WPM = CPM / 5
  - 正確性 = 正打数 / 総タイプ数
  - 連続正打（streakMax）更新、ミス/スキップのカウント
- API（想定）
```ts
export interface ScoreState {
  correct: number;
  total: number;
  mistakes: number;
  streak: number;
  streakMax: number;
  skips: number;
  startedAt: number; // ms
}

export function updateScore(s: ScoreState, outcome: StepOutcome): ScoreState;
export function toMetrics(s: ScoreState, nowMs: number): TypingMetrics;
```

## 7. セッション状態管理（FSM）
- フェーズ: `idle` → `running` ↔ `paused` → `finished`。
- イベント: start, pause, resume, tick, type, backspace, skip, timeout, finish。
- タイマ: 1秒間隔 tick（`setInterval`）。残り0で `finished` へ遷移。
- API（想定）
```ts
export type SessionEvent =
  | { type: 'start'; target: CorpusItem; config: SessionConfig }
  | { type: 'pause' } | { type: 'resume' } | { type: 'finish' }
  | { type: 'tick' } | { type: 'type'; ch: string } | { type: 'backspace' }
  | { type: 'skip' };

export function reduceSession(state: SessionState, ev: SessionEvent): SessionState;
```

## 8. ストレージ設計
- 保存先: `LocalStorage`（JSON文字列）。
- キー命名
  - `jp_typing.history.v1`（配列）
  - `jp_typing.prefs.v1`（任意）
- 上限管理
  - 履歴は N 件（既定 50）でローテーション（古い順にdrop）。
- API（想定）
```ts
export const HISTORY_KEY = 'jp_typing.history.v1';
export const PREFS_KEY = 'jp_typing.prefs.v1';

export async function loadHistory(): Promise<SessionResult[]>;
export async function saveResult(result: SessionResult, max: number): Promise<void>;
export async function loadPrefs(): Promise<Partial<SessionConfig>>;
export async function savePrefs(p: Partial<SessionConfig>): Promise<void>;
```

## 9. 設定（Preferences, package.json 例）
```json
{
  "preferences": [
    {
      "name": "defaultDurationSec",
      "type": "dropdown",
      "title": "Default Duration",
      "default": "60",
      "data": [
        { "title": "30s", "value": "30" },
        { "title": "60s", "value": "60" },
        { "title": "180s", "value": "180" }
      ]
    },
    {
      "name": "romajiProfile",
      "type": "dropdown",
      "title": "Romaji Profile",
      "default": "jis",
      "data": [
        { "title": "JIS", "value": "jis" },
        { "title": "Hepburn", "value": "hepburn" },
        { "title": "Liberal", "value": "liberal" }
      ]
    },
    { "name": "showReading", "type": "checkbox", "title": "Show Kana Reading", "default": true },
    { "name": "skipPenalty", "type": "checkbox", "title": "Skip Penalty", "default": false },
    { "name": "historyRetention", "type": "dropdown", "title": "History Retention", "default": "50", "data": [
      { "title": "10", "value": "10" }, { "title": "50", "value": "50" }, { "title": "100", "value": "100" }, { "title": "300", "value": "300" }
    ] }
  ]
}
```

## 10. UI描画方針（ハイライト）
- `Detail` の Markdown を利用し、入力済み/未入力/誤タイプを装飾。
- 表現例（擬似Markdown）
  - 入力済み: `**強調色**`
  - 誤タイプ: バックグラウンド色つき（`<span style="background:...">`）
- UI構成
  - 上段: 出題テキストと読み（オプション）。
  - 中段: 進捗（ハイライト）。
  - 下段: 残り時間・CPM/WPM・正確性・連続正打。

## 11. ショートカット（ActionPanel）
- Start/Resume: Enter
- Pause: Cmd+P
- Restart: Cmd+R
- Skip: Cmd+Right
- Finish: Cmd+W

## 12. エラーハンドリング
- IME ON 検知は不可のため、初回に注意表示（Toast）。
- 非ASCII入力は無視 or ミス扱い（設定で選択、MVPは無視）。
- ストレージ書込失敗時はToast表示し、実行を継続（履歴は揮発）。

## 13. 非機能・性能対策
- 入力処理はO(1)更新を目標（バッファとインデックス更新のみ）。
- 描画は `useMemo` で差分生成、`setInterval(1000ms)` のみでタイマ。
- 1フレームの更新コストを16ms以内に抑制。

## 14. テスト設計
- 単体（最優先）
  - `romanizer` の表記ゆれ・促音・撥音・長音のケース網羅。
  - `scorer` のメトリクス算出（境界: 0/1字、端数丸め）。
- 簡易E2E（手動）
  - 受入基準（requirements.md）AC-1〜3 を踏襲。
- スナップショット
  - `Detail` マークアップ（開始/進行/終了の3状態）。

## 15. 将来拡張のための拡張点
- コマンド分割: `history` コマンドの独立化、統計ビュー追加。
- コーパス外部インポート: JSON/CSV読み込み（検証・重複排除）。
- ランキング/同期: オプトインの匿名IDと送信レイヤ分離。

## 16. 実装タスク（MVPスプリント）
- 1: 型/スキーマ（session, result, profile）定義。
- 2: `romanizer` の最小実装（し/つ/しゃ/っ/ん/長音）。
- 3: `scorer` と `session` のFSM（start/pause/finish/tick/type）。
- 4: `Practice.tsx`（Form + Detail）での結線と表示。
- 5: 履歴保存/ローテーション実装、結果画面。
- 6: Preferences 反映とデフォルト設定。
- 7: 単体テスト（romanizer/scorer）。

---
備考
- Raycastは現在macOSのみを正式サポート。`package.json` の `platforms: ["Windows"]` は削除検討（実装時に調整）。
- 本設計はMVP前提。実装中の知見に応じて、本書と要件定義の整合を保ちながら最小修正で更新する。
