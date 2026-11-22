/**
 * WebFlix 面板视图 —— 从 WebFlix 2.0（payswapdotorg/webflix-2.0）的组件移植：
 * AppShell / Topbar / Sidebar / Footer / CategoryChips / VideoCard / ShortsShelf /
 * ContinueRail 的结构与视觉值（间距、圆角、字号、徽标）逐项对应源实现；
 * 数据一律来自插件 server 的工具（callServerTool），无内嵌假数据。
 */
import { useEffect, useRef, useState } from "react";
import {
  ChefHat,
  ChevronRight,
  Clapperboard,
  Clock,
  Code,
  Compass,
  Cpu,
  Crown,
  Disc3,
  Download,
  Dumbbell,
  Flag,
  Flame,
  Gamepad2,
  GraduationCap,
  HelpCircle,
  History,
  Home,
  Layers,
  ListVideo,
  Menu,
  MessageSquarePlus,
  Mic,
  MonitorPlay,
  Music,
  Newspaper,
  Plane,
  Plus,
  Radio,
  Search,
  Settings,
  SquarePlay,
  ThumbsUp,
  Trophy,
  TvMinimalPlay,
  UserRound,
  Bell,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "./host.ts";
import { compactCount, displayPublished, displayViews, formatDuration, formatSubscribers, watchProgress } from "./format.ts";
import type { ContinueVideoDTO, VideoDTO } from "../contract.ts";

/* ---------------------------------- navigation model ---------------------------------- */

export type Navigate = (route: Route) => void;

const MAIN_NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: { page: "home" }, label: "Home", icon: Home },
  { route: { page: "shorts" }, label: "Shorts", icon: SquarePlay },
  { route: { page: "placeholder", title: "Subscriptions" }, label: "Subscriptions", icon: Layers },
  { route: { page: "placeholder", title: "Netflix" }, label: "Netflix", icon: TvMinimalPlay },
  { route: { page: "placeholder", title: "TikTok" }, label: "TikTok", icon: Clapperboard },
  { route: { page: "placeholder", title: "WebFlix LIVE" }, label: "WebFlix LIVE", icon: Radio },
];

const YOU_ROW = { route: { page: "placeholder", title: "You" } as Route, label: "You", icon: UserRound };

const YOU_NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: { page: "placeholder", title: "History" }, label: "History", icon: History },
  { route: { page: "placeholder", title: "Playlists" }, label: "Playlists", icon: ListVideo },
  { route: { page: "placeholder", title: "Your videos" }, label: "Your videos", icon: MonitorPlay },
  { route: { page: "placeholder", title: "Watch later" }, label: "Watch later", icon: Clock },
  { route: { page: "placeholder", title: "Liked videos" }, label: "Liked videos", icon: ThumbsUp },
  { route: { page: "placeholder", title: "Downloads" }, label: "Downloads", icon: Download },
];

const MORE_NAV: { route: Route; label: string; icon: LucideIcon }[] = [
  { route: { page: "placeholder", title: "Settings" }, label: "Settings", icon: Settings },
  { route: { page: "placeholder", title: "WebFlix Premium" }, label: "WebFlix Premium", icon: Crown },
  { route: { page: "placeholder", title: "Report history" }, label: "Report history", icon: Flag },
  { route: { page: "placeholder", title: "Help" }, label: "Help", icon: HelpCircle },
  { route: { page: "placeholder", title: "Send feedback" }, label: "Send feedback", icon: MessageSquarePlus },
];

const CATEGORY_ICON: Record<string, LucideIcon> = {
  Music,
  Gaming: Gamepad2,
  Live: Radio,
  News: Newspaper,
  Sports: Trophy,
  Coding: Code,
  Tech: Cpu,
  Education: GraduationCap,
  Travel: Plane,
  Cooking: ChefHat,
  Fitness: Dumbbell,
  Comedy: Clapperboard,
  Mixes: Disc3,
  Podcasts: Mic,
};

export const CATEGORIES = Object.keys(CATEGORY_ICON);

const SIDEBAR_FOOTER_LINKS = ["About", "Press", "Copyright", "Contact us", "Creators", "Advertise", "Developers"] as const;

