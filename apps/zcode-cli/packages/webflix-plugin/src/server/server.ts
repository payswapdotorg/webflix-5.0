import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListResourcesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  CHANNEL_TOOL,
  HOME_TOOL,
  PANEL_META,
  PANEL_MIME,
  PANEL_URI,
  RECOMMENDED_PAGE_SIZE,
  SEARCH_TOOL,
  SHORTS_TOOL,
  SUGGEST_TOOL,
  TRENDING_TOOL,
  WATCH_TOOL,
  type ChannelLite,
  type ChannelPageDTO,
  type CommentDTO,
  type ContinueVideoDTO,
  type HomeFeedDTO,
  type SearchResultsDTO,
  type ShortsDTO,
  type SuggestDTO,
  type TrendingDTO,
  type VideoDTO,
  type WatchDTO,
  type WebflixResult,
} from "../contract.ts";
import {
  SNAPSHOT_CHANNELS,
  SNAPSHOT_CHIPS,
  SNAPSHOT_CONTINUE,
  SNAPSHOT_SHORTS,
  SNAPSHOT_TRENDING_CATEGORIES,
  SNAPSHOT_VIDEOS,
  snapshotComments,
  type SnapshotChannel,
  type SnapshotVideo,
} from "../data.ts";

/**
 * WebFlix MCP server：六个只读数据工具（app-only —— 面板经 callServerTool 调用，宿主不把
 * 它们放进模型工具表，与 zcode-site 面板同律）+ 面板页面资源（`ui://webflix/panel.html`，
 * mcp-app MIME + CSP 声明）。数据全部来自 src/data.ts 的静态快照，零网络、零文件系统。
 */

export interface WebflixServerOptions {
  version: string;
  /** 构建出的面板页面 `dist/ui/panel.html`。 */
  panelPath: string;
}

/** 工具只给页面调：宿主不把 app-only 工具放进模型的工具列表。 */
const APP_ONLY = { ui: { visibility: ["app"] } };

const READ_ONLY = { readOnlyHint: true, idempotentHint: true };

const channelByHandle = new Map(SNAPSHOT_CHANNELS.map((c) => [c.handle, c]));
const channelById = new Map(SNAPSHOT_CHANNELS.map((c) => [c.id, c]));
const videoById = new Map(SNAPSHOT_VIDEOS.map((v) => [v.id, v]));

function toChannelLite(c: SnapshotChannel): ChannelLite {
  return { id: c.id, name: c.name, handle: c.handle, avatarUrl: c.avatarUrl, verified: c.verified };
}

function toVideoDTO(v: SnapshotVideo): VideoDTO {
  const channel = channelByHandle.get(v.channelHandle);
  return {
    id: v.id,
    title: v.title,
    description: v.description,
    thumbnailUrl: v.thumbnailUrl,
    durationSec: v.durationSec,
    views: v.views,
    likes: v.likes,
    category: v.category,
    isShort: v.isShort,
    isLive: v.isLive,
    createdAt: v.createdAt,
    channel: channel
      ? toChannelLite(channel)
      : { id: "", name: v.channelHandle, handle: v.channelHandle, avatarUrl: null, verified: false },
  };
}

function toShortDTO(v: SnapshotVideo): VideoDTO {
  return toVideoDTO(v);
}

/** 首页推荐流：All 模式全量（去掉 continue-watching 里的重复），类别模式按类别过滤。 */
function recommendedFor(category: string): VideoDTO[] {
  const pool =
    category === "All" ? SNAPSHOT_VIDEOS : SNAPSHOT_VIDEOS.filter((v) => v.category === category);
  return pool.map(toVideoDTO);
}

function homeFeed(category: string): HomeFeedDTO {
  const recommended = recommendedFor(category);
  const continueWatching: ContinueVideoDTO[] =
    category === "All"
      ? SNAPSHOT_CONTINUE.flatMap((entry) => {
          const video = videoById.get(entry.id);
          if (!video) return [];
          return [{ ...toVideoDTO(video), watchedSec: entry.watchedSec, watchedAt: video.createdAt }];
        })
      : [];
  const shorts: VideoDTO[] = category === "All" ? SNAPSHOT_SHORTS.map(toShortDTO) : [];
  return {
    continueWatching,
    shorts,
    recommended,
    recommendedCursor: recommended.length > RECOMMENDED_PAGE_SIZE ? "1" : null,
    chips: [...SNAPSHOT_CHIPS],
  };
}

