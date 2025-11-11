# AI Agents Guide for JP Typing Extension

このドキュメントは、日本語タイピング練習拡張機能の開発・保守においてAIエージェントが効率的に作業するためのガイドです。

## プロジェクト概要

### 目的
日本語のローマ字タイピングを練習するためのRaycast拡張機能を開発します。リアルタイムフィードバック、履歴管理、設定カスタマイズ機能を備えています。

### 主な機能
- 単語モードと文章モードの練習
- JIS、ヘボン式、寛容なローマ字入力方式サポート
- リアルタイムのCPM/WPM、正確性、連続正打数表示
- 練習履歴の保存と統計表示
- 練習時間、ローマ字規則、読み表示などの設定カスタマイズ
- 履歴保持数の調整（10〜300件）

### 技術スタック
- **フレームワーク**: React + TypeScript
- **プラットフォーム**: Raycast Extension API
- **テスト**: Vitest
- **ビルド**: @raycast/api
- **コード品質**: ESLint + Prettier

## プロジェクト構造

```
src/
├── commands/typing.tsx      # メインエントリーポイント
├── views/                   # UIコンポーネント
│   ├── Practice.tsx         # 練習画面
│   ├── Result.tsx           # 結果表示画面
│   └── components/          # UIサブコンポーネント
├── engine/                  # コアロジック
│   ├── romanizer.ts         # ローマ字変換エンジン
│   ├── scorer.ts            # 採点・メトリクス
│   └── session.ts           # セッション状態管理
├── storage/                 # データ永続化
│   ├── history.ts           # 履歴管理
│   ├── prefs.ts             # 設定管理
│   └── schema.ts            # スキーマ定義
├── data/corpus.ts           # 練習データ
├── types/index.ts           # 型定義
├── utils/time.ts            # 時間ユーティリティ
└── test/                    # 単体テスト
    ├── romanizer.test.ts    # ローマ字変換テスト
    ├── scorer.test.ts       # 採点機能テスト
    ├── session.test.ts      # セッション状態テスト
    ├── corpus.test.ts       # コーパス機能テスト
    ├── prefs.test.ts        # 設定機能テスト
    └── __mocks__/           # テスト用モック
```

documents/
├── plan/
│   ├── requirements.md      # 要件定義
│   ├── basic-design.md      # 基本設計
│   ├── practice-ui-redesign.md # UI設計
│   └── sentence-mode.md     # 文章モード設計

## 開発ガイドライン

### 重要：Raycastドキュメントの参照

**計画・実装時の必須事項**: すべての開発作業は、必ず `raycast-ext/docs/` にあるRaycast拡張機能の公式開発ドキュメントを参照して進めること。

#### Raycastドキュメントのディレクトリ構成

```
raycast-ext/docs/
├── README.md                    # ドキュメントトップ
├── SUMMARY.md                   # 目次
├── basics/                      # 基本操作・導入
│   ├── getting-started.md       # 開発環境セットアップ
│   ├── create-your-first-extension.md # 最初の拡張機能
│   ├── debug-an-extension.md    # デバッグ方法
│   ├── prepare-an-extension-for-store.md # ストア公開準備
│   └── publish-an-extension.md  # 公開手順
├── api-reference/               # APIリファレンス
│   ├── README.md                # API概要
│   ├── user-interface/          # UIコンポーネント
│   │   ├── README.md            # UIコンポーネント概要
│   │   ├── actions.md           # アクション
│   │   ├── detail.md            # 詳細表示
│   │   ├── form.md              # フォーム
│   │   ├── grid.md              # グリッド
│   │   ├── list.md              # リスト
│   │   ├── icons-and-images.md  # アイコンと画像
│   │   └── colors.md            # カラー
│   ├── storage.md               # データ保存API
│   ├── cache.md                 # キャッシュAPI
│   ├── clipboard.md             # クリップボードAPI
│   ├── preferences.md           # 設定API
│   ├── command.md               # コマンドAPI
│   ├── environment.md           # 環境変数
│   ├── oauth.md                 # OAuth認証
│   └── utilities.md             # ユーティリティAPI
├── utils-reference/             # ユーティリティリファレンス
│   ├── getting-started.md       # ユーティリティ概要
│   ├── react-hooks/             # React Hooks
│   │   ├── README.md            # Hooks概要
│   │   ├── useFetch.md          # データ取得
│   │   ├── useForm.md           # フォーム管理
│   │   ├── useLocalStorage.md   # ローカルストレージ
│   │   ├── useCachedPromise.md  # キャッシュ付きPromise
│   │   ├── usePromise.md        # Promise管理
│   │   ├── useExec.md           # コマンド実行
│   │   ├── useAI.md             # AI機能
│   │   └── useSQL.md            # SQL実行
│   ├── functions/               # ユーティリティ関数
│   ├── icons/                   # アイコン
│   └── oauth/                   # OAuthユーティリティ
├── examples/                    # サンプルコード
│   ├── todo-list.md             # Todoリスト例
│   ├── hacker-news.md           # Hacker News例
│   ├── spotify-controls.md      # Spotify制御例
│   └── doppler.md               # Doppler例
├── information/                 # 詳細情報
├── migration/                   # 移行ガイド
├── teams/                       # チーム機能
└── changelog.md                 # 変更履歴
```