/** 演示订阅列表（工作区快照的侧栏 chrome；与 WebFlix 登录基线一致的非空订阅区）。 */
export const DEMO_SUBSCRIPTIONS = [
  { id: "ch_ed_sheeran", name: "Ed Sheeran", handle: "EdSheeran", verified: true },
  { id: "ch_3blue1brown", name: "3Blue1Brown", handle: "3blue1brown", verified: true },
  { id: "ch_freecodecamp", name: "freeCodeCamp.org", handle: "freecodecamp", verified: true },
  { id: "ch_fireship", name: "Fireship", handle: "Fireship", verified: true },
  { id: "ch_lofigirl", name: "Lofi Girl", handle: "LofiGirl", verified: true },
];

/* ---------------------------------- shared bits ---------------------------------- */

export function WebFlixLogo({ word = true }: { word?: boolean }) {
  return (
    <span className="wf-logo" aria-label="WebFlix Home">
      <svg viewBox="0 0 28 20" width="28" height="20" aria-hidden="true">
        <rect x="0.5" y="0.5" width="27" height="19" rx="5" fill="#FF0000" />
        <path d="M11 6.2 11 13.8 17.5 10Z" fill="#fff" />
      </svg>
      {word && <span className="wf-logo-word">WebFlix</span>}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="wf-verified" title="Verified" aria-label="Verified">
      <BadgeCheck width="14" height="14" aria-hidden="true" />
    </span>
  );
}

