/**
 * WebFlix 面板根组件 —— AppShell（固定 topbar + 可折叠 sidebar + 滚动主列）与 hash 路由。
 * 结构对应 WebFlix 2.0 的 src/components/app/app-shell.tsx；路由状态经宿主
 * `ui/set-widget-state` 保存，切换会话后恢复（zcode-site 面板同律）。
 */
import { useEffect, useState } from "react";
import { connectHost, type Route, type WebflixHost } from "./host.ts";
import { Sidebar, SiteFooter, Topbar, useToast } from "./views.tsx";
import {
  ChannelPage,
  ExplorePage,
  HomeFeed,
  PlaceholderPage,
  SearchPage,
  ShortsPage,
  TrendingPage,
  WatchPage,
} from "./pages.tsx";

declare global {
  interface Window {
    __webflixHost?: WebflixHost;
    __webflixReady?: Promise<void>;
  }
}

function routeToHash(route: Route): string {
  switch (route.page) {
    case "home":
      return "#/";
    case "search":
      return `#/search?q=${encodeURIComponent(route.q)}`;
    case "watch":
      return `#/watch/${route.videoId}`;
    case "shorts":
      return "#/shorts";
    case "trending":
      return "#/trending";
    case "channel":
      return `#/channel/${route.handle}`;
    case "explore":
      return "#/explore";
    case "placeholder":
      return `#/page/${encodeURIComponent(route.title)}`;
  }
}

function hashToRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  const [head, rest] = [path.split(/[/?]/)[0], path.slice(path.indexOf("?") + 1)];
  if (head === "search") {
    const q = new URLSearchParams(rest).get("q") ?? "";
    return { page: "search", q };
  }
  if (head === "watch" && path.startsWith("watch/")) {
    const videoId = path.slice("watch/".length).split(/[/?]/)[0];
    if (videoId) return { page: "watch", videoId };
  }
  if (head === "shorts") return { page: "shorts" };
  if (head === "trending") return { page: "trending" };
  if (head === "channel" && path.startsWith("channel/")) {
    const handle = decodeURIComponent(path.slice("channel/".length).split(/[/?]/)[0]);
    if (handle) return { page: "channel", handle };
  }
  if (head === "explore") return { page: "explore" };
  if (head === "page" && path.startsWith("page/")) {
    const title = decodeURIComponent(path.slice("page/".length));
    if (title) return { page: "placeholder", title };
  }
  return { page: "home" };
}

export function WebFlixApp({ host }: { host: WebflixHost }) {
  const [route, setRoute] = useState<Route>(() => hashToRoute(location.hash));
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [category, setCategory] = useState("All");
  const { toastEl, toast } = useToast();

  useEffect(() => {
    const apply = (hash: string) => setRoute(hashToRoute(hash));
    apply(location.hash);
    window.addEventListener("hashchange", () => apply(location.hash));
    return () => window.removeEventListener("hashchange", () => apply(location.hash));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const navigate = (next: Route) => {
    location.hash = routeToHash(next);
    setRoute(next);
    host.saveRoute(next);
  };

  const isShorts = route.page === "shorts";

  return (
    <div className="wf-root">
      <Topbar
        route={route}
        navigate={navigate}
        onToggleSidebar={() => setCollapsed((v) => !v)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        toast={toast}
      />
      <div className="wf-body">
        <Sidebar route={route} navigate={navigate} collapsed={collapsed} />
        <main id="content" className="wf-main" aria-label="Main content">
          <div className="wf-main-col">
            <div className="wf-content">
              {route.page === "home" && (
                <HomeFeed
                  navigate={navigate}
                  toast={toast}
                  category={category}
                  onCategory={(chip) => {
                    setCategory(chip);
                    navigate({ page: "home" });
                  }}
                />
              )}
              {route.page === "search" && <SearchPage query={route.q} navigate={navigate} toast={toast} />}
              {route.page === "watch" && <WatchPage videoId={route.videoId} navigate={navigate} toast={toast} />}
              {route.page === "shorts" && <ShortsPage toast={toast} />}
              {route.page === "trending" && <TrendingPage navigate={navigate} toast={toast} />}
              {route.page === "channel" && <ChannelPage handle={route.handle} navigate={navigate} toast={toast} />}
              {route.page === "explore" && <ExplorePage navigate={navigate} />}
              {route.page === "placeholder" && <PlaceholderPage title={route.title} />}
            </div>
            {isShorts ? null : <SiteFooter />}
          </div>
        </main>
      </div>
      {toastEl}
    </div>
  );
}

export async function mountApp(root: HTMLElement): Promise<void> {
  const { createElement } = await import("react");
  const { createRoot } = await import("react-dom/client");
  const host = await connectHost(() => undefined);
  // 恢复宿主保存的路由（仅在地址栏还停在首页时应用，避免覆盖显式导航）。
  if (!location.hash || location.hash === "#/" || location.hash === "#") {
    const saved = host.initialRoute();
    if (saved.page !== "home") location.hash = routeToHash(saved);
  }
  window.__webflixHost = host;
  createRoot(root).render(createElement(WebFlixApp, { host }));
}
