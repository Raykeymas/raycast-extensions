# リファクタリング評価（2025-02-14）

## 1. 判定
- 結論: **大規模リファクタリングが必要**。採点ロジックとUI制御が密結合かつ不整合で、設定・コンテンツ供給の抽象化不足により拡張性と信頼性が損なわれている。

## 2. 観測結果

### 2.1 セッション採点ロジックの再構成が無い
- `reduceSession` はキー入力ごとに `createScoreStateFromMetrics` を呼び、既存メトリクスから擬似的に `ScoreState` を再構成している（`src/engine/session.ts:159-240`）。`estimatedCorrect = Math.round(metrics.accuracy * 100)` としており、打鍵数に無関係な固定値100付近から再計算されるため、精度・CPM/WPMが即座に破綻する。
- `SessionState` に生の `ScoreState` が保持されておらず、`skipPenalty` や連続正打などの派生指標を正確に蓄積できない。結果として将来のメトリクス追加・履歴保存処理も困難。

### 2.2 Practiceビューの責務肥大化と状態遷移の欠落
- `Practice` コンポーネントが UI（Raycast List/Detail）・タイマー制御・コーパス選定・入力差分計算を1ファイルで抱えており（`src/views/Practice.tsx:14-200`）、副作用だらけで単体テスト不能。
- 単語モードで問題を解き終わった際に次の `target` を読み込む仕組みが存在せず、スキップ操作のみが疑似的に `startSession` を再呼び出している（`src/views/Practice.tsx:87-98`）。これにより1問解答後に入力が全てエラー扱いになり学習が継続できない。
- `usedItemIds` は `Set` に追加するだけで枯渇時のリセットがなく、10問（難易度1の語彙数）消化で必ず `No available items` になり練習が停止する（`src/views/Practice.tsx:41-70`）。

### 2.3 設定マージ処理の破綻
- `preferencesToConfig` は `durationSec` のパース失敗時に `undefined` を返し、そのまま `DEFAULT_CONFIG` を上書きするため 0秒セッションになる（`src/storage/prefs.ts:40-68`）。
- `SessionConfig.skipPenalty` がエンジン層で一切参照されず（`src/engine/session.ts` 内に登場無し）、Raycast Preferences や保存値が意味を成さない。設定画面とエンジンの乖離はユーザー体験の信用を損なう。

### 2.4 コンテンツ供給の固定化
- `startSession` の難易度選択が `const difficulty = 1` でハードコードされており（`src/views/Practice.tsx:41-48`）、ドキュメントで設計されている練習履歴/難易度調整と矛盾する。
- 単語・長文モード双方の問題出題ロジックがView層に散在しているため、将来のコーパス拡張・シード固定・履歴ベースの出題などが不可能。

## 3. リファクタリング方針案

### 3.1 セッション/採点アーキテクチャ刷新
1. `SessionState` に `score: ScoreState` を追加し、`updateScore`/`skipScore` を直接適用する。
2. メトリクスは `score` から都度導出する `deriveMetrics(score, now)` 関数を用意し、副作用を `handleType`/`handleSkip` 内で一貫させる。
3. `skipPenalty` や将来フラグを `ScoreState` / `reduceSession` に統合し、設定値のON/OFFで採点式を切り替えられるようにする。
4. 既存テスト（`src/test/session.test.ts` 等）をスコア・メトリクスの境界値に合わせて更新。

### 3.2 Practiceロジックの分割
1. 入力制御・タイマー・ターゲット生成を司る `usePracticeSession`（hook）を新設し、UIは表示専用コンポーネントに分離。
2. Hook内部で「ターゲット完了→新ターゲット生成」「コーパス枯渇→usedIdsリセット」の状態遷移をFSMとして管理。ロジック層をVitestで検証可能にする。
3. View側は `searchText` の差分集計など副作用を持たず、Hookが提供する `sendEvent` API を呼ぶだけにする。これによりエラーハンドリングやトースト処理も集中管理できる。

### 3.3 設定/永続化の健全化
1. `sanitizeConfig` を導入し、`undefined` / 型不一致のキーを破棄した上で `DEFAULT_CONFIG` にマージする。
2. `skipPenalty` など動作に影響するフラグを実装し、履歴保存時にも記録するよう `SessionResult` を拡張。
3. `preferencesToConfig` / `loadPrefs` の単体テストを追加し、異常系（JSON破損・未定義）をカバー。

### 3.4 コーパス供給層の抽象化
1. `Practice` から `getRandomItem` 呼び出しを排除し、`TargetProvider`（例: 難易度・モード・重複回避・履歴参照を司るクラス）を導入。
2. Raycast Preferences の難易度・履歴設定と連動させ、将来的な文章モード拡張や統計機能とデータモデルを共有する。
3. `documents/plan` に規定された「履歴保持数」「練習モード」仕様と実装を再同期する。

## 4. 優先順位（高→低）
- 採点アーキテクチャ刷新（セッション全体の正確性に直結）
- Practiceロジック分割＋ターゲット遷移修正（UX崩壊の即時解消）
- 設定/Preferences sanitization ＋ `skipPenalty` 実装
- ターゲット供給層の抽象化（他改善のベース）

## 5. リスクとテスト観点
- スコア周りは既存履歴との互換性を保つため、`SessionResult.version` を上げた上でマイグレーションを実施する必要がある。
- Hook化に伴う Raycast UI の挙動変化を `npm run dev` で手動確認し、`Practice` 表示/入力/一時停止/終了の統合テストケースを追加する。
- 設定サニタイズにより既存ユーザーの不正値が修正されるため、初回起動時にトースト等で告知するかログに残す。

## 6. 前提・仮定
- 難易度や skip ペナルティの仕様は `documents/plan` および Raycast Preferences の設計情報に従う想定。
- 履歴フォーマットは LocalStorage のみを対象とし、外部同期要件は無いものとする。
- Long sentence モードは1セッション1ターゲットで成立する前提だが、単語モードは複数ターゲットを必要とする想定で計画している。
