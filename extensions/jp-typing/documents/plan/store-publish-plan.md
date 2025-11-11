# JP Typing — 公開準備と公開手順設計書

## 要件定義

- 目的: 本リポジトリの Raycast 拡張機能を Raycast Store に公開する。
- 成果物: レビュー通過に必要なメタデータ・アセット・設定の整備、公開 PR 作成までの具体手順。
- 参照規約: `raycast-ext/docs/` 内の以下ドキュメントに準拠。
  - 基本: `raycast-ext/docs/basics/prepare-an-extension-for-store.md`
  - 公開: `raycast-ext/docs/basics/publish-an-extension.md`
  - API/Preferences: `raycast-ext/docs/api-reference/preferences.md`
- 非機能要件:
  - ビルド成功（`npm run build`）・テスト成功（Vitest）・Lint クリア（ESLint/Prettier）。
  - ストア要件（カテゴリ、スクリーンショット、CHANGELOG 形式、著者名など）に合致。
  - 個人情報・外部解析を含まないこと（ドキュメントの「Analytics 不可」に準拠）。

## 現状監査（差分と不足の洗い出し）

- package.json（要修正候補）
  - アイコンパス不一致: `icon` がルートを指しているが実体は `assets/extension-icon.png`。
    - `package.json:6` 現在: `"icon": "extension-icon.png"`
    - 望ましい: `"icon": "assets/extension-icon.png"`
  - カテゴリに未サポート値を含む可能性:
    - `package.json:12-15` 現在: `["Fun", "Applications"]`
    - ガイドのカテゴリ一覧に `Applications` は無いため、`["Fun"]` などへ是正。
  - プラットフォームの過大宣言の可能性:
    - `package.json:8-11` 現在: `["macOS", "Windows"]`
    - Windows 動作検証未実施なら `"macOS"` のみに限定（ガイドの推奨）。
  - Preferences 既定値の不整合:
    - `package.json:55` 現在: `defaultDifficulty` の `default` が `"normal"`（定義値は `"1"|"2"|"3"`）。
    - 望ましい: `"default": "2"`（コード/テストの既定と一致）。
  - タイトル/説明の英語化:
    - ガイドの「US English」を考慮し、`title`/`description` の英語版検討（多言語は不可のため）。

- アセット/ドキュメント
  - アイコン: `assets/extension-icon.png` は存在（OK）。
  - スクリーンショット: 未作成。Raycast の Window Capture（Save to Metadata）で作成が必要。
  - CHANGELOG: あり（OK）。ただし `{PR_MERGE_DATE}` プレースホルダの採用を推奨。
  - LICENSE: ルートに未配置。`package.json` は `MIT`。MIT LICENSE ファイルの追加を推奨。
  - README: 日本語中心。Store 向け英語 README の併設（`README.en.md`）を推奨。

- ビルド/テスト/リンティング
  - ビルド: 成功（`npm run build`）。
  - テスト: 成功（6ファイル/54テストパス）。
  - Lint: 失敗あり。
    - ESLint エラー: `src/views/components/TypingPrompt.tsx` の不要なエスケープ（`no-useless-escape`）。
    - Prettier 未整形: 複数ファイル（`ray lint --fix` 推奨）。

## 基本設計（公開に必要な構成）

- メタデータ（`package.json`）
  - 必須: `name`, `title`, `description`, `icon`, `author`, `categories`, `commands[*]`。
  - 推奨: `keywords`（検索性向上）、`platforms` は実態に合わせて最小化。
  - Preferences はコマンド内 `preferences` に定義。既定値/型と実装の整合を維持。

- アセット
  - `icon`: ルートからの相対パスで指定。暗色用は `@dark` サフィックス対応可。
  - スクリーンショット: Raycast の Window Capture で `Save to Metadata` を使用（最大6枚）。

- ドキュメント
  - `CHANGELOG.md`: ストアに表示される。`## [Title] - {PR_MERGE_DATE}` 形式を推奨。
  - `README`: 英語ベースを推奨。日本語 README は併設可（`README.ja.md` など）。
  - `LICENSE`: MIT でルートに配置。

## 詳細設計（実施方針）

