import { useState, useEffect, useCallback, useMemo } from "react";
import { ActionPanel, Action, showToast, Toast, List, Form } from "@raycast/api";
import type { SessionState, SessionEvent, SessionConfig, RomanizerState } from "../types";
import { createInitialSession, reduceSession, getRemainingSeconds } from "../engine/session";
import { formatTime } from "../utils/time";
import { getRandomItem, getSentenceItem } from "../data/corpus";
import { TypingPrompt } from "./components/TypingPrompt";
import { ROMAJI_PROFILES, stepRomanizer } from "../engine/romanizer";

const DIFFICULTY_LABELS: Record<SessionConfig["difficulty"], string> = {
  1: "初級",
  2: "中級",
  3: "上級",
};

interface PracticeProps {
  config: SessionConfig;
  onComplete: (state: SessionState) => void;
}

export function Practice({ config, onComplete }: PracticeProps) {
  const [sessionState, setSessionState] = useState<SessionState>(createInitialSession());
  const [inputText, setInputText] = useState("");
  const [usedItemIds, setUsedItemIds] = useState<Set<string>>(new Set());
  const [selectedMode, setSelectedMode] = useState<SessionConfig["practiceMode"]>(config.practiceMode);
  const [selectedDuration, setSelectedDuration] = useState<number>(config.durationSec);
  const [selectedDifficulty, setSelectedDifficulty] = useState<SessionConfig["difficulty"]>(config.difficulty);

  useEffect(() => {
    setSelectedMode(config.practiceMode);
    setSelectedDuration(config.durationSec);
    setSelectedDifficulty(config.difficulty);
  }, [config.practiceMode, config.durationSec, config.difficulty]);

  const sessionConfig = useMemo(() => {
    return {
      ...config,
      practiceMode: selectedMode,
      durationSec: selectedDuration,
      difficulty: selectedDifficulty,
    };
  }, [config, selectedMode, selectedDuration, selectedDifficulty]);

  const pickTarget = useCallback(
    (options?: { reset?: boolean }) => {
      const difficulty = sessionConfig.difficulty;
      const useSentenceCorpus = sessionConfig.practiceMode === "sentence";
      const getter = useSentenceCorpus ? getSentenceItem : getRandomItem;

      const shouldReset = Boolean(options?.reset);
      let exclude = shouldReset ? new Set<string>() : new Set(usedItemIds);
      let candidate = getter(difficulty, exclude);
      let nextUsed = shouldReset ? new Set<string>() : new Set(usedItemIds);

      if (!candidate) {
        exclude = new Set<string>();
        nextUsed = new Set<string>();
        candidate = getter(difficulty, exclude);
      }

      if (candidate) {
        nextUsed.add(candidate.id);
      }

      return { target: candidate, usedSet: candidate ? nextUsed : new Set(usedItemIds) };
    },
    [sessionConfig.difficulty, sessionConfig.practiceMode, usedItemIds],
  );

  // Always call useMemo hook to maintain consistent hook order
  const promptDisplay = useMemo(() => {
    return TypingPrompt({ sessionState, config: sessionConfig });
  }, [sessionState, sessionConfig]);

  // タイマー処理
  useEffect(() => {
    if (sessionState.phase !== "running") return;

    const timer = setInterval(() => {
      setSessionState((prev) => {
        const updated = reduceSession(prev, { type: "tick" });
        if (updated.phase === "finished") {
          onComplete(updated);
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [sessionState.phase, onComplete]);

  // セッション開始
  const startSession = useCallback(() => {
    const { target, usedSet } = pickTarget({ reset: true });

    if (!target) {
      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "No available items",
      });
      return;
    }

    setUsedItemIds(usedSet);

    const event: SessionEvent = {
      type: "start",
      target,
      config: sessionConfig,
    };

    setSessionState((prev) => reduceSession(prev, event));
    setInputText("");
  }, [pickTarget, sessionConfig]);

  // 一時停止/再開
  const togglePause = useCallback(() => {
    const event: SessionEvent = sessionState.phase === "running" ? { type: "pause" } : { type: "resume" };
    setSessionState((prev) => reduceSession(prev, event));
  }, [sessionState.phase]);

  // 終了
  const finishSession = useCallback(() => {
    const event: SessionEvent = { type: "finish" };
    const updated = reduceSession(sessionState, event);
    setSessionState(updated);
    onComplete(updated);
  }, [sessionState, onComplete]);

  // スキップ
  const skipCurrent = useCallback(() => {
    if (sessionConfig.practiceMode === "word") {
      const { target, usedSet } = pickTarget();
      if (!target) {
        showToast({
          style: Toast.Style.Failure,
          title: "Error",
          message: "No available items",
        });
        setSessionState((prev) => reduceSession(prev, { type: "finish" }));
        return;
      }

      setUsedItemIds(usedSet);
      setSessionState((prev) => {
        const afterSkip = reduceSession(prev, { type: "skip" });
        return reduceSession(afterSkip, { type: "next-target", target });
      });
      setInputText("");
      return;
    }

    const event: SessionEvent = { type: "skip" };
    setSessionState((prev) => reduceSession(prev, event));
  }, [pickTarget, sessionConfig.practiceMode]);

  // 入力処理
  const handleInputChange = useCallback(
    (text: string) => {
      if (sessionState.phase !== "running") {
        setInputText("");
        return;
      }

      setInputText(text);

      const profile = ROMAJI_PROFILES[sessionConfig.romajiProfile] ?? ROMAJI_PROFILES.jis;
      const readingUnits = sessionState.readingUnits;

      let romanizerState: RomanizerState = { unitIndex: 0, unitProgress: 0, buffer: "" };
      const acceptedChars: string[] = [];
      const acceptedRawChars: string[] = [];
      let blockedChar: string | null = null;

      for (const rawChar of text) {
        const outcome = stepRomanizer(romanizerState, rawChar, readingUnits, profile);
        if (!outcome.accepted) {
          blockedChar = rawChar;
          break;
        }
        romanizerState = outcome.state;
        acceptedChars.push(rawChar.toLowerCase());
        acceptedRawChars.push(rawChar);
      }

      const acceptedHistory = acceptedChars.join("");
      const previousHistory = sessionState.typedHistory;
      const sharedPrefixLength = getSharedPrefixLength(previousHistory, acceptedHistory);
      const events: SessionEvent[] = [];

      const removalCount = previousHistory.length - sharedPrefixLength;
      for (let i = 0; i < removalCount; i++) {
        events.push({ type: "backspace" });
      }

      for (let i = sharedPrefixLength; i < acceptedRawChars.length; i++) {
        const ch = acceptedRawChars[i];
        events.push({ type: "type", ch });
      }

      if (blockedChar && text.length > acceptedRawChars.length && acceptedRawChars.length === sharedPrefixLength) {
        events.push({ type: "type", ch: blockedChar });
      }

      if (events.length === 0) {
        return;
      }

      setSessionState((prev) => {
        let current = prev;
        for (const event of events) {
          const updated = reduceSession(current, event);
          if (updated.phase === "finished" && current.phase !== "finished") {
            onComplete(updated);
          }
          current = updated;
        }
        return current;
      });
    },
    [sessionState.phase, sessionState.readingUnits, sessionState.typedHistory, sessionConfig.romajiProfile, onComplete],
  );

  const remainingSeconds = getRemainingSeconds(sessionState);
  const isPaused = sessionState.phase === "paused";
  const { markdown: promptBaseMarkdown, readingLine } = promptDisplay;
  const promptMarkdown = useMemo(() => {
    if (sessionState.phase === "idle") return "";
    const base = isPaused ? buildPausedMarkdown(promptBaseMarkdown) : promptBaseMarkdown;
    if (readingLine) {
      return `${base}\n\n${readingLine}`;
    }
    return base;
  }, [sessionState.phase, isPaused, promptBaseMarkdown, readingLine]);

  const statusText = sessionState.phase === "paused" ? "一時停止中" : "練習中";
  const { metrics } = sessionState;
  const accuracyText = `${(metrics.accuracy * 100).toFixed(1)}%`;

  const { phase, readingUnits, cursorUnitIndex, typedBuffer, target } = sessionState;

  useEffect(() => {
    if (phase !== "running") return;
    if (sessionConfig.practiceMode !== "word") return;
    if (!target) return;
    if (readingUnits.length === 0) return;
    if (cursorUnitIndex < readingUnits.length) return;
    if (typedBuffer.length > 0) return;

    const { target: nextTarget, usedSet } = pickTarget();

    if (!nextTarget) {
      showToast({
        style: Toast.Style.Failure,
        title: "Error",
        message: "No available items",
      });
      setSessionState((prev) => reduceSession(prev, { type: "finish" }));
      return;
    }

    const afterComplete = reduceSession(sessionState, { type: "complete-target" });
    const nextState = reduceSession(afterComplete, { type: "next-target", target: nextTarget });
    setSessionState(nextState);
    setUsedItemIds(usedSet);
    setInputText("");
  }, [
    cursorUnitIndex,
    phase,
    pickTarget,
    readingUnits.length,
    sessionConfig.practiceMode,
    sessionState,
    target,
    typedBuffer,
  ]);

  useEffect(() => {
    setUsedItemIds(new Set());
  }, [selectedMode, selectedDifficulty]);

  const handleStartForm = useCallback(() => {
    startSession();
  }, [startSession]);

  // 初回起動時の表示
  if (sessionState.phase === "idle") {
    return (
      <Form
        actions={
          <ActionPanel>
            <Action.SubmitForm title="開始" onSubmit={handleStartForm} />
          </ActionPanel>
        }
      >
        <Form.Description
          title="日本語タイピング練習"
          text={`日本語のローマ字タイピングを練習できます。\nIMEをOFFにしてから練習を開始してください。`}
        />
        <Form.Dropdown
          id="practiceMode"
          title="練習モード"
          value={selectedMode}
          onChange={(value) => setSelectedMode(value as SessionConfig["practiceMode"])}
        >
          <Form.Dropdown.Item value="word" title="単語モード (一語ずつ練習)" />
          <Form.Dropdown.Item value="sentence" title="長文モード (文章で練習)" />
        </Form.Dropdown>
        <Form.Dropdown
          id="durationSec"
          title="練習時間"
          value={selectedDuration.toString()}
          onChange={(value) => setSelectedDuration(Number(value))}
        >
          <Form.Dropdown.Item value="30" title="30秒" />
          <Form.Dropdown.Item value="60" title="60秒" />
          <Form.Dropdown.Item value="180" title="180秒" />
        </Form.Dropdown>
        <Form.Dropdown
          id="difficulty"
          title="難易度"
          value={selectedDifficulty.toString()}
          onChange={(value) => setSelectedDifficulty(Number(value) as SessionConfig["difficulty"])}
        >
          <Form.Dropdown.Item value="1" title="初級" />
          <Form.Dropdown.Item value="2" title="中級" />
          <Form.Dropdown.Item value="3" title="上級" />
        </Form.Dropdown>
        <Form.Separator />
        <Form.Description
          title="設定"
          text={`時間: ${sessionConfig.durationSec}秒\n難易度: ${DIFFICULTY_LABELS[sessionConfig.difficulty]}\nローマ字規則: ${sessionConfig.romajiProfile}\n読み表示: ${sessionConfig.showReading ? "ON" : "OFF"}`}
        />
      </Form>
    );
  }

  return (
    <List
      isShowingDetail
      searchText={inputText}
      onSearchTextChange={handleInputChange}
      enableFiltering={false}
      searchBarPlaceholder="ここにタイピング..."
      actions={
        <ActionPanel>
          {sessionState.phase === "running" ? (
            <>
              <Action title="一時停止" onAction={togglePause} shortcut={{ modifiers: ["cmd"], key: "p" }} />
              {sessionConfig.practiceMode === "word" && (
                <Action title="スキップ" onAction={skipCurrent} shortcut={{ modifiers: ["cmd"], key: "arrowRight" }} />
              )}
            </>
          ) : (
            <Action title="再開" onAction={togglePause} />
          )}
          <Action title="終了" onAction={finishSession} shortcut={{ modifiers: ["cmd"], key: "w" }} />
        </ActionPanel>
      }
    >
      <List.Section title="">
        <List.Item
          title="練習中"
          subtitle={statusText}
          detail={
            <List.Item.Detail
              markdown={promptMarkdown}
              metadata={
                <List.Item.Detail.Metadata>
                  <List.Item.Detail.Metadata.Label title="状態" text={statusText} />
                  <List.Item.Detail.Metadata.Label title="残り時間" text={formatTime(remainingSeconds)} />
                  <List.Item.Detail.Metadata.Separator />
                  <List.Item.Detail.Metadata.Label title="CPM" text={`${metrics.cpm}`} />
                  <List.Item.Detail.Metadata.Label title="WPM" text={`${metrics.wpm}`} />
                  <List.Item.Detail.Metadata.Label title="正確性" text={accuracyText} />
                  {sessionConfig.practiceMode === "word" && (
                    <List.Item.Detail.Metadata.Label title="完了単語数" text={`${sessionState.completedWords}`} />
                  )}
                </List.Item.Detail.Metadata>
              }
            />
          }
          accessories={[
            { text: `CPM: ${metrics.cpm}` },
            { text: `WPM: ${metrics.wpm}` },
            { text: `正確性: ${accuracyText}` },
            { text: `残り: ${formatTime(remainingSeconds)}` },
            ...(sessionConfig.practiceMode === "word" ? [{ text: `単語: ${sessionState.completedWords}` }] : []),
          ]}
        />
      </List.Section>
    </List>
  );
}

function buildPausedMarkdown(markdown: string): string {
  return `> ⏸ PAUSED\n\n${markdown}`;
}

function getSharedPrefixLength(a: string, b: string): number {
  const max = Math.min(a.length, b.length);
  let index = 0;
  while (index < max && a[index] === b[index]) {
    index += 1;
  }
  return index;
}