export function Avatar({ name, size = 36, className = "" }: { name: string; size?: number; className?: string }) {
  const initial = (name[0] ?? "?").toUpperCase();
  return (
    <span
      className={`wf-avatar ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/* ---------------------------------- topbar ---------------------------------- */

export function Topbar({
  route,
  navigate,
  onToggleSidebar,
  theme,
  onToggleTheme,
  toast,
}: {
  route: Route;
  navigate: Navigate;
  onToggleSidebar: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  toast: (message: string) => void;
}) {
  const [query, setQuery] = useState(route.page === "search" ? route.q : "");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => {
    if (route.page === "search") setQuery(route.q);
  }, [route]);
  useEffect(() => {
    if (!suggestOpen) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const host = window.__webflixHost;
      if (!host) return;
      const result = await host.call<{ suggestions: string[] }>("webflix_suggest", { q: query });
      if (!cancelled) setSuggestions(result.data?.suggestions ?? []);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, suggestOpen]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSuggestOpen(false);
    navigate({ page: "search", q });
  }

  return (
    <header className="wf-topbar">
      <div className="wf-topbar-left">
        <button className="wf-iconbtn" aria-label="Toggle sidebar" title="Toggle sidebar" onClick={onToggleSidebar}>
          <Menu width="20" height="20" />
        </button>
        <a onClick={() => navigate({ page: "home" })} aria-label="WebFlix Home">
          <WebFlixLogo />
        </a>
      </div>

      <form role="search" className="wf-search" onSubmit={submitSearch}>
        <div className="wf-search-box">
          <input
            className="wf-search-input"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSuggestOpen(true);
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            placeholder="Search"
            aria-label="Search videos and channels"
          />
          <button type="submit" className="wf-search-btn" aria-label="Search">
            <Search width="20" height="20" />
          </button>
          {suggestOpen && suggestions.length > 0 && (
            <div className="wf-suggest" role="listbox" aria-label="Search suggestions">
              {suggestions.map((s) => (
                <button
                  type="button"
                  key={s}
                  className="wf-suggest-item"
                  onMouseDown={() => {
                    setQuery(s);
                    navigate({ page: "search", q: s });
                    setSuggestOpen(false);
                  }}
                >
                  <Search width="16" height="16" strokeWidth={1.8} />
                  <span className="wf-truncate">{s}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="wf-mic"
          aria-label="Search with your voice"
          title="Voice search"
          onClick={() => toast("Voice search needs the WebFlix app microphone surface")}
        >
          <Mic width="20" height="20" />
        </button>
      </form>

      {/* 移动端专用搜索入口（源组件 topbar：sm:hidden —— 桌面端由中央搜索框承担） */}
      <button
        className="wf-iconbtn wf-mobile-only"
        aria-label="Search"
        onClick={() => navigate({ page: "search", q: "" })}
      >
        <Search width="20" height="20" />
      </button>

      <div className="wf-topbar-right">
        <span style={{ position: "relative" }}>
          <button className="wf-iconbtn" aria-label="Create" title="Create" onClick={() => setCreateOpen((v) => !v)}>
            <Plus width="22" height="22" />
          </button>
          {createOpen && (
            <div className="wf-suggest" style={{ position: "absolute", top: 44, right: 0, minWidth: 180 }}>
              {["Upload video", "Go live", "Create post"].map((item) => (
                <button key={item} className="wf-suggest-item" onClick={() => { setCreateOpen(false); toast(`${item} is not part of the workspace snapshot`); }}>
                  {item}
                </button>
              ))}
            </div>
          )}
        </span>
        <span style={{ position: "relative" }}>
          <button className="wf-iconbtn" aria-label="Notifications" onClick={() => setBellOpen((v) => !v)}>
            <Bell width="20" height="20" />
          </button>
          {bellOpen && (
            <div className="wf-suggest" style={{ position: "absolute", top: 44, right: 0, minWidth: 280, padding: 8 }}>
              <strong style={{ display: "block", padding: "4px 8px" }}>Notifications</strong>
              {[
                ["Lofi Girl", "lofi hip hop radio is live"],
                ["Fireship", "React in 100 Seconds was recommended for you"],
                ["freeCodeCamp.org", "New course in your Coding feed"],
              ].map(([who, what]) => (
                <div key={what} className="wf-suggest-item" style={{ cursor: "default" }}>
                  <Avatar name={who} size={32} />
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: "block", fontSize: 13 }}>{who}</strong>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{what}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </span>
        <button
          className="wf-iconbtn"
          aria-label="Toggle theme"
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          onClick={onToggleTheme}
        >
          {theme === "dark" ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
          )}
        </button>
        <button className="wf-iconbtn" aria-label="Account" title="Account (demo)" onClick={() => toast("Signed in to the WebFlix workspace as the demo viewer")}>
          <Avatar name="You" size={32} />
        </button>
      </div>
    </header>
  );
}

/* ---------------------------------- sidebar ---------------------------------- */

function isActive(route: Route, target: Route): boolean {
  if (target.page !== route.page) return false;
  if (target.page === "home" && route.page === "home") return true;
  if (target.page === "placeholder" && route.page === "placeholder") return route.title === target.title;
  if (target.page === "shorts" && route.page === "shorts") return true;
  return false;
}

function NavRow({
  item,
  active,
  navigate,
  collapsed,
}: {
  item: { route: Route; label: string; icon: LucideIcon };
  active: boolean;
  navigate: Navigate;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  return (
    <a
      className="wf-navrow"
      data-active={active}
      aria-current={active ? "page" : undefined}
      title={item.label}
      onClick={() => navigate(item.route)}
    >
      <Icon />
      <span className="wf-truncate">{collapsed ? item.label : item.label}</span>
    </a>
  );
}

export function Sidebar({
  route,
  navigate,
  collapsed,
}: {
  route: Route;
  navigate: Navigate;
  collapsed: boolean;
}) {
  return (
    <aside className="wf-sidebar" data-collapsed={collapsed} aria-label="Main navigation">
      <nav className="wf-nav">
        {MAIN_NAV.map((item) => (
          <NavRow key={item.label} item={item} active={isActive(route, item.route)} navigate={navigate} collapsed={collapsed} />
        ))}
        <div className="wf-nav-divider" role="separator" />
        <NavRow item={YOU_ROW} active={isActive(route, YOU_ROW.route)} navigate={navigate} collapsed={collapsed} />
        {!collapsed &&
          YOU_NAV.map((item) => (
            <NavRow key={item.label} item={item} active={isActive(route, item.route)} navigate={navigate} collapsed={collapsed} />
          ))}
        {!collapsed && (
          <>
            <div className="wf-nav-divider" role="separator" />
            <h3 className="wf-nav-section">Subscriptions</h3>
            {DEMO_SUBSCRIPTIONS.map((ch) => (
              <a key={ch.id} className="wf-nav-subrow" onClick={() => navigate({ page: "channel", handle: ch.handle })}>
                <Avatar name={ch.name} size={24} />
                <span className="wf-truncate">{ch.name}</span>
                {ch.verified && <VerifiedBadge />}
              </a>
            ))}
            <div className="wf-nav-divider" role="separator" />
            <h3 className="wf-nav-section">Explore</h3>
            <a
              className="wf-nav-subrow"
              aria-current={route.page === "trending" ? "page" : undefined}
              onClick={() => navigate({ page: "trending" })}
            >
              <Flame />
              <span>Trending</span>
            </a>
            <a
              className="wf-nav-subrow"
              aria-current={route.page === "explore" ? "page" : undefined}
              onClick={() => navigate({ page: "explore" })}
            >
              <Compass />
              <span>Explore</span>
            </a>
            {CATEGORIES.map((category) => {
              const Icon = CATEGORY_ICON[category] ?? Disc3;
              return (
                <a
                  key={category}
                  className="wf-nav-subrow"
                  onClick={() => navigate({ page: "search", q: category })}
                >
                  <Icon />
                  <span>{category}</span>
                </a>
              );
            })}
            <div className="wf-nav-divider" role="separator" />
            <h3 className="wf-nav-section">More from WebFlix</h3>
            {MORE_NAV.map((item) => (
              <NavRow key={item.label} item={item} active={isActive(route, item.route)} navigate={navigate} collapsed={collapsed} />
            ))}
            <div className="wf-nav-divider" role="separator" />
            <div className="wf-nav-foot">
              {SIDEBAR_FOOTER_LINKS.map((label) => (
                <span key={label} style={{ cursor: "default" }}>{label}</span>
              ))}
            </div>
            <p className="wf-nav-copyright">© 2026 WebFlix 2.0</p>
          </>
        )}
      </nav>
    </aside>
  );
}

/* ---------------------------------- footer ---------------------------------- */

export function SiteFooter() {
  return (
    <footer className="wf-footer">
      <div className="wf-footer-brand">
        <WebFlixLogo word={false} />
        <strong>WebFlix</strong>
        <span>— a YouTube-clone interface by WebFlix 2.0</span>
      </div>
      <nav className="wf-footer-links" aria-label="Footer">
        {["About", "Press", "Copyright", "Contact us", "Creators", "Advertise", "Developers", "Terms", "Privacy", "Policy & Safety"].map((label) => (
          <a key={label} onClick={() => undefined} style={{ cursor: "default" }}>
            {label}
          </a>
        ))}
      </nav>
      <p className="wf-footer-copy">
        WebFlix workspace · verified snapshot data from youtube.com · interface baseline: WebFlix
      </p>
    </footer>
  );
}

/* ---------------------------------- category chips ---------------------------------- */

export function CategoryChips({ chips, active, onPick }: { chips: string[]; active: string; onPick: (chip: string) => void }) {
  const current = active || "All";
  return (
    <div className="wf-chips" role="tablist" aria-label="Filter by category">
      {chips.map((chip) => (
        <button
          key={chip}
          role="tab"
          aria-selected={chip === current}
          className="wf-chip"
          data-active={chip === current}
          data-testid="category-chip"
          onClick={() => onPick(chip)}
        >
          {chip}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------- video card ---------------------------------- */

export function VideoCard({
  video,
  variant = "grid",
  navigate,
  toast,
}: {
  video: VideoDTO | ContinueVideoDTO;
  variant?: "grid" | "rail";
  navigate: Navigate;
  toast: (message: string) => void;
}) {
  const watched = "watchedSec" in video ? watchProgress(video.watchedSec, video.durationSec ?? 0) : 0;
  return (
    <article className={`wf-card ${variant === "rail" ? "wf-card-rail" : ""}`}>
      <a className="wf-thumb" aria-label={`Watch ${video.title}`} onClick={() => navigate({ page: "watch", videoId: video.id })}>
        <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
        {video.isLive ? (
          <span className="wf-livebadge">Live</span>
        ) : video.durationSec !== null ? (
          <span className="wf-duration">{formatDuration(video.durationSec)}</span>
        ) : null}
        {watched > 0 && watched < 1 && (
          <span className="wf-watched" data-testid="video-card-watched">Watched</span>
        )}
        {watched > 0 && (
          <span className="wf-progress" aria-label={`Watched ${Math.round(watched * 100)}%`}>
            <span className="wf-progress-bar" style={{ width: `${Math.round(watched * 100)}%`, display: "block" }} />
          </span>
        )}
      </a>
      <div className="wf-card-meta">
        <Avatar name={video.channel.name} />
        <div className="wf-card-meta-body">
          <a className="wf-card-title" title={video.title} onClick={() => navigate({ page: "watch", videoId: video.id })}>
            {video.title}
          </a>
          <a className="wf-card-channel" onClick={() => navigate({ page: "channel", handle: video.channel.handle })}>
            <span className="wf-truncate" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.channel.name}</span>
            {video.channel.verified && <VerifiedBadge />}
          </a>
          <p className="wf-card-views">
            {displayViews(video)}
            {(() => {
              const age = displayPublished(video);
              return age ? ` · ${age}` : "";
            })()}
          </p>
        </div>
        <button
          className="wf-iconbtn"
          style={{ width: 32, height: 32 }}
          aria-label={`More options for ${video.title}`}
          title="More options"
          onClick={() => toast("Saved to Watch later (workspace snapshot)")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="12" cy="19" r="1.7" /></svg>
        </button>
      </div>
    </article>
  );
}

/* ---------------------------------- shelves ---------------------------------- */

export function ShelfScroller({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="wf-shelf-row" role="group" aria-label={label} data-testid={`shelf-${label}`}>
      {children}
    </div>
  );
}

export function ShortsShelf({ shorts, navigate }: { shorts: VideoDTO[]; navigate: Navigate }) {
  if (shorts.length === 0) return null;
  return (
    <section className="wf-shelf" aria-label="Shorts shelf">
      <h2 className="wf-shelf-title">
        <SquarePlay aria-hidden="true" /> Shorts
      </h2>
      <ShelfScroller label="Shorts">
        {shorts.map((short) => (
          <a
            key={short.id}
            className="wf-shortstile"
            aria-label={`Open Shorts: ${short.title}`}
            onClick={() => navigate({ page: "shorts" })}
          >
            <span className="wf-thumb">
              <img src={short.thumbnailUrl} alt={short.title} loading="lazy" />
              {short.durationSec ? (
                <span className="wf-duration">
                  {short.durationSec < 60
                    ? `0:${String(short.durationSec).padStart(2, "0")}`
                    : formatDuration(short.durationSec)}
                </span>
              ) : null}
            </span>
            <p className="wf-shortstile-title">{short.title}</p>
            <p className="wf-shortstile-views">{displayViews(short)}</p>
          </a>
        ))}
      </ShelfScroller>
    </section>
  );
}

export function ContinueRail({ videos, navigate, toast }: { videos: ContinueVideoDTO[]; navigate: Navigate; toast: (m: string) => void }) {
  if (videos.length === 0) return null;
  return (
    <section className="wf-rail" aria-label="Continue watching rail">
      {/* 源组件 video-rail：Clock size-5 muted 图标 + "History →" more 链接 */}
      <div className="wf-rail-head">
        <h2 className="wf-rail-title">
          <Clock aria-hidden="true" /> Continue watching
        </h2>
        <a className="wf-rail-more" onClick={() => navigate({ page: "placeholder", title: "History" })}>
          History <ChevronRight width="16" height="16" />
        </a>
      </div>
      <ShelfScroller label="Continue watching">
        {videos.map((video) => (
          <VideoCard key={video.id} video={video} variant="rail" navigate={navigate} toast={toast} />
        ))}
      </ShelfScroller>
    </section>
  );
}

/* ---------------------------------- skeletons / empty / error ---------------------------------- */

export function HomeSkeleton() {
  return (
    <div style={{ padding: "8px 16px 32px" }} aria-busy="true" aria-label="Loading home feed">
      <div className="wf-grid">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="wf-skeleton" style={{ aspectRatio: "16 / 9", width: "100%" }} />
            <div style={{ display: "flex", gap: 12 }}>
              <div className="wf-skeleton" style={{ width: 36, height: 36, borderRadius: 9999 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div className="wf-skeleton" style={{ height: 16, width: "91.6%" }} />
                <div className="wf-skeleton" style={{ height: 12, width: "66%" }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, overflow: "hidden", marginTop: 24 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="wf-skeleton" style={{ aspectRatio: "9 / 16", width: 168, flexShrink: 0 }} />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="wf-empty">
      <p className="wf-empty-title">{title}</p>
      <p className="wf-empty-body">{body}</p>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="wf-error-box" role="alert">
      <p className="wf-empty-title">Something went wrong</p>
      <p className="wf-empty-body">{message}</p>
      <button type="button" className="wf-btn" style={{ marginTop: 16 }} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function useToast(): { toastEl: React.ReactNode; toast: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const toast = (text: string) => {
    setMessage(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 2500);
  };
  return {
    toastEl: message ? <div className="wf-toast" role="status">{message}</div> : null,
    toast,
  };
}

/** like/dislike 紧凑计数（"1.8M"）。 */
export { compactCount, formatSubscribers };
