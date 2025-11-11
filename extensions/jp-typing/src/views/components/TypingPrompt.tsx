import type { SessionState, SessionConfig } from "../../types";
import { ROMAJI_PROFILES, toRomajiUnits } from "../../engine/romanizer";

type PromptSegment = {
  kind: "completed" | "current" | "pending";
  value: string;
};

interface TypingPromptProps {
  sessionState: SessionState;
  config: SessionConfig;
}

export interface TypingPromptRender {
  markdown: string;
  readingLine?: string;
  progress: {
    percent: number;
    completedUnits: number;
    totalUnits: number;
  };
}

export function TypingPrompt({ sessionState, config }: TypingPromptProps): TypingPromptRender {
  const { readingUnits, cursorUnitIndex, target, feedback, typedBuffer } = sessionState;
  const profile = ROMAJI_PROFILES[config.romajiProfile] ?? ROMAJI_PROFILES.jis;
  const romajiUnits = toRomajiUnits(readingUnits, profile);
  const segments = buildSegments(romajiUnits, cursorUnitIndex);
  const isErrorActive = feedback?.kind === "error";

  const heading = target ? `### ${escapeMarkdown(target.text)}` : "### 課題を読み込み中";
  const promptLine = renderSegments(segments, typedBuffer, Boolean(isErrorActive));
  const markdown = [heading, "", promptLine || "_読み込み中..._"].join("\n");

  const readingLine =
    target && config.showReading && config.practiceMode !== "sentence"
      ? `読み: ${escapeMarkdown(target.reading)}\nローマ字: ${escapeMarkdown(target.romaji)}`
      : undefined;

  const totalUnits = readingUnits.length;
  const completedUnits = Math.min(cursorUnitIndex, totalUnits);
  const progressPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;
  return {
    markdown,
    readingLine,
    progress: {
      percent: progressPercent,
      completedUnits,
      totalUnits,
    },
  };
}

function buildSegments(readingUnits: string[], cursorUnitIndex: number): PromptSegment[] {
  const completed = readingUnits.slice(0, cursorUnitIndex).join("");
  const current = readingUnits[cursorUnitIndex] ?? "";
  const pending = readingUnits.slice(cursorUnitIndex + 1).join("");

  const segments: PromptSegment[] = [];
  if (completed) segments.push({ kind: "completed", value: completed });
  if (cursorUnitIndex < readingUnits.length) segments.push({ kind: "current", value: current });
  if (pending) segments.push({ kind: "pending", value: pending });
  return segments;
}

function renderSegments(segments: PromptSegment[], typedBuffer: string, isErrorActive: boolean): string {
  if (segments.length === 0) return "";
  return segments
    .map((segment) => {
      const text = escapeMarkdown(segment.value || " ");
      switch (segment.kind) {
        case "completed":
          return text;
        case "current": {
          const wrapper = isErrorActive ? "~~" : "**";
          const buffer = typedBuffer ? escapeMarkdown(typedBuffer) : "";
          const value = segment.value || "";
          if (buffer) {
            if (value.startsWith(typedBuffer)) {
              const rest = escapeMarkdown(value.slice(typedBuffer.length) || " ");
              return `${wrapper}${buffer}▌${rest}${wrapper}`;
            }
            return `${wrapper}${buffer}▌${text}${wrapper}`;
          }
          return `${wrapper}▌${text}${wrapper}`;
        }
        case "pending":
          return `_ ${text} _`;
        default:
          return text;
      }
    })
    .join("");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\\`*_{}[]()#+.!])/g, "\\$1");
}
