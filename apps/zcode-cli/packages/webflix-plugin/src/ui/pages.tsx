/**
 * WebFlix 面板页面 —— HomeFeed / WatchPage / SearchPage / ShortsPage / TrendingPage /
 * ChannelPage，结构对应 WebFlix 2.0 的同名视图（首页交错行编排、观看页双栏、
 * Shorts 9:16 纵向流、Trending 排名行、频道页 banner+tabs）。
 */
import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Scissors,
  Share2,
  ListPlus,
  ThumbsDown,
  ThumbsUp,
  Download,
  Flame,
  Filter,
} from "lucide-react";
import type { Route } from "./host.ts";
import type { Navigate } from "./views.tsx";
import {
  Avatar,
  CategoryChips,
  ContinueRail,
  EmptyState,
  ErrorBox,
  HomeSkeleton,
  ShelfScroller,
  ShortsShelf,
  SiteFooter,
  VideoCard,
  VerifiedBadge,
} from "./views.tsx";
import {
  compactCount,
  displayPublished,
  displayViews,
  formatDuration as displayDuration,
  formatSubscribers,
} from "./format.ts";
import {
  RECOMMENDED_PAGE_SIZE,
  type ChannelPageDTO,
  type CommentDTO,
  type HomeFeedDTO,
  type SearchResultsDTO,
  type ShortsDTO,
  type TrendingDTO,
  type VideoDTO,
  type WatchDTO,
} from "../contract.ts";

/** home feed 的交错编排（与 WebFlix 的 operator 指令一致）：6 长 → Shorts → 3 长 → Shorts → 6 长 → continue → growing grid。 */
const FIRST_BLOCK_END = 6;
const MID_BLOCK_END = 9;
const LAST_BLOCK_END = 15;

type Host = { call<T>(tool: string, args: Record<string, unknown>): Promise<{ data?: T; error?: { reason: string; message?: string } }> };

function useTool<T>(tool: string | null, args: Record<string, unknown>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    if (!tool) return;
    let cancelled = false;
    setData(null);
    setError(null);
    const host = window.__webflixHost;
    if (!host) return;
    void host
      .call<T>(tool, args)
      .then((result) => {
        if (cancelled) return;
        if (result.data) setData(result.data);
        else setError(result.error?.message ?? result.error?.reason ?? "bad_response");
      })
      .catch(() => !cancelled && setError("network"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, ...deps, reloadKey]);
  return { data, error, reload: () => setReloadKey((k) => k + 1) };
}

/* ---------------------------------- home ---------------------------------- */

export function HomeFeed({ navigate, toast, category, onCategory }: {
  navigate: Navigate;
  toast: (m: string) => void;
  category: string;
  onCategory: (chip: string) => void;
}) {
  const { data, error, reload } = useTool<HomeFeedDTO>("webflix_home", { category }, [category]);
  const [more, setMore] = useState<VideoDTO[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMore([]);
    setCursor(data?.recommendedCursor ?? null);
  }, [data]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !cursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingMore) return;
        setLoadingMore(true);
        const host = window.__webflixHost;
        if (!host) return;
        void host
          .call<{ videos: VideoDTO[]; nextCursor: string | null }>("webflix_home", { category, cursor })
          .then((result) => {
            if (result.data) {
              const seen = new Set([...(data?.recommended ?? []), ...more].map((v) => v.id));
              setMore((prev) => [...prev, ...result.data!.videos.filter((v) => !seen.has(v.id))]);
              setCursor(result.data.nextCursor);
            }
          })
          .finally(() => setLoadingMore(false));
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cursor, loadingMore, category, data, more]);

  const showShorts = category === "All";
  const shorts = data?.shorts ?? [];
  const shortsMid = Math.ceil(shorts.length / 2);
  const firstShorts = showShorts ? shorts.slice(0, shortsMid) : [];
  const secondShorts = showShorts ? shorts.slice(shortsMid) : [];
  const recommended = data?.recommended ?? [];
  const opening = showShorts
    ? [...recommended.slice(0, FIRST_BLOCK_END), ...recommended.slice(FIRST_BLOCK_END, MID_BLOCK_END), ...recommended.slice(MID_BLOCK_END, LAST_BLOCK_END)]
    : recommended.slice(0, LAST_BLOCK_END);
  const grid = (videos: VideoDTO[], extra = "") => (
    <div className={`wf-grid ${extra}`} data-testid="recommended-grid">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} navigate={navigate} toast={toast} />
      ))}
    </div>
  );

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <HomeSkeleton />;
  if (recommended.length === 0 && data.continueWatching.length === 0 && (!showShorts || shorts.length === 0)) {
    return (
      <>
        <CategoryChips chips={data.chips} active={category} onPick={onCategory} />
        <EmptyState
          title={category === "All" ? "No feed yet" : `Nothing in ${category} yet`}
          body={category === "All" ? "The snapshot feed is empty — try search in the meantime." : "Check the other categories — the snapshot carries Music, Coding, Tech, Gaming and more."}
        />
      </>
    );
  }

  return (
    <div style={{ paddingBottom: 16 }}>
      <CategoryChips chips={data.chips} active={category} onPick={onCategory} />
      {showShorts ? (
        <>
          {grid(opening.slice(0, FIRST_BLOCK_END))}
          <ShortsShelf shorts={firstShorts} navigate={navigate} />
          {grid(opening.slice(FIRST_BLOCK_END, MID_BLOCK_END), "wf-spacer-4")}
          <ShortsShelf shorts={secondShorts} navigate={navigate} />
          {grid(opening.slice(MID_BLOCK_END), "wf-spacer-4")}
        </>
      ) : (
        grid(opening)
      )}
      <ContinueRail videos={data.continueWatching} navigate={navigate} toast={toast} />
      {more.length > 0 && <div className="wf-spacer-4">{grid(more)}</div>}
      {cursor && (
        <div ref={sentinelRef} data-testid="infinite-scroll-sentinel" style={{ height: 4 }} aria-hidden="true" />
      )}
      {loadingMore && <div className="wf-loading">Loading more…</div>}
    </div>
  );
}