function pageFrom(
  recommended: VideoDTO[],
  cursor: string | null,
): { videos: VideoDTO[]; nextCursor: string | null } {
  const start = cursor === null ? 0 : Number(cursor) * RECOMMENDED_PAGE_SIZE;
  const videos = recommended.slice(start, start + RECOMMENDED_PAGE_SIZE);
  const nextStart = start + RECOMMENDED_PAGE_SIZE;
  return {
    videos,
    nextCursor: nextStart < recommended.length ? String(nextStart / RECOMMENDED_PAGE_SIZE) : null,
  };
}

function search(query: string): SearchResultsDTO {
  const q = query.trim().toLowerCase();
  if (!q) return { videos: [], channels: [] };
  const words = q.split(/\s+/);
  const matches = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const videos = SNAPSHOT_VIDEOS.filter(
    (v) => matches(v.title) || matches(v.category) || matches(v.channelHandle),
  )
    .map(toVideoDTO)
    .slice(0, 20);
  const channels = SNAPSHOT_CHANNELS.filter(
    (c) => matches(c.name) || matches(c.handle) || matches(c.description),
  )
    .slice(0, 6)
    .map((c) => ({
      ...toChannelLite(c),
      subscribers: c.subscribers,
      videoCount: c.videoCount,
    }));
  return { videos, channels };
}

function watch(videoId: string): WatchDTO {
  const video = videoById.get(videoId);
  if (!video) throw new WebflixError("not_found", `Unknown video: ${videoId}`);
  const channel = channelByHandle.get(video.channelHandle);
  const related = SNAPSHOT_VIDEOS.filter(
    (v) => v.id !== video.id && (v.category === video.category || v.channelHandle === video.channelHandle),
  )
    .slice(0, 12)
    .map(toVideoDTO);
  const comments: CommentDTO[] = snapshotComments(video.id, video.title);
  return {
    video: toVideoDTO(video),
    subscribers: channel?.subscribers ?? 0,
    comments,
    related,
  };
}

function channelPage(handleOrId: string): ChannelPageDTO {
  const channel = channelByHandle.get(handleOrId) ?? channelById.get(handleOrId);
  if (!channel) throw new WebflixError("not_found", `Unknown channel: ${handleOrId}`);
  const videos = [...SNAPSHOT_VIDEOS, ...SNAPSHOT_SHORTS]
    .filter((v) => v.channelHandle === channel.handle)
    .map(toVideoDTO);
  return {
    channel: {
      ...toChannelLite(channel),
      subscribers: channel.subscribers,
      videoCount: channel.videoCount,
      description: channel.description,
    },
    videos,
  };
}

function trending(category: string): TrendingDTO {
  const pool =
    category === "Now" || category === "All"
      ? SNAPSHOT_VIDEOS
      : SNAPSHOT_VIDEOS.filter((v) => v.category === category);
  const videos = [...pool].sort((a, b) => b.views - a.views).slice(0, 25).map(toVideoDTO);
  return { videos, categories: [...SNAPSHOT_TRENDING_CATEGORIES] };
}

function suggest(query: string): SuggestDTO {
  const q = query.trim().toLowerCase();
  if (!q) {
    const popular = [
      "lofi hip hop radio",
      "react tutorial",
      "never gonna give you up",
      "learn python",
      "bohemian rhapsody",
      "despacito",
      "neural network",
      "steve jobs stanford",
    ];
    return { suggestions: popular };
  }
  const titles = [...SNAPSHOT_VIDEOS, ...SNAPSHOT_SHORTS]
    .map((v) => v.title)
    .filter((title) => title.toLowerCase().includes(q))
    .slice(0, 8);
  const channels = SNAPSHOT_CHANNELS.map((c) => c.name)
    .filter((name) => name.toLowerCase().includes(q))
    .slice(0, 3)
    .map((name) => `${name} · channel`);
  return { suggestions: [...new Set([...titles, ...channels])].slice(0, 10) };
}

/** 工具结果信封：成功 { data }，失败 { error }（面板据此渲染错误态，不吞错）。 */
function ok<T>(data: T) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data) }],
    structuredContent: { data } as WebflixResult<T>,
    isError: false,
  };
}

