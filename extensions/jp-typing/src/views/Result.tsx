import { Detail, ActionPanel, Action } from "@raycast/api";
import type { SessionResult } from "../types";
import { formatTime } from "../utils/time";

interface ResultProps {
  result: SessionResult;
  onRestart: () => void;
  onClose: () => void;
}

export function Result({ result, onRestart, onClose }: ResultProps) {
  const accuracyPercentage = (result.accuracy * 100).toFixed(1);
  const performanceLevel = getPerformanceLevel(result.cpm);

  const elapsedMinutes = result.durationSec / 60;
  const estimatedCorrect = Math.max(0, Math.round(result.cpm * elapsedMinutes));
  let totalAttempts = estimatedCorrect + result.mistakes;
  let correctCount = estimatedCorrect;

  if (result.accuracy > 0 && result.accuracy < 1) {
    totalAttempts = Math.round(result.mistakes / (1 - result.accuracy));
    correctCount = Math.round(totalAttempts * result.accuracy);
  }

  const averageWordTime = result.completedWords > 0 ? (result.durationSec / result.completedWords).toFixed(1) : null;
  const wordStats =
    result.practiceMode === "word"
      ? [
          `- **完了単語数**: ${result.completedWords}`,
          `- **平均単語時間**: ${averageWordTime ? `${averageWordTime} 秒/単語` : "―"}`,
        ].join("\n")
      : "";

  return (
    <Detail
      markdown={`
# 🎯 練習結果

## 📊 パフォーマンス評価
### **${performanceLevel}**

---

## ⏱️ タイム
- 練習時間: ${formatTime(result.durationSec)}

## 🚀 速度
- **CPM**: ${result.cpm} (文字/分)
- **WPM**: ${result.wpm} (単語/分)
${wordStats ? `\n${wordStats}` : ""}

## 🎯 正確性
- **正確率**: ${accuracyPercentage}%
  - **総タイプ数**: ${totalAttempts}
- **正打数**: ${correctCount}
- **ミス数**: ${result.mistakes}

## 🔥 連続記録
- **最長連続正打**: ${result.streakMax}

## ⏭️ その他
- **スキップ回数**: ${result.skips}

---

## 💡 アドバイス
${getAdvice(result)}

---
*練習日時: ${new Date(result.finishedAt).toLocaleString("ja-JP")}*
      `.trim()}
      actions={
        <ActionPanel>
          <Action title="もう一度練習" onAction={onRestart} shortcut={{ modifiers: ["cmd"], key: "r" }} />
          <Action title="閉じる" onAction={onClose} shortcut={{ modifiers: ["cmd"], key: "w" }} />
        </ActionPanel>
      }
    />
  );
}

function getPerformanceLevel(cpm: number): string {
  if (cpm >= 400) return "🏆 Sランク (達人)";
  if (cpm >= 350) return "🥇 Aランク (上級者)";
  if (cpm >= 300) return "🥈 Bランク (中級者)";
  if (cpm >= 250) return "🥉 Cランク (初級者)";
  if (cpm >= 200) return "📚 Dランク (初心者)";
  return "🌱 Eランク (入門者)";
}

function getAdvice(result: SessionResult): string {
  const { cpm, accuracy, mistakes, streakMax } = result;

  const advice = [];

  if (cpm < 250) {
    advice.push("• **速度向上**: ホームポジションを意識し、指先で素早く打つ練習をしましょう。");
  }

  if (accuracy < 0.9) {
    advice.push("• **正確性向上**: 焦らず、正確なキーを意識して打つ練習をしましょう。");
  }

  if (mistakes > 10) {
    advice.push("• **ミス削減**: 難しい文字列を重点的に練習し、ミスを減らしましょう。");
  }

  if (streakMax < 20) {
    advice.push("• **連続正打**: 短い単語から始めて、連続して正打できる練習をしましょう。");
  }

  if (advice.length === 0) {
    advice.push("• 素晴らしいパフォーマンスです！さらに上を目指して練習を続けましょう。");
  }

  return advice.join("\\n");
}