/* ---------------------------------- watch ---------------------------------- */

function CommentRow({ comment, toast }: { comment: CommentDTO; toast: (m: string) => void }) {
  return (
    <div className="wf-comment">
      <Avatar name={comment.author} size={40} />
      <div className="wf-comment-body">
        <div className="wf-comment-head">
          <span className="wf-comment-author">{comment.author}</span>
          <span>{comment.publishedText}</span>
          {comment.pinned && <span className="wf-pin">Pinned by creator</span>}
        </div>
        <p className="wf-comment-text">{comment.text}</p>
        <div className="wf-comment-actions">
          <button aria-label="Like comment" onClick={() => toast("Comment liked (workspace snapshot)")}>
            <ThumbsUp width="14" height="14" /> {compactCount(comment.likes)}
          </button>
          <button aria-label="Dislike comment" onClick={() => toast("Comment disliked (workspace snapshot)")}>
            <ThumbsDown width="14" height="14" />
          </button>
          <button onClick={() => toast("Replies are read-only in the workspace snapshot")}>Reply</button>
          {comment.replies > 0 && (
            <button style={{ color: "#3ea6ff" }} onClick={() => toast("Replies are read-only in the workspace snapshot")}>
              {comment.replies} replies
            </button>
          )}
          {comment.hearted && (
            <span className="wf-pin" title="Loved by creator" aria-label="Loved by creator">
              <ThumbsUp width="13" height="13" style={{ color: "var(--yt-red)" }} /> ❤
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function WatchPage({ videoId, navigate, toast }: { videoId: string; navigate: Navigate; toast: (m: string) => void }) {
  const { data, error, reload } = useTool<WatchDTO>("webflix_watch", { videoId }, [videoId]);
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState<"up" | "down" | null>(null);
  const [subscribed, setSubscribed] = useState(false);

  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <div className="wf-loading">Loading watch page…</div>;
  const { video, comments, related, subscribers } = data;

  return (
    <div className="wf-watch">
      <div className="wf-watch-primary">
        <div className="wf-player">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&modestbranding=1`}
            title={video.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <h1 className="wf-watch-title">{video.title}</h1>
        <div className="wf-watch-row">
          <div className="wf-watch-channel">
            <Avatar name={video.channel.name} size={40} />
            <span style={{ minWidth: 0 }}>
              <a className="wf-watch-channel-name" onClick={() => navigate({ page: "channel", handle: video.channel.handle })}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{video.channel.name}</span>
                {video.channel.verified && <VerifiedBadge />}
              </a>
              <span className="wf-watch-channel-subs">{formatSubscribers(subscribers)}</span>
            </span>
          </div>
          <button
            className={`wf-btn ${subscribed ? "" : "wf-btn-primary"}`}
            onClick={() => {
              setSubscribed((v) => !v);
              toast(subscribed ? "Unsubscribed (workspace snapshot)" : `Subscribed to ${video.channel.name}`);
            }}
          >
            {subscribed ? "Subscribed" : "Subscribe"}
          </button>
          <span className="wf-likes">
            <button aria-label="Like this video" onClick={() => setLiked(liked === "up" ? null : "up")}>
              <ThumbsUp style={{ fill: liked === "up" ? "currentColor" : "none" }} />
              {compactCount(video.likes + (liked === "up" ? 1 : 0))}
            </button>
            <span className="wf-likes-sep" />
            <button aria-label="Dislike this video" onClick={() => setLiked(liked === "down" ? null : "down")}>
              <ThumbsDown style={{ fill: liked === "down" ? "currentColor" : "none" }} />
            </button>
          </span>
          <button className="wf-btn" onClick={() => toast("Link copied (workspace snapshot)")}>
            <Share2 /> Share
          </button>
          <button className="wf-btn" onClick={() => toast("Saved to Watch later (workspace snapshot)")}>
            <ListPlus /> Save
          </button>
          <button className="wf-btn wf-btn-ghost" aria-label="More actions" onClick={() => toast("Clip / Download / Report are not part of the workspace snapshot")}>
            <MoreHorizontal />
          </button>
        </div>
        <div className="wf-desc" data-expanded={expanded}>
          <span className="wf-desc-meta">
            {displayViews(video)} · {displayPublished(video)}
            {video.category ? ` · #${video.category.toLowerCase()}` : ""}
          </span>
          <p className="wf-desc-text">{video.description}</p>
          <button className="wf-desc-more" onClick={() => setExpanded((v) => !v)}>
            {expanded ? "Show less" : "…more"}
          </button>
        </div>
        <section className="wf-comments" aria-label="Comments">
          <h2 className="wf-comments-count">{comments.length} Comments</h2>
          <div style={{ display: "flex", gap: 12 }}>
            <Avatar name="You" size={40} />
            <input
              className="wf-search-input"
              style={{ flex: 1, borderBottom: "1px solid var(--border)", borderRadius: 0, paddingLeft: 0 }}
              placeholder="Add a comment…"
              aria-label="Add a comment"
              onFocus={() => toast("Comments are read-only in the workspace snapshot")}
            />
          </div>
          {comments.map((comment) => (
            <CommentRow key={comment.id} comment={comment} toast={toast} />
          ))}
        </section>
      </div>
      <aside className="wf-watch-rail" aria-label="Related videos">
        {related.map((rel) => (
          <RelatedCard key={rel.id} video={rel} navigate={navigate} />
        ))}
      </aside>
    </div>
  );
}

function RelatedCard({ video, navigate }: { video: VideoDTO; navigate: Navigate }) {
  return (
    <a className="wf-related-card" onClick={() => navigate({ page: "watch", videoId: video.id })}>
      <span className="wf-thumb">
        <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
        {video.durationSec !== null && <span className="wf-duration">{displayDuration(video.durationSec)}</span>}
      </span>
      <span className="wf-related-body">
        <span className="wf-related-title">{video.title}</span>
        <span className="wf-related-meta">{video.channel.name}</span>
        <span className="wf-related-meta">
          {displayViews(video)}
          {displayPublished(video) ? ` · ${displayPublished(video)}` : ""}
        </span>
      </span>
    </a>
  );
}

/* ---------------------------------- search ---------------------------------- */

export function SearchPage({ query, navigate, toast }: { query: string; navigate: Navigate; toast: (m: string) => void }) {
  const { data, error, reload } = useTool<SearchResultsDTO>(query ? "webflix_search" : null, { q: query }, [query]);
  return (
    <div className="wf-searchpage">
      <div className="wf-filters">
        <Filter /> Filters
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!error && !data && <div className="wf-loading">Searching…</div>}
      {data?.channels.map((channel) => (
        <div key={channel.id} className="wf-channel-result">
          <Avatar name={channel.name} size={88} />
          <span style={{ minWidth: 0 }}>
            <span className="wf-watch-channel-name">
              {channel.name} {channel.verified && <VerifiedBadge />}
            </span>
            <span className="wf-related-meta" style={{ display: "block" }}>@{channel.handle}</span>
            <span className="wf-related-meta" style={{ display: "block" }}>
              {formatSubscribers(channel.subscribers)} · {channel.videoCount} video{channel.videoCount === 1 ? "" : "s"}
            </span>
          </span>
          <button className="wf-btn wf-btn-primary" style={{ marginLeft: "auto" }} onClick={() => toast("Subscribed (workspace snapshot)")}>
            Subscribe
          </button>
        </div>
      ))}
      {data?.videos.map((video) => (
        <div key={video.id} className="wf-result">
          <a className="wf-thumb" onClick={() => navigate({ page: "watch", videoId: video.id })}>
            <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
            {video.durationSec !== null && <span className="wf-duration">{displayDuration(video.durationSec)}</span>}
            {video.isLive && <span className="wf-livebadge">Live</span>}
          </a>
          <div style={{ minWidth: 0, flex: 1 }}>
            <a className="wf-card-title" style={{ fontSize: 16 }} onClick={() => navigate({ page: "watch", videoId: video.id })}>
              {video.title}
            </a>
            <p className="wf-related-meta" style={{ marginTop: 4 }}>
              {displayViews(video)} · {displayPublished(video)}
            </p>
            <a className="wf-card-channel" style={{ marginTop: 8 }} onClick={() => navigate({ page: "channel", handle: video.channel.handle })}>
              <Avatar name={video.channel.name} size={24} />
              <span>{video.channel.name}</span>
              {video.channel.verified && <VerifiedBadge />}
            </a>
          </div>
        </div>
      ))}
      {data && data.videos.length === 0 && data.channels.length === 0 && (
        <EmptyState title="No results found" body={`Nothing in the workspace snapshot matches “${query}”. Try another search.`} />
      )}
    </div>
  );
}

/* ---------------------------------- shorts page ---------------------------------- */

/** 源组件 shorts-engagement-rail 的 RailAction：48px 圆钮 bg-black/30 + 底部计数。 */
function RailAction({ label, count, onClick, children }: {
  label: string;
  count: string | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="wf-rail-action">
      <button type="button" aria-label={label} onClick={onClick}>
        {children}
      </button>
      {count !== null && <span className="wf-rail-action-label" aria-hidden="true">{count}</span>}
    </span>
  );
}

export function ShortsPage({ toast }: { toast: (m: string) => void }) {
  const { data, error, reload } = useTool<ShortsDTO>("webflix_shorts", {}, []);
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <div className="wf-loading">Loading Shorts…</div>;
  return (
    // 源组件 shorts-feed-shell：snap-y snap-mandatory 纵向流，每个 short 占满
    // topbar 以下的视口高度；播放列 9:16 居中，动作栏与渐变信息层叠在播放列内。
    <div className="wf-shortspage" aria-label="Shorts feed">
      {data.shorts.map((short) => (
        <div key={short.id} className="wf-short-item">
          <div className="wf-short-playercol">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${short.id}?rel=0&modestbranding=1`}
              title={short.title}
              loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
            {/* 底部渐变信息层（源 shorts-feed：channel 行 + 标题 + 观看数，右让位动作栏） */}
            <div className="wf-short-overlay">
              <div style={{ minWidth: 0, paddingRight: 64 }}>
                <a
                  className="wf-short-overlay-channel"
                  aria-label={`Go to ${short.channel.name}`}
                  onClick={() => toast(`Channel pages open from the home feed — @${short.channel.handle}`)}
                >
                  <Avatar name={short.channel.name} size={32} />
                  <span className="wf-short-overlay-channel-name wf-truncate">{short.channel.name}</span>
                </a>
                <p className="wf-short-overlay-title">{short.title}</p>
                <p className="wf-short-overlay-views">{displayViews(short)}</p>
              </div>
            </div>
            {/* 动作栏（源 shorts-engagement-rail：absolute bottom-16 right-3） */}
            <div className="wf-short-rail">
              <RailAction label="Like this short" count={compactCount(short.likes)} onClick={() => toast("Liked (workspace snapshot)")}>
                <ThumbsUp aria-hidden="true" />
              </RailAction>
              <RailAction label="Dislike this short" count={null} onClick={() => toast("Disliked (workspace snapshot)")}>
                <ThumbsDown aria-hidden="true" />
              </RailAction>
              <RailAction label="Share this short" count="Share" onClick={() => toast("Link copied (workspace snapshot)")}>
                <Share2 aria-hidden="true" />
              </RailAction>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- trending ---------------------------------- */

export function TrendingPage({ navigate, toast }: { navigate: Navigate; toast: (m: string) => void }) {
  const [tab, setTab] = useState("Now");
  const { data, error, reload } = useTool<TrendingDTO>("webflix_trending", { category: tab }, [tab]);
  return (
    <div className="wf-trending">
      {/* 源组件 trending/view：h1 px-4 py-4 text-xl font-bold sm:px-6 sm:text-2xl（Flame size-7 红） */}
      <h1 style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 24, fontWeight: 700, padding: "16px 0" }}>
        <Flame style={{ color: "var(--yt-red)" }} width="28" height="28" aria-hidden="true" /> Trending
      </h1>
      <div className="wf-tabs" role="tablist" aria-label="Trending categories">
        {(data?.categories ?? ["Now"]).map((category) => (
          <button key={category} role="tab" className="wf-chip" data-active={category === tab} onClick={() => setTab(category)}>
            {category}
          </button>
        ))}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {!error && !data && <div className="wf-loading">Loading trending…</div>}
      {data?.videos.map((video, index) => (
        <div key={video.id} className="wf-trend-row">
          <span className="wf-trend-rank">{index + 1}</span>
          <a className="wf-thumb" onClick={() => navigate({ page: "watch", videoId: video.id })}>
            <img src={video.thumbnailUrl} alt={video.title} loading="lazy" />
            {video.durationSec !== null && <span className="wf-duration">{displayDuration(video.durationSec)}</span>}
          </a>
          <div className="wf-trend-body">
            <a className="wf-card-title" style={{ fontSize: 15 }} onClick={() => navigate({ page: "watch", videoId: video.id })}>
              {video.title}
            </a>
            <a className="wf-card-channel" style={{ marginTop: 4 }} onClick={() => navigate({ page: "channel", handle: video.channel.handle })}>
              {video.channel.name} {video.channel.verified && <VerifiedBadge />}
            </a>
            <p className="wf-card-views">
              {displayViews(video)} · {displayPublished(video)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- channel page ---------------------------------- */

export function ChannelPage({ handle, navigate, toast }: { handle: string; navigate: Navigate; toast: (m: string) => void }) {
  const { data, error, reload } = useTool<ChannelPageDTO>("webflix_channel", { handle }, [handle]);
  const [tab, setTab] = useState("Videos");
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  if (!data) return <div className="wf-loading">Loading channel…</div>;
  const { channel, videos } = data;
  return (
    <div className="wf-channel">
      <div className="wf-channel-banner" role="presentation" />
      <div className="wf-channel-head">
        <Avatar name={channel.name} size={128} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1 className="wf-channel-name">
            {channel.name} {channel.verified && <VerifiedBadge />}
          </h1>
          <p className="wf-channel-meta">
            @{channel.handle} · {formatSubscribers(channel.subscribers)} · {channel.videoCount} video{channel.videoCount === 1 ? "" : "s"}
          </p>
          <p className="wf-channel-meta" style={{ marginTop: 4, maxWidth: 640 }}>{channel.description}</p>
        </div>
        <button className="wf-btn wf-btn-primary" onClick={() => toast(`Subscribed to ${channel.name} (workspace snapshot)`)}>
          Subscribe
        </button>
      </div>
      <div className="wf-channel-tabs" role="tablist" aria-label="Channel sections">
        {["Videos", "Shorts", "Playlists", "About"].map((section) => (
          <button key={section} role="tab" className="wf-channel-tab" data-active={section === tab} onClick={() => setTab(section)}>
            {section}
          </button>
        ))}
      </div>
      {tab === "Shorts" ? (
        <ShelfScroller label="Channel shorts">
          {videos.filter((v) => v.isShort).map((short) => (
            <a key={short.id} className="wf-shortstile" onClick={() => navigate({ page: "shorts" })}>
              <span className="wf-thumb">
                <img src={short.thumbnailUrl} alt={short.title} loading="lazy" />
              </span>
              <p className="wf-shortstile-title">{short.title}</p>
              <p className="wf-shortstile-views">{displayViews(short)}</p>
            </a>
          ))}
        </ShelfScroller>
      ) : tab === "About" ? (
        <p className="wf-channel-meta" style={{ padding: "8px 0" }}>{channel.description}</p>
      ) : (
        <div className="wf-grid">
          {videos
            .filter((v) => (tab === "Videos" ? !v.isShort : v.isShort))
            .map((video) => (
              <VideoCard key={video.id} video={video} navigate={navigate} toast={toast} />
            ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- explore + placeholder ---------------------------------- */

export function ExplorePage({ navigate }: { navigate: Navigate }) {
  const tiles = ["Music", "Gaming", "Live", "News", "Sports", "Coding", "Tech", "Education", "Travel", "Cooking", "Fitness", "Comedy", "Mixes", "Podcasts"];
  return (
    <div style={{ padding: 16, maxWidth: 1096, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, margin: "8px 0 16px" }}>Explore</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 16 }}>
        {tiles.map((tile) => (
          <button key={tile} className="wf-btn" style={{ justifyContent: "center", padding: "40px 14px", fontSize: 16 }} onClick={() => navigate({ page: "search", q: tile })}>
            {tile}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <>
      <h1 className="wf-page-title">{title}</h1>
      <EmptyState
        title={`${title} is not part of the workspace snapshot`}
        body="The WebFlix workspace snapshot carries the home feed, Shorts, search, watch pages, trending and channels. This surface stays honest instead of faking content."
      />
      <SiteFooter />
    </>
  );
}