#### 参照すべき主要ドキュメント

- **API実装時**: `docs/api-reference/` 配下の該当APIドキュメント
- **UI実装時**: `docs/api-reference/user-interface/` のコンポーネント仕様
- **データ保存時**: `docs/api-reference/storage.md` と `docs/api-reference/cache.md`
- **React Hooks**: `docs/utils-reference/react-hooks/` の各種Hooks
- **ユーティリティ**: `docs/utils-reference/` の関数・ツール
- **基本操作**: `docs/basics/` の導入・デバッグ・公開関連
- **サンプル実装**: `docs/examples/` の具体的な実装例
- **不明点**: `docs/README.md` と `docs/SUMMARY.md` から全体像を把握

### 1. コーディング規約

#### TypeScript
- 厳格な型チェックを使用
- `any`型は避け、具体的な型を定義
- インターフェースは明確に定義
- 型エクスポートを優先

```typescript
// 良い例
interface SessionConfig {
  durationSec: number;
  romajiProfile: "jis" | "hepburn" | "liberal";
  showReading: boolean;
  skipPenalty: boolean;
}

// 悪い例
interface SessionConfig {
  durationSec: any;
  romajiProfile: string;
}
```

#### React
- 関数コンポーネントを使用
- カスタムフックでロジックを分離
- Propsは明確な型定義
- useCallback/useMemoを適切に使用

```typescript
// 良い例
export function Practice({ config, onComplete }: PracticeProps) {
  const handleInput = useCallback((text: string) => {
    // 処理
  }, [config]);

  return <Form>...</Form>;
}
```

#### エラーハンドリング
- try-catchで適切にエラーを処理
- ユーザーにわかりやすいエラーメッセージを表示
- ログは開発者コンソールに出力

```typescript
// 良い例
try {
  await saveResult(result);
  showToast({ style: Toast.Style.Success, title: "Saved" });
} catch {
  showToast({ style: Toast.Style.Failure, title: "Error", message: "Failed to save" });
}
```

### 2. ファイル編集ルール

#### 新規ファイル作成
- 必要なインポートを最初に記述
- エクスポートは明示的に
- JSDocコメントで機能を説明

#### 既存ファイル編集
- 関連する変更はまとめて行う
- インポートの追加・削除を忘れない
- 型の整合性を確認

#### 優先順位
1. 型定義の修正
2. インターフェースの更新
3. 実装の修正
4. テストの更新

### 3. テスト戦略

#### 単体テスト
- エンジン部分（romanizer, scorer）を重点的に
- 境界値とエッジケースをカバー
- 表記ゆれのテストを充実

```typescript
// テスト例
describe("romanizer", () => {
  test("handles yoon characters", () => {
    const result = stepRomanizer(state, "sha", readingUnits, profile);
    expect(result.completedUnit).toBe(true);
  });
});
```

#### 手動テスト
- 基本フローのテスト
- 設定変更の反映確認
- エラーハンドリングの確認

