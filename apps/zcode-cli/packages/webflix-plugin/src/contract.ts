/**
 * webflix 插件面板（UI plugin）的对外契约：插件 MCP server 提供的资源、工具与结果形状，
 * 以及构建保证产出的文件。面板页面与 server 只经这里约定的 URI 和形状交互，
 * 规格见 docs/webflix/webflix-workspace.md。
 *
 * 数据纪律（与 WebFlix 2.0 一致）：videoId / 标题 / 频道名来自 YouTube oEmbed 逐条校验的
 * 公开快照（scripts 里无网络依赖，快照静态内嵌）；缩略图直连 i.ytimg.com 官方 CDN；
 * 观看数 / 点赞数 / 持续时长是演示快照值（WebFlix 2.0 的 prisma/seed.ts 同一做法），
 * 面板对它们按 WebFlix 的展示格式渲染。
 */

/** `.zcode-plugin/plugin.json` 里 mcpServers 的 key，也是 ui.surfaces[].server。 */
export const WEBFLIX_SERVER_NAME = "webflix";
export const WEBFLIX_SURFACE_ID = "webflix";
export const PANEL_URI = "ui://webflix/panel.html";
export const PANEL_MIME = "text/html;profile=mcp-app";

/**
 * 面板资源的 CSP 声明（宿主按 `_meta.ui.csp` 构建 iframe CSP）：
 * - resourceDomains → img-src：缩略图来自 i.ytimg.com（与 WebFlix 2.0 相同的官方 CDN）；
 * - frameDomains → frame-src：观看页 / Shorts 内嵌 YouTube 官方播放器（youtube-nocookie embed）。
 * 无 connect-src：面板数据一律经 callServerTool 走插件 server，不自行联网。
 */
export const PANEL_META = {
  ui: {
    csp: {
      resourceDomains: ["https://i.ytimg.com"],
      frameDomains: ["https://www.youtube-nocookie.com", "https://www.youtube.com"],
    },
  },
} as const;

/** 面板数据工具：只读，app-only（宿主不放进模型工具表，与 zcode-site 面板同律）。 */
export const HOME_TOOL = "webflix_home";
export const SEARCH_TOOL = "webflix_search";
export const WATCH_TOOL = "webflix_watch";
export const SHORTS_TOOL = "webflix_shorts";
export const CHANNEL_TOOL = "webflix_channel";
export const TRENDING_TOOL = "webflix_trending";
export const SUGGEST_TOOL = "webflix_suggest";

/** 工具结果的信封：成功带 data，失败带 error（面板据此渲染错误态）。 */
export type WebflixResult<T> = { data: T } | { error: { reason: string; message?: string } };

/** 构建后在插件根目录下必定存在的产物；官方插件定义与打包清单都把它们列为必需资产。 */
export const WEBFLIX_PANEL_OUTPUTS = ["dist/server.mjs", "dist/ui/panel.html"] as const;

/* ---------------------------------------------------------------------------
 * DTO 形状 —— 字段与 WebFlix 2.0 的 src/lib/types.ts 保持一致（面板按同格式渲染）。
 * ------------------------------------------------------------------------- */

export interface ChannelLite {
  id: string;
  name: string;
  handle: string;
  avatarUrl: string | null;
  verified: boolean;
}

export interface VideoDTO {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  durationSec: number | null;
  views: number;
  viewsText?: string | null;
  publishedText?: string | null;
  likes: number;
  category: string;
  isShort: boolean;
  isLive: boolean;
  createdAt: string | null;
  channel: ChannelLite;
}

export interface ContinueVideoDTO extends VideoDTO {
  watchedSec: number;
}

export interface CommentDTO {
  id: string;
  author: string;
  authorInitial: string;
  publishedText: string;
  text: string;
  likes: number;
  pinned: boolean;
  hearted: boolean;
  replies: number;
}

export interface HomeFeedDTO {
  continueWatching: ContinueVideoDTO[];
  shorts: VideoDTO[];
  recommended: VideoDTO[];
  recommendedCursor: string | null;
  chips: string[];
}

export interface SearchResultsDTO {
  videos: VideoDTO[];
  channels: (ChannelLite & { subscribers: number; videoCount: number })[];
}

export interface WatchDTO {
  video: VideoDTO;
  subscribers: number;
  comments: CommentDTO[];
  related: VideoDTO[];
}

export interface ShortsDTO {
  shorts: VideoDTO[];
}

export interface ChannelPageDTO {
  channel: ChannelLite & { subscribers: number; videoCount: number; description: string };
  videos: VideoDTO[];
}

export interface TrendingDTO {
  videos: VideoDTO[];
  categories: string[];
}

export interface SuggestDTO {
  suggestions: string[];
}

/** 首页推荐网格的分页大小（growing grid 每页追加的卡片数，与 WebFlix 一致取 12）。 */
export const RECOMMENDED_PAGE_SIZE = 12;
