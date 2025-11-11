# 単体テスト評価と改善計画（2025-11-08）

## 概要
- 対象: romanizer/scorer/session/corpus/prefs/UIサブ（TypingPrompt）
- ツール: Vitest（`@raycast/api`はエイリアスモック）
- 結論: コア機能は基礎的カバレッジあり。ただしセッション採点の再構成ロジックや促音/長音/ん等の変換境界、履歴・時間系の周辺を十分に検証できていない。テストの網羅性と意味付けを強化する必要がある。

## 現状評価（良い点）
- romanizer: 基本かな・拗音の正規化とプロファイル別マップ検証がある（`normalizeReading`、基本入力、表記ゆれ）。
- scorer: 正打/ミス/ストリーク/CPM/WPM/accuracy の基本計算を検証済み。
- session: sentenceモードの開始/終了、skip可否、結果スキーマ（`practiceMode`, `version`）を確認。
- corpus: 難易度・モード別取得、除外ID、ザックリした文章長チェックを網羅。
- UI: TypingPrompt の最小限のDOM文字列/色/進捗表示を確認。

## 主要な懸念・欠落
- セッション採点の再構成が未検証
  - `createScoreStateFromMetrics` が毎打鍵でメトリクスから正打数を推定再構成（100基準）しており、精度/CPMが壊れうる。振る舞いを拘束するテストが無い。
- romanizer の境界・特殊規則が不足
  - 促音（っ）の重ね子音・`lt/xt`、長音（ー）、`ん`の曖昧性（`n`/`nn`）の受理/誤り検出が未カバー。
  - バックスペース（`backspaceRomanizer`）の後退挙動が未カバー。
- session FSM の時間/操作系が不足
  - `tick` による時間切れ終了、`pause/resume`、`backspace` の反映、`getRemainingSeconds` の境界が未カバー。
  - `skip` 実行時のメトリクス（`skips`増分、ストリークリセット）が未検証（UI完了だけを見ている）。
- corpus のランダム性依存
  - `getSentenceItem`/`getRandomItem` はMath.random依存。現状のアサーションは真偽のみでランダム性の副作用は露出しづらいが、将来の拡張で不安定化する恐れ。決定論的に固定すべき。
- storage/prefs/history が薄い
  - `history` の保存上限・並び順・マイグレーション（`practiceMode`付与）の検証が無い。
  - `prefs` の異常系（破損JSON/未定義/不正値フォールバック）と優先順位の網羅が足りない。

## 改善方針
- 失敗を前提に赤テストで仕様を固める（特にセッション採点）。
- ランダム・時刻をスタブして決定論化（`vi.spyOn(Math, "random")` / `vi.setSystemTime`）。
- 入力シーケンスのインテグレーションテストを少数追加（FSMの正当性担保）。

## 追加/強化するテスト項目（提案）

### 1) romanizer（細部強化）
- 促音
  - `"きって"` に対し `k`（重ね子音）で促音が確定し、次単位へ進みバッファが保持されること。
  - `lt`/`xt` パターンで促音が確定すること。
  - 不正子音で `accepted=false, mistake=true` になること。
- 長音
  - 読み `"すまーと"` に対し `-` が長音確定になること。その他入力でミス扱い。
- ん（曖昧性）
  - Hepburn で `n`/`nn` の受理、`na/ni` 直前での曖昧挙動（現仕様の期待値を明記）。
- バックスペース
  - `backspaceRomanizer` がバッファ内では1文字後退、単位境界を跨いだ場合の復元挙動を確認。

### 2) scorer（境界/丸めの明確化）
- CPM/WPM の丸め規則（端数の四捨五入）を固定。
- ミス入力（`accepted=true, mistake=true`）の `total`/`mistakes` 反映を再確認。
- 長時間経過・0経過の端境値（既存は維持、追加で >1分の妥当性）。

### 3) session FSM（実運用の核）
- `tick` による時間切れで `finished` へ遷移すること（`vi.setSystemTime`で制御）。
- `pause/resume` 中は `type`/`skip` が無効で状態不変。
- `backspace` で `cursorUnitIndex`/`typedBuffer` が後退すること（romanizerと整合）。
- `skip`（wordモード）で `skips`++ とストリークリセット、`cursorUnitIndex` が末尾になること（メトリクスも確認）。
- sentenceモードの完了で自動的に`finished`、その後の `type` が無視される。
- 採点の再構成抑止（重要）
  - 連続入力（正→ミス→正...）で `ScoreState` が累積されることを期待する赤テストを追加し、`createScoreStateFromMetrics` に依存した再構成では満たせないことを顕在化させる。

### 4) corpus（決定論化と妥当性）
- `Math.random` をスタブし、特定のIDが選ばれることを検証（word/sentence両方）。
- 文章読み（`reading`）が非空・`text` と同数以上のユニットへ正規化されること（`normalizeReading` 経由）。

### 5) storage/history（未カバー）
- `saveResult` が上限 `limit` を超えないこと、`finishedAt` 降順に並ぶこと。
- マイグレーション: `practiceMode` 欠落時に `"word"` が補完されること。
- `clearHistory` で空になること。
- `getStatistics` の平均・最大・合計時間が正しく算出されること（小数は丸め方を明示）。

### 6) storage/prefs（異常系の明確化）
- 破損JSON/未定義で安全にデフォルトへフォールバックすること。
- Raycast Preferences の不正値（例: `defaultDurationSec="abc"`）はデフォルト値を保持すること。
- 保存済みローカル設定がPreferencesより優先されること（既存に加え、他キーも網羅）。

### 7) UI: TypingPrompt（最小追加）
- sentence以外で `readingText` が出ること（既存の逆ケースは有）。
- `progressText` の百分率と分母/分子表示の境界（0/0、完了時）。

## 実装計画（段階導入）
- Phase 1（安全強化・30〜60分）
  - romanizer（促音/長音/バックスペース）と corpus 決定論化、prefs 異常系、history 基本系を追加。既存実装に非依存で通る内容中心。
- Phase 2（仕様拘束・60〜90分）
  - session FSM（tick/pause/resume/backspace/skipメトリクス）を追加。`vi.setSystemTime`で時間依存を固定。
- Phase 3（赤テスト→実装修正）
  - 採点再構成抑止の赤テストを追加。失敗を確認後、`SessionState` へ `score: ScoreState` を保持し直接更新する実装変更を別PR/コミットで実施。

## テスト実装メモ
- 乱数固定
  ```ts
  vi.spyOn(Math, "random").mockReturnValue(0.0);
  ```
- 時刻固定
  ```ts
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
  // ... 操作 ...
  vi.setSystemTime(new Date("2025-01-01T00:01:00Z"));
  ```
- Raycast APIは既存の`vitest.config.ts`エイリアスで十分。追加のUIモックは不要。

## 完了条件
- 追加テストでFSM/採点/入出力境界が拘束され、将来のリファクタで破壊しにくくなる。
- ランダム・時刻依存の非決定性が排除され、CIで安定して緑になる。
- 既存のテスト意図（基本機能の健全性）は保持。

## 想定リスクと回避
- 採点再構成の赤テスト導入で一時的にCIが赤になる → Phase 3で実装修正と同時進行、もしくは `skip` タグで段階的に有効化。
- 文章長の閾値はドメイン仕様に依存 → 設計ドキュメントの基準値に合わせテストコメントで根拠を明示。

---
信頼度: high
