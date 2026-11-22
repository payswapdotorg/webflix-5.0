/**
 * 纯展示格式化器 —— 从 WebFlix 2.0 的 src/lib/format.ts 移植（同规则、同输出）。
 */

/** 596 → "9:56", 3725 → "1:02:05", null → ""（直播/未知）。 */
export function formatDuration(totalSec: number | null): string {
  if (totalSec === null || totalSec === undefined) return "";
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function trimZero(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}

/** 12845390 → "12.8M", 89412 → "89K", 918 → "918", 1204 → "1.2K" */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : trimZero(v.toFixed(1))}K`;
  }
  if (n < 1_000_000_000) {
    const v = n / 1_000_000;
    return `${v >= 100 ? Math.round(v) : trimZero(v.toFixed(1))}M`;
  }
  const v = n / 1_000_000_000;
  return `${trimZero(v.toFixed(1))}B`;
}

/** "12.8M views" / "918 views" */
export function formatViews(n: number): string {
  return `${formatCount(n)} view${n === 1 ? "" : "s"}`;
}

/** "12.8M views" —— 优先 live 透传文本。 */
export function displayViews(video: { views: number; viewsText?: string | null }): string {
  return video.viewsText ?? formatViews(video.views);
}

/** YouTube 风格相对时间："3 hours ago", "2 months ago"。 */
export function formatRelativeDate(date: string | Date, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const ms = Math.max(0, now.getTime() - d.getTime());
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  const week = Math.floor(day / 7);
  if (day < 30) return `${week} week${week === 1 ? "" : "s"} ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month} month${month === 1 ? "" : "s"} ago`;
  const year = Math.floor(day / 365);
  return `${year} year${year === 1 ? "" : "s"} ago`;
}

/** 相对发布时间 —— 优先 live 透传（"16 years ago"）。 */
export function displayPublished(
  video: { createdAt: string | null; publishedText?: string | null },
  now: Date = new Date(),
): string {
  if (video.publishedText) return video.publishedText;
  if (video.createdAt) return formatRelativeDate(video.createdAt, now);
  return "";
}

/** 2410000 → "2.41M subscribers"（两位小数，YouTube 风格）。 */
export function formatSubscribers(n: number): string {
  if (n < 1000) return `${n} subscriber${n === 1 ? "" : "s"}`;
  if (n < 1_000_000) return `${trimZero((n / 1000).toFixed(1))}K subscribers`;
  if (n < 1_000_000_000) return `${trimZero((n / 1_000_000).toFixed(2))}M subscribers`;
  return `${trimZero((n / 1_000_000_000).toFixed(2))}B subscribers`;
}

/** "1.8M" —— 点赞等紧凑计数。 */
export function compactCount(n: number): string {
  return formatCount(n);
}

/** watched / total → 0..1（continue-watching 的红色进度条）。 */
export function watchProgress(watchedSec: number, durationSec: number): number {
  if (durationSec <= 0) return 0;
  return Math.min(1, Math.max(0, watchedSec / durationSec));
}
