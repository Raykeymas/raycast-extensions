#!/bin/bash

set -e

echo "=== JP Typing 公開前確認チェック ==="
echo

# 色付け定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# チェック関数
check_step() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
    else
        echo -e "${RED}❌ $1${NC}"
        exit 1
    fi
}

echo "1. 依存関係のインストール..."
npm ci
check_step "依存関係のインストール"

echo
echo "2. Lintチェック（ESLint + Prettier）..."
npm run lint
check_step "Lintチェック"

echo
echo "3. テスト実行..."
npm run test
check_step "テスト実行"

echo
echo "4. ビルド..."
npm run build
check_step "ビルド"

echo
echo "5. package.jsonの検証..."

# 必須フィールドの存在確認
echo "   - 必須フィールド確認..."
jq -e 'has("name") and has("title") and has("description") and has("icon") and has("author") and has("categories")' package.json > /dev/null
check_step "必須フィールドの存在"

# プラットフォーム確認
echo "   - プラットフォーム確認（macOSのみ）..."
jq -e '.platforms == ["macOS"]' package.json > /dev/null
check_step "プラットフォーム設定"

# カテゴリ確認
echo "   - カテゴリ確認（Funのみ）..."
jq -e '.categories == ["Fun"]' package.json > /dev/null
check_step "カテゴリ設定"

# アイコンパス確認
echo "   - アイコンパス確認..."
jq -e '.icon == "extension-icon.png"' package.json > /dev/null
check_step "アイコンパス設定"

# Preferences確認
echo "   - Preferences既定値確認..."
jq -e '.commands[0].preferences[] | select(.name == "defaultDifficulty") | .default == "2"' package.json > /dev/null
check_step "Preferences既定値"

echo
echo "6. 必須ファイルの存在確認..."

test -f "LICENSE"
check_step "LICENSEファイル"

test -f "README.en.md"
check_step "英語READMEファイル"

test -f "CHANGELOG.md"
check_step "CHANGELOGファイル"

test -f "assets/extension-icon.png"
check_step "拡張機能アイコン"

echo
echo "7. CHANGELOG形式の検証..."

grep -q "{PR_MERGE_DATE}" CHANGELOG.md
check_step "CHANGELOGの日付形式"

grep -q "### Added" CHANGELOG.md
check_step "CHANGELOGのセクション構成"

echo
echo -e "${GREEN}🎉 すべてのチェックが通過しました！公開準備完了です。${NC}"
echo
echo -e "${YELLOW}注意: スクリーンショットの作成は手動で必要です。${NC}"
echo "Raycastで Window Capture を設定し、3〜6枚のスクリーンショットを撮影してください。"
