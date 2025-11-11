# Practice画面 UI再設計計画（monkeytypeスタイル）

## 1. 背景と課題
- 現状の `src/views/Practice.tsx` は `Form` ベースで、入力欄が主役になり課題文は `Form.Description` のテキストのみ。視線が分散し、どこまで入力できたか一瞥で分からない。
- 入力済み/未入力/ミスの視覚的差分がなく、ユーザーが自分の位置を把握しづらい。読み表示や進捗パーセンテージも文章下に並列で表示されているため情報量が氾濫している。
- monkeytype のように「大きな課題＋視覚的フィードバック」を提供したいが、現在の構造では配色・タイポグラフィを制御しづらい。

## 2. 目標と成功指標
- 課題テキストを画面中央の主役として提示し、未入力部分は淡色、入力済みは高コントラスト、現在位置はカーソル風ハイライトで示す。
- キータイプごとにフィードバックを即時反映し、1文入力中でも視線移動なく状態を把握できる。
- 残り時間やWPMなどのメトリクスは視覚ノイズにならない位置に集約し、指標変化を追いやすくする。

## 3. UX要件
### 3.1 課題表示
- 最大3行まで折り返すモノスペース表示（Raycastでは`Detail`/`List.Item.Detail`のMarkdownを利用）。
- 文章は `completed/current/pending/error` セグメントに分解し、セグメントごとに色と透過を制御。
- 読み（かな）は単語モードのみ補助として任意表示。長文モードは本文に集中させる。

### 3.2 カーソルと現在位置
- 現在ユニットの前に太めのカーソル記号（`▌` など）を表示。ハイライトが不要なライトテーマでは背景矩形（`<span style="background:rgba(...)">`）を使用。
- バックスペース時は `current` の位置を即時巻き戻し、エラー表示をリセット。

### 3.3 色・タイポグラフィ方針
- Raycastのライト/ダーク両テーマに馴染むよう、`Color.SecondaryText` と `Color.PrimaryText` を基準に不透明度のみ変更。
- 文字サイズはベースより+2段階（Raycast Markdown の `#` タイトルより小さく、`<span style="font-size:18px">` を使用）。
- ミス文字は `danger` カラーで下線を引き、正しい文字へ戻るまで継続表示。

### 3.4 操作性
- 入力欄は UI 上に露出させず、Raycast `List` の search bar を入力サーフェスとして再利用。これにより画面本体を課題表示専用にできる。
- 一時停止/スキップ/終了は `ActionPanel` に整理し、ショートカットは現状を踏襲。

### 3.5 メトリクス表示
- monkeytypeの左側カウンタを模し、`List.Item.Detail.Metadata` の1列目に主要3指標（残時間/CPM/WPM/Accuracy）を固定表示。
- 練習モードやローマ字規則などの静的情報は `Metadata.TagList` に集約し、目線移動を最小化。

### 3.6 状態遷移
- `idle` : 既存のウェルカム画面を維持し、Start押下で新UIに切り替え。
- `running` : List + Detail ベースの新レイアウト。
- `paused` : 課題テキスト全体を半透明化し、中央に「PAUSED」をオーバーレイ（Markdownで `> PAUSED` ブロック）。
- `finished` : `Detail` のサマリ画面（既存Resultビュー）へ遷移。

## 4. レイアウト案
```
┌──────────────────────────────┐
│ SearchBar (typing input, placeholder=「ここにタイピング」) │
├──────────────────────────────┤
│ List.Item.Detail (markdown)                                   │
│   ┌ Typing prompt block (monospace, centered)               ┐ │
│   │  typed text (white) current cursor (yellow) remaining  │ │
│   └────────────────────────────────────────────────────────┘ │
│   Metadata columns: [Time][CPM/WPM][Accuracy][Mistakes]       │
└──────────────────────────────────────────────────────────────┘
```
- `List` コンテナを単一セクション/単一アイテムに固定し、Listのスクロールを無効化（`List.Section` の `subtitle` に状態メッセージを表示）。
- メトリクスの上下揺れを避けるため固定幅の`Metadata.Label`を使用。
- 読み表示がONの場合は課題ブロック下部に `Reading: ...` を小さめのセカンダリテキストとして描画。