1) package.json の整合性確保
   - `icon` を `assets/extension-icon.png` に修正（`package.json:6`）。
   - `categories` をガイド準拠へ（例: `["Fun"]`）（`package.json:12-15`）。
   - `platforms` を `macOS` のみに（`package.json:8-11`）。
   - `defaultDifficulty.default` を `"2"` に（`package.json:55`）。
   - 可能なら `title`/`description` を英語へ（例: `JP Typing — Japanese Typing Practice`）。

2) Lint/Format 修正
   - 自動整形: `npm run fix-lint`（Prettier）。
   - ESLint 修正: `TypingPrompt.tsx` のエスケープ削除など。

3) スクリーンショット作成
   - Raycast Advanced Preferences → Window Capture を設定（ホットキー）。
   - 開発モードでコマンドを開き、ホットキーで撮影（Save to Metadata をチェック）。
   - 目安: 3〜6枚、2000x1250 PNG、単一背景、機能が分かる構図。

4) CHANGELOG 整備
   - セクションを `[Added]/[Fixed]/[Changed]` などで整理。
   - 見出し日付を `{PR_MERGE_DATE}` 形式に変更可。

5) LICENSE / README 整備
   - ルートに `LICENSE`（MIT）を追加。
   - 英語 README を追加（拡張の概要・コマンド・Preferences・スクショを記載）。

## 実装計画（タスク・優先度・依存関係）

- P0: package.json 是正（icon/categories/platforms/defaultDifficulty）
- P0: Lint/Format 修正（`ray lint --fix` と ESLint 1件の手当）
- P1: スクリーンショット作成（Window Capture → Metadata）
- P1: CHANGELOG 体裁見直し（必要に応じて）
- P2: LICENSE 追加（MIT）
- P2: 英語 README 追加

依存関係: P0 完了 → ビルド/lint/テスト再実行 → スクショ/README/CHANGELOG 更新 → 公開。

## 公開手順（ストア PR まで）

1) ローカル検証

```bash
npm install
npm run build
npm run test
npm run lint       # 問題があれば npm run fix-lint で修正
```

2) メタデータ/ドキュメント更新

- `package.json` を上記 P0 の通り修正。
- `CHANGELOG.md` 更新（必要に応じて `{PR_MERGE_DATE}` を使用）。
- `LICENSE`（MIT）と `README.en.md` を追加（任意）。
- スクリーンショットを Raycast から撮影（Save to Metadata）。

3) 最終検証

```bash
npm run build
npm run lint
npm run test
```

4) 公開（自動で PR を作成）

```bash
npm run publish
```

- 初回は GitHub 認証が必要。
- 既存の GitHub 上の変更がある場合は、下記で反映してから再実行:

```bash
npx @raycast/api@latest pull-contributions
```

5) レビュー対応

- 作成された PR にレビューフィードバックが来るので対応する。
- マージされると自動で Store に公開される。

## チェックリスト（レビュー通過のための最終確認）

- [ ] `npm run build` が成功する。
- [ ] `npm run test` が成功する（全 54 テスト）。
- [ ] `npm run lint` が成功する（ESLint/Prettier 問題なし）。
- [ ] `package.json` の `icon/categories/platforms/preferences` が整合している。
- [ ] スクリーンショット 3〜6 枚が Metadata に保存済み。
- [ ] `CHANGELOG.md` が最新版に更新されている。
- [ ] `LICENSE`（MIT）がルートに存在する。
- [ ] README が英語ベースで要点を満たしている（日本語 README 併設可）。

## 参考（該当ファイルの参照）

- `package.json:6` `icon`: 現在 `extension-icon.png` → 実体は `assets/extension-icon.png`。
- `package.json:12` `categories`: 現在 `Fun, Applications`。
- `package.json:8` `platforms`: 現在 `macOS, Windows`。
- `package.json:55` `defaultDifficulty.default`: 現在 `normal`。
- `assets/extension-icon.png`
- `CHANGELOG.md:1`
- `README.md:1`

## 仮定・注意事項

- Windows での動作検証は未実施と仮定。Store 申請は `macOS` のみで行う。
- スクリーンショットは Raycast の Window Capture を使用して `Save to Metadata` で保存する（手動作業）。
- バージョン番号は Store 申請に必須ではない（Raycast は PR ベース運用）。変更履歴は `CHANGELOG.md` を基準とする。

---

信頼度: high（ローカルドキュメントと検証結果に基づく）