class WebflixError extends Error {
  constructor(
    public reason: string,
    message: string,
  ) {
    super(message);
  }
}

function fail(error: unknown) {
  const reason = error instanceof WebflixError ? error.reason : "internal";
  const message = error instanceof Error ? error.message : String(error);
  const payload = { error: { reason, message } };
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    structuredContent: payload,
    isError: true,
  };
}

const TOOLS = [
  {
    name: HOME_TOOL,
    title: "WebFlix home feed",
    description:
      "Read the WebFlix workspace home feed: recommended grid, shorts shelf, continue-watching " +
      "rail and category chips, over the plugin's verified snapshot dataset.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Category chip filter; 'All' for the full feed." },
        cursor: { type: "string", description: "Next-page cursor for the growing grid." },
      },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: SEARCH_TOOL,
    title: "WebFlix search",
    description: "Search the WebFlix snapshot by title, channel and category.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["q"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: WATCH_TOOL,
    title: "WebFlix watch page",
    description: "Read one video with its channel, comments and related rail.",
    inputSchema: {
      type: "object",
      properties: { videoId: { type: "string", minLength: 1, maxLength: 32 } },
      required: ["videoId"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: SHORTS_TOOL,
    title: "WebFlix shorts feed",
    description: "Read the vertical shorts feed (verified snapshot shorts).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: READ_ONLY,
  },
  {
    name: CHANNEL_TOOL,
    title: "WebFlix channel page",
    description: "Read a channel page (handle or channel id) with its videos.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string", minLength: 1, maxLength: 120 } },
      required: ["handle"],
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: TRENDING_TOOL,
    title: "WebFlix trending",
    description: "Read the trending ranked list for a category tab.",
    inputSchema: {
      type: "object",
      properties: { category: { type: "string", description: "Trending tab; 'Now' for the default." } },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
  {
    name: SUGGEST_TOOL,
    title: "WebFlix search suggestions",
    description: "Autocomplete suggestions for the search box.",
    inputSchema: {
      type: "object",
      properties: { q: { type: "string", maxLength: 200 } },
      additionalProperties: false,
    },
    annotations: READ_ONLY,
  },
] as const;

export function createWebflixServer(options: WebflixServerOptions): Server {
  const server = new Server(
    { name: "webflix", version: options.version },
    { capabilities: { resources: {}, tools: {} } },
  );

  // 不写 server instructions：模型看不到这个 server（app-only 工具），读资源也不经工具审批。
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: PANEL_URI,
        name: "WebFlix",
        mimeType: PANEL_MIME,
        _meta: PANEL_META,
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    if (uri === PANEL_URI) {
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(options.panelPath, "utf8");
      return { contents: [{ uri, mimeType: PANEL_MIME, text, _meta: PANEL_META }] };
    }
    throw new WebflixError("invalid_resource", `Unknown resource: ${uri}`);
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      ...tool,
      _meta: APP_ONLY,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const input = (args ?? {}) as Record<string, unknown>;
      switch (name) {
        case HOME_TOOL: {
          const category = typeof input.category === "string" && input.category ? input.category : "All";
          const feed = homeFeed(category);
          if (typeof input.cursor === "string" && input.cursor) {
            const page = pageFrom(feed.recommended, input.cursor);
            return ok({ videos: page.videos, nextCursor: page.nextCursor });
          }
          return ok(feed);
        }
        case SEARCH_TOOL:
          return ok(search(String(input.q ?? "")));
        case WATCH_TOOL:
          return ok(watch(String(input.videoId ?? "")));
        case SHORTS_TOOL:
          return ok({ shorts: SNAPSHOT_SHORTS.map(toShortDTO) } satisfies ShortsDTO);
        case CHANNEL_TOOL:
          return ok(channelPage(String(input.handle ?? "")));
        case TRENDING_TOOL: {
          const category = typeof input.category === "string" && input.category ? input.category : "Now";
          return ok(trending(category));
        }
        case SUGGEST_TOOL:
          return ok(suggest(String(input.q ?? "")));
        default:
          throw new WebflixError("unknown_tool", `Unknown tool: ${name}`);
      }
    } catch (error) {
      return fail(error);
    }
  });

  return server;
}