## 5. 表示ロジック詳細
### 5.1 セグメントモデル
```ts
type PromptSegment = {
  kind: "completed" | "current" | "pending" | "error";
  value: string;
};
```
- `sessionState.readingUnits` から `cursorUnitIndex` を用いて配列を構築。
- 直近でミスした文字は `error` に差し替え、正しい入力が入った時点で `current` へ戻す。

### 5.2 Markdown組み立て
- `completed`: `<span style="opacity:0.8;color:${fg}">${text}</span>`
- `current`: `<span style="color:${accent};background:${accentBg}">${text||" "}</span>`
- `pending`: `<span style="opacity:0.35;color:${fg}">${text}</span>`
- `error`: `<span style="color:${danger};text-decoration:underline">${text}</span>`
- カーソルは `current` セグメントの先頭に `▍` を追加して視認性を確保。
- Markdown全体は ```` ```text ... ``` ```` でラップし、モノスペースを強制。

### 5.3 進捗情報
- 進捗率・残り文字数は `Metadata.Label` に表示、バー表示が必要な場合は `Progress` 風のUnicode（`████░░░`）を使用。
- sentenceモードでは1段目に文章全体の読み仮名を省略可（設定で切替）。

## 6. 入力処理と状態管理
- `List` の `searchText` / `onSearchTextChange` を `inputText` state に接続し、現行の差分比較ロジックをそのまま流用可能。
- `Escape` で一時停止、`Cmd+Backspace` で全文クリアなどショートカットを `ActionPanel` に記載。
- `sessionState.phase` に応じて `List` の `isShowingDetail` を切り替え、`paused` 時は `searchBarAccessory` で「一時停止中」を表示して入力をロック。
- 視覚更新は `useMemo` でセグメント配列からMarkdownを生成し、不要な再レンダリングを抑える。

## 7. 実装ステップ
1. **UIコンテナの切替**: `Practice` の `running` ブロックを `List` ベースに書き換え、既存 `Form` は `idle` のみで使用。
2. **セグメント生成ユーティリティ**: `src/views/components/TypingPrompt.tsx`（新規）にセグメント計算とMarkdown生成を分離。
3. **メトリクスHUD**: `List.Item.Detail.Metadata` へ `generateMetricsDisplay` の内容を再配置し、アイコン/タグを付与。
4. **配色トークン**: `useMemo` で `environment.theme` `environment.colorScheme` から前景色/背景色を決定するヘルパーを追加。
5. **状態ハンドリング**: `searchText` を `inputText` に置き換え、`List` 版の `onSearchTextChange` に差分計算ロジックを移植。
6. **アクセシビリティ**: `ActionPanel` にショートカット説明、読み表示のトグルなどを整理。
7. **リファクタリング**: `generateProgressDisplay` / `generateMetricsDisplay` をView層専用フックに分割しテスト容易性を高める。

## 8. テスト観点
- `TypingPrompt` ヘルパーの単体テスト（セグメントの境界、エラー表示、カーソル位置）。
- `Practice` ビューのレンダリングスナップショット（Vitest + @testing-library/react）で `List` への切替を検証。
- 入力フロー: 検索バーでの入力が `sessionState` を正しく更新すること、バックスペース／スキップ／一時停止のイベントが意図通り発火すること。
- ダーク/ライトテーマでのコントラストテスト（色の閾値をユニットテストで検査）。

## 9. リスクとオープン課題
- RaycastのMarkdownがテーマ毎にどこまでカスタムスタイルを許容するかを検証する必要がある（制約が厳しい場合は `opacity` だけで表現するフォールバックを用意）。
- `List` 検索バーを入力サーフェスに使うため、既存の `Form` で保存していた下書き値（`storeValue`）が使えない。セッション切断時の `restore` をどうするか検討。
- 長文モードで3行を超える文章は折り返しやスクロール挙動の調整が必要。必要に応じて段落ごとの分割やオートスクロールを追加する。
- 今後の自動次課題ロードやマルチモード表示と衝突しないよう、`TypingPrompt` コンポーネントを汎用化しておく。
