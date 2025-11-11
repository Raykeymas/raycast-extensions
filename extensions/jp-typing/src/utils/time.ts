// 秒をMM:SS形式にフォーマット
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// 現在時刻のISO文字列を取得
export function getCurrentISOTime(): string {
  return new Date().toISOString();
}

// ISO文字列から経過秒数を計算
export function getElapsedSeconds(isoTime: string): number {
  return Math.floor((Date.now() - new Date(isoTime).getTime()) / 1000);
}