### 4. デバッグ手順

#### ビルドエラー
1. `npm run build`で確認
2. TypeScriptエラーを特定
3. 型定義から修正

#### ランタイムエラー
1. 開発者コンソールでログ確認
2. Raycastでの直接テスト
3. エッジケースを特定

#### パフォーマンス問題
1. React DevToolsでプロファイル
2. 不要な再レンダリングを特定
3. useCallback/useMemoで最適化

## よくある作業パターン

### 1. 新機能追加
```
1. types/index.ts で型定義
2. engine/ でロジック実装
3. views/ でUI実装
4. test/ でテスト実装
5. commands/ で統合
```

### 2. バグ修正
```
1. エラーの特定と再現
2. 型定義の確認
3. ロジックの修正
4. テストの更新
5. 手動テストで確認
```

### 3. リファクタリング
```
1. 既存コードの分析
2. 型の改善
3. 関数の分割
4. テストの維持
5. ビルド確認
```

## 注意点と制約

### Raycast APIの制約
- `process.exit(0)` でコマンド終了
- LocalStorageのみ使用可能
- UIコンポーネントはRaycast提供のもののみ

### 日本語処理の注意点
- IME OFFを前提
- ローマ字入力のみ対応
- 表記ゆれを適切に処理

### パフォーマンス
- タイマー処理は最適化
- 不要な再レンダリングを避ける
- メモリリークを防止

## よくある問題と解決策

### 1. ビルドエラー
**問題**: `could not find an entry point`
**解決**: 
- `src/commands/` にファイルがあるか確認
- `package.json` のコマンド名と一致させる

### 2. 型エラー
**問題**: `any` 型の使用
**解決**:
- 具体的な型を定義
- インターフェースを作成

### 3. ESLintエラー
**問題**: 未使用のインポート
**解決**:
- 不要なインポートを削除
- 使用されているか確認

### 4. テスト失敗
**問題**: ローマ字変換のテスト失敗
**解決**:
- 表記ゆれのパターンを確認
- 境界値のテストを追加

## 開発ツール

### 必須コマンド
```bash
npm install          # 依存インストール
npm run build        # ビルド確認
npm run dev          # 開発モード
npm run test         # テスト実行
npm run test:watch   # ウォッチモードでテスト
npm run lint         # 静的解析
npm run fix-lint     # ESLint自動修正
npm run pre-publish-check  # 公開前の全項目チェック（必須）
```

### 公開前チェック（必須実行）
**アップデートや公開前には必ず以下のコマンドを実行してください**:
```bash
npm run pre-publish-check
```

このコマンドは以下を自動検証します：
- 依存関係のインストール
- Lintチェック（ESLint + Prettier）
- 全テストの実行（54テスト）
- ビルドの成功確認
- package.jsonの必須項目検証
- 必須ファイルの存在確認（LICENSE, README.en.md, CHANGELOG.md, アイコン）
- CHANGELOG形式の検証

### デバッグツール
- Raycast開発者コンソール
- TypeScriptコンパイラ
- React DevTools

## コミュニケーション

### 進捗報告
- 完了したタスクを明確に報告
- 問題があれば早期に報告
- 次のステップを明示

### 質問の仕方
- 具体的なエラーメッセージを添える
- 再現手順を明確に
- 期待する動作を説明

### 設計ドキュメント出力ルール
- 実装計画の前段階として、設計書出力や計画といった指示があった場合は、必ず `documents/plan/` に設計ドキュメントをマークダウンテキストで出力する
- 設計ドキュメントには以下の要素を含める：
  - 要件定義（機能仕様、制約事項）
  - 基本設計（アーキテクチャ、データ構造、API設計）
  - 詳細設計（実装方針、UI設計、テスト方針）
  - 実装計画（タスク分解、優先順位、依存関係）
- ファイル名は `{機能名}-design.md` や `{機能名}-plan.md` といったわかりやすい名前を付ける
- 設計ドキュメント出力後、実装着手前にユーザーの確認を得る

---

このガイドはプロジェクトの進化に合わせて更新してください。新しいパターンやベストプラクティスが見つかったら、積極的に反映しましょう。
