# タイピング速度計測ロジック 是正計画

作成日: 2025-11-08

## 要件定義（機能仕様・制約）

- 指標定義
  - CPM: 経過時間あたりの正打数（characters per minute）。式: `CPM = (correct / elapsedSeconds) * 60`（四捨五入）。
  - WPM: 5 打 = 1 語換算の毎分語数。式: `WPM = round(CPM / 5)`。
  - 正確性: 全受理入力に対する正打の割合。式: `accuracy = correct / total`（`total=0` のとき 1）。
- 更新タイミング: 受理されたキー入力（`StepOutcome.accepted === true`）およびスキップ時にイベント駆動で更新。
- 計測開始点: セッション開始時（`startedAt`）。
- 表示: Practice/Result でリアルタイム表示。履歴には最新のメトリクスを保存。
- 制約: Raycast のみ（ローカルストレージ、プロセス終了規約遵守）。

## 現状の問題点（レビュー・検証結果）

- 問題箇所: `src/engine/session.ts:createScoreStateFromMetrics`
  - `metrics.accuracy * 100` を根拠に `correct` と `total` を同値に再構築しており、直後の `toMetrics()` で常に `accuracy ≈ 1` に収束する。
  - `correct` が実際より大きな値（例: 100 など）に初期化されるため、短時間での `CPM/WPM` が過大に算出される。
  - `metrics.cpm/wpm` を無視しており、再構築のたびに実測から乖離する。
- 影響: リアルタイムの CPM/WPM/accuracy が信頼できない。UI・履歴に誤った数値が表示/保存され得る。
- 参考検証: `src/test/scorer.test.ts` のスコア単体テストは正しい式を前提に合格。ただしセッション統合経路では上記再構築ロジックが破壊的。

## 基本設計（アーキテクチャ・データ構造・API）

- 方針: ScoreState をセッション状態に保持し、イベントごとに増分更新。メトリクスは ScoreState から都度算出する。
- 主要データ構造
  - `ScoreState { correct, total, mistakes, streak, streakMax, skips, startedAt }`
  - `SessionState` に `score: ScoreState` を追加（後方互換のためオプショナル開始も可）。
- 更新フロー
  1) start: `score = createScoreState()`（`startedAt` はセッションと同時刻に設定）。
  2) type: `score = updateScore(score, outcome)` → `metrics = toMetrics(score, now)`。
  3) skip: `score = skipScore(score)` → `metrics = toMetrics(score, now)`。
  4) tick: 時間満了判定のみ（計測はイベント駆動）。
- 廃止/変更
  - `createScoreStateFromMetrics` の使用を廃止。互換目的で残す場合も、既定では未使用。

## 詳細設計（実装方針・UI・テスト）

- 型の更新（`src/types/index.ts`）
  - `SessionState` に `score: ScoreState` を追加（既存コード影響を最小化するためオプショナルにして段階移行も可）。

- セッション制御（`src/engine/session.ts`）
  - start: `startedAt` を ISO で記録しつつ、同時に `score = createScoreState()` を生成。必要なら `score.startedAt = Date.now()` をセッション開始時刻と揃える。
  - type: 既存の `createScoreStateFromMetrics` 呼出しを削除し、`state.score` を `updateScore` で更新後、`toMetrics(state.score, Date.now())` を適用。
  - skip: 同様に `state.score = skipScore(state.score)` → `metrics = toMetrics(...)`。
  - tick/finish: ロジックは現状維持。
  - `createScoreStateFromMetrics`: 削除または非推奨化。残す場合は「完全再構築不可」の注記と、読み取り専用用途に限定。

- UI（`src/views/Practice.tsx`, `src/views/Result.tsx`）
  - 参照元は `state.metrics` のまま変更不要。

- テスト（Vitest）
  - 追加: セッション経由で 1 文字入力時の `accuracy` が 1 から不当に固定されないこと（`score` 由来で一貫）。
  - 追加: ミス混在時に `CPM` は正打のみから算出、`accuracy` は `correct/total` に一致。
  - 既存: `scorer.test.ts` は維持。

## 実装計画（タスク分解・優先順位・依存）

1. 型追加: `SessionState` に `score?: ScoreState` を追加（コンパイル通す）。
2. start 実装: `score = createScoreState()` を設定し、`startedAt` と同時刻で初期化。
3. type 実装: `createScoreStateFromMetrics` 呼出しを `state.score` に置換し、`updateScore` → `toMetrics` の直列化。
4. skip 実装: `skipScore` → `toMetrics` の直列化。
5. 廃止: `createScoreStateFromMetrics` を削除/非推奨化（未参照化を確認）。
6. テスト拡充: セッション経由のメトリクス一貫性テストを追加。
7. 手動確認: 短時間での過大 CPM/WPM が解消されること、精度がミス混在で変動することをUIで確認。

## リスク・注意点

- データ移行: 進行中セッションの途中再開シナリオは保持していないため、`score` 追加後は新規開始で整合する（問題なし）。
- 表示の揺らぎ: 短時間では CPM/WPM の変動が大きい。必要ならローパス（移動平均 3–5 秒）導入は別タスクで検討。
- 互換性: `SessionState` の新フィールド追加により一部の型厳格比較に影響の可能性（型をオプショナルにして段階移行）。

## 検証手順

1. `npm run test`（既存の `scorer`/`session`/`romanizer` テストが通ること）。
2. 追加テストで `accuracy`・`CPM/WPM` の整合を確認。
3. 手動: セッション開始→1–3 打の直後に CPM/WPM が過大にならないことを確認。

## まとめ

- 現状の再構築ロジック（accuracy からの推定）は不正確で、速度・精度の算出を破壊する。
- ScoreState をセッションに保持し増分更新へ切替えることで、CPM/WPM/accuracy を正しく一貫して計算できる。
- 変更は `types` と `session` の限定的修正で完結し、UI・保存形式への影響は最小。

