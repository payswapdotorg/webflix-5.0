import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHANNEL_TOOL,
  HOME_TOOL,
  PANEL_URI,
  SEARCH_TOOL,
  SHORTS_TOOL,
  SUGGEST_TOOL,
  TRENDING_TOOL,
  WATCH_TOOL,
  type ChannelPageDTO,
  type HomeFeedDTO,
  type SearchResultsDTO,
  type ShortsDTO,
  type TrendingDTO,
  type VideoDTO,
  type WatchDTO,
} from "../contract.ts";
import { createWebflixServer } from "./server.ts";

let dir: string;
let client: Client;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "webflix-server-"));
  await writeFile(join(dir, "panel.html"), "<html>WebFlix panel</html>");
  const server = createWebflixServer({
    version: "0.1.0",
    panelPath: join(dir, "panel.html"),
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

afterEach(async () => {
  await client.close();
  await rm(dir, { recursive: true, force: true });
});

/** 工具结果统一信封：structuredContent 携带 {data} / {error}（面板同一读取口径）。 */
function dataOf<T>(result: unknown): T {
  const structured = (result as { structuredContent?: { data?: unknown } }).structuredContent;
  if (structured && "data" in structured) return structured.data as T;
  throw new Error("missing structuredContent data");
}

describe("WebFlix MCP server", () => {
  it("has no instructions and only app-visible read-only tools", async () => {
    expect(client.getInstructions()).toBeUndefined();
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toEqual([
      HOME_TOOL,
      SEARCH_TOOL,
      WATCH_TOOL,
      SHORTS_TOOL,
      CHANNEL_TOOL,
      TRENDING_TOOL,
      SUGGEST_TOOL,
    ]);
    for (const tool of tools) {
      expect(tool._meta).toEqual({ ui: { visibility: ["app"] } });
      expect(tool.annotations).toMatchObject({ readOnlyHint: true });
    }
  });

  it("serves the panel with the mcp-app MIME and CSP meta", async () => {
    const { resources } = await client.listResources();
    expect(resources.map((resource) => resource.uri)).toEqual([PANEL_URI]);
    const { contents } = await client.readResource({ uri: PANEL_URI });
    expect(contents[0]).toMatchObject({
      text: "<html>WebFlix panel</html>",
      mimeType: "text/html;profile=mcp-app",
    });
    expect(contents[0]._meta).toMatchObject({
      ui: { csp: { resourceDomains: ["https://i.ytimg.com"] } },
    });
  });

  it("returns the home feed with chips, shorts and the interleaved grid pool", async () => {
    const feed = dataOf<HomeFeedDTO>(await client.callTool({ name: HOME_TOOL, arguments: {} }));
    expect(feed.chips[0]).toBe("All");
    expect(feed.chips).toContain("Music");
    expect(feed.recommended.length).toBeGreaterThan(10);
    expect(feed.shorts.length).toBeGreaterThanOrEqual(8);
    expect(feed.continueWatching.length).toBeGreaterThan(0);
    expect(feed.continueWatching[0]).toMatchObject({ watchedSec: expect.any(Number) });
    expect(feed.recommendedCursor).not.toBeNull();
  });

  it("filters the home feed by category chip", async () => {
    const feed = dataOf<HomeFeedDTO>(
      await client.callTool({ name: HOME_TOOL, arguments: { category: "Coding" } }),
    );
    expect(feed.recommended.length).toBeGreaterThan(0);
    expect(feed.recommended.every((video) => video.category === "Coding")).toBe(true);
    expect(feed.shorts).toEqual([]);
  });

  it("pages the growing grid via the cursor", async () => {
    const page = dataOf<{ videos: VideoDTO[]; nextCursor: string | null }>(
      await client.callTool({ name: HOME_TOOL, arguments: { cursor: "1" } }),
    );
    expect(page.videos.length).toBeGreaterThan(0);
    expect(typeof page.nextCursor).toBe("string");
  });

  it("searches by title and channel", async () => {
    const results = dataOf<SearchResultsDTO>(
      await client.callTool({ name: SEARCH_TOOL, arguments: { q: "react" } }),
    );
    expect(results.videos.length).toBeGreaterThan(3);
    const channels = dataOf<SearchResultsDTO>(
      await client.callTool({ name: SEARCH_TOOL, arguments: { q: "Adele" } }),
    ).channels;
    expect(channels.some((channel) => channel.name === "Adele")).toBe(true);
  });

  it("serves a watch page with comments and related rail", async () => {
    const data = dataOf<WatchDTO>(
      await client.callTool({ name: WATCH_TOOL, arguments: { videoId: "dQw4w9WgXcQ" } }),
    );
    expect(data.video.title).toContain("Never Gonna Give You Up");
    expect(data.video.thumbnailUrl).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
    expect(data.comments.length).toBeGreaterThan(3);
    expect(data.related.length).toBeGreaterThan(0);
    expect(data.subscribers).toBeGreaterThan(0);
  });

  it("answers an unknown video with a typed error envelope", async () => {
    const result = await client.callTool({ name: WATCH_TOOL, arguments: { videoId: "zzzzzzzzzzz" } });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { reason: "not_found" } });
  });

  it("serves the shorts feed (all vertical, 9:16 shelf)", async () => {
    const data = dataOf<ShortsDTO>(await client.callTool({ name: SHORTS_TOOL, arguments: {} }));
    expect(data.shorts.length).toBeGreaterThanOrEqual(8);
    expect(data.shorts.every((short) => short.isShort)).toBe(true);
  });

  it("serves a channel page by handle and id", async () => {
    const data = dataOf<ChannelPageDTO>(
      await client.callTool({ name: CHANNEL_TOOL, arguments: { handle: "EdSheeran" } }),
    );
    expect(data.channel.name).toBe("Ed Sheeran");
    expect(data.videos.length).toBeGreaterThan(0);
    const byId = dataOf<ChannelPageDTO>(
      await client.callTool({ name: CHANNEL_TOOL, arguments: { handle: data.channel.id } }),
    );
    expect(byId.channel.handle).toBe("EdSheeran");
  });

  it("serves trending ranked by views with category tabs", async () => {
    const data = dataOf<TrendingDTO>(await client.callTool({ name: TRENDING_TOOL, arguments: {} }));
    expect(data.categories).toContain("Now");
    const views = data.videos.map((video) => video.views);
    expect([...views].sort((a, b) => b - a)).toEqual(views);
  });

  it("suggests completions for the search box", async () => {
    const data = dataOf<{ suggestions: string[] }>(
      await client.callTool({ name: SUGGEST_TOOL, arguments: { q: "lofi" } }),
    );
    expect(data.suggestions.length).toBeGreaterThan(0);
    expect(data.suggestions.some((s) => s.toLowerCase().includes("lofi"))).toBe(true);
  });

  it("rejects unknown tools and resources with typed errors", async () => {
    const tool = await client.callTool({ name: "webflix_nope", arguments: {} });
    expect(tool.isError).toBe(true);
    await expect(client.readResource({ uri: "ui://webflix/nope.html" })).rejects.toThrow();
  });
});
