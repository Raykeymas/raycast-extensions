# Practice UI Refresh Plan (Grid + SVG)

## 目的
- 左サイドバー無し・画面全体で課題を見せる集中型UIに刷新。
- 入力済み=白、誤入力=赤、未入力=半透明の配色で視認性を向上。
- 入力欄は露出させず（透明に近い運用）、フッターにメトリクス/設定を集約。

## 基本設計
- コンテナ: Raycast `Grid`（1カラム）を採用。検索バーをタイプ入力面として利用。
- レンダリング: セグメント化したプロンプトHTMLをカード内SVGとして描画（精密なタイポ/配置制御のため）。
- 入力: `searchText` / `onSearchTextChange` に接続し、差分で `SessionEvent` を発火。
- フッター: 残り時間・CPM・WPM・正確性・ミス、およびモード/規則タグを下部に固定配置。

## 画面仕様
- 文字配色
  - completed: `#f8f9fa`（ダーク時）/ `#1f1f1f`（ライト時）
  - current: アクセント（ダーク=#ffd43b, ライト=#0b7285）背景無し
  - error: `#ff6b6b`（背景無し）
  - pending: 前景色で不透明度0.35
- カーソル: `▌` を現在位置の前に表示（黄色系）。
- 読みの補助: 単語モード時のみ小さく表示。文章モードでは非表示。

## 実装方針
- `src/views/components/TypingPrompt.tsx`
  - セグメントHTML生成を維持しつつ、`current` の背景を撤廃し文字色のみで強調。
  - `error` は赤文字のみ。基本フォントサイズを 34px に拡大。
- `src/views/Practice.tsx`
  - `Grid` 単一アイテム化し、`content` にSVGを指定。`title/subtitle` は撤廃。
  - SVG内を上下2分割（本文エリア/フッター）。フッターにメトリクスとタグを配置。
  - 入力は `searchBarPlaceholder` のみ表示（透明運用）。ショートカットは `ActionPanel` 維持。

## テスト方針
- 既存 `src/test/TypingPrompt.test.ts` に準拠（caret表示、エラー色、進捗文言）。
- 重大な回帰が無いことを `npm run test` で確認。

## 作業ステップ（完了）
1. `TypingPrompt` の配色/強調の見直し（背景撤廃、フォントサイズUp）
2. `Practice` のカードHTMLをフッター構成に変更
3. `Grid.Item` のタイトル/サブタイトルを削除
4. ビルド・テストの回帰確認

## リスク/制約
- Raycastの仕様上、`Grid` と `List` の検索バーは非表示不可。現UIでは「透明に近い運用」（= 画面上部に小さく残る）とする。
- 将来的により完全な非表示が必要な場合は `Detail` + フォーカス可能要素の工夫が必要。

## 参考
- プロトタイプは monkeytype 風の見た目を意識。フォントは等幅（SF Mono系）で統一。

