import { App } from "@modelcontextprotocol/ext-apps";
import { z } from "zod/v4";

/** 面板路由状态，经 ZCode 扩展 `ui/set-widget-state` 交给宿主内存保存，切换会话后恢复。 */
export type Route =
  | { page: "home" }
  | { page: "search"; q: string }
  | { page: "watch"; videoId: string }
  | { page: "shorts" }
  | { page: "trending" }
  | { page: "channel"; handle: string }
  | { page: "explore" }
  | { page: "placeholder"; title: string };

const WIDGET_STATE_KEY = "zcode/widgetState";
const SET_WIDGET_STATE = "ui/set-widget-state";
const VIDEO_ID = /^[A-Za-z0-9_-]{5,32}$/;
const HANDLE = /^@?[A-Za-z0-9._-]{1,60}$/;
const QUERY_MAX = 200;

export interface WebflixHost {
  connected(): boolean;
  initialRoute(): Route;
  saveRoute(route: Route): void;
  call<T>(tool: string, args: Record<string, unknown>): Promise<{ data?: T; error?: { reason: string; message?: string } }>;
}

export async function connectHost(onReconnect: () => void): Promise<WebflixHost> {
  const app = new App(
    { name: "webflix", version: "1" },
    {},
    { autoResize: false },
  );
  await app.connect();
  onReconnect();

  const request = (method: string, params: Record<string, unknown>) =>
    app.request({ method, params }, z.looseObject({}));

  return {
    connected: () => true,
    initialRoute: () => parseRoute(app.getHostContext()?.[WIDGET_STATE_KEY]),
    saveRoute(route) {
      void request(SET_WIDGET_STATE, { widgetState: route }).catch(() => {
        /* 旧宿主不认这个扩展方法：只是重开后回到首页。 */
      });
    },
    async call<T>(tool: string, args: Record<string, unknown>) {
      try {
        const result = await app.callServerTool({ name: tool, arguments: args });
        const structured = result.structuredContent as
          | { data?: T; error?: { reason: string; message?: string } }
          | undefined;
        if (structured && ("data" in structured || "error" in structured)) return structured;
        return { error: { reason: "bad_response" } };
      } catch {
        return { error: { reason: "network" } };
      }
    },
  };
}

export function parseRoute(value: unknown): Route {
  if (typeof value !== "object" || value === null) return { page: "home" };
  const state = value as Record<string, unknown>;
  if (state.page === "search" && typeof state.q === "string") return { page: "search", q: state.q.slice(0, QUERY_MAX) };
  if (state.page === "watch" && typeof state.videoId === "string" && VIDEO_ID.test(state.videoId))
    return { page: "watch", videoId: state.videoId };
  if (state.page === "shorts") return { page: "shorts" };
  if (state.page === "trending") return { page: "trending" };
  if (state.page === "channel" && typeof state.handle === "string" && HANDLE.test(state.handle))
    return { page: "channel", handle: state.handle };
  if (state.page === "explore") return { page: "explore" };
  if (state.page === "placeholder" && typeof state.title === "string")
    return { page: "placeholder", title: state.title.slice(0, 60) };
  return { page: "home" };
}
