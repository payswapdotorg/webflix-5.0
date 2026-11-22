# WebFlix 视频工作区

WebFlix 工作区是官方插件 `webflix` 自带的 UI plugin（MCP Apps）：把 WebFlix 2.0
（[payswapdotorg/webflix-2.0](https://github.com/payswapdotorg/webflix-2.0)，YouTube-clone
界面基线）的界面渲染成 ZCode 会话侧栏里的视频工作区 —— 首页信息流、Shorts、搜索、观看页、
Trending 与频道页。本仓库沿用 payswap-4.0 的「叠加不改主应用」模式：zai-org/zcode 的内容
一件不删，WebFlix 以独立插件包 + 少量登记点接入（见「登记」）。

宿主不为面板加 WebFlix 专属代码，也不改共享协议：面板只用现有的 MCP Apps 能力。

渲染证据（1440×900，真实 MCP server 数据路径）：[evidence/](evidence/) ——
home / watch / shorts / trending / search / channel 六个面。

## 结构

```text
面板页面 ──callServerTool──▶ 插件 MCP server ──▶ 静态快照数据集（src/data.ts，零网络）
```

| 部分       | 位置                                                                       | 说明                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| MCP server | `apps/zcode-cli/packages/webflix-plugin/src/server` → `dist/server.mjs`    | stdio，`isolation: "workspace"`，无鉴权（只读快照）；`main()` 导出 + 直跑护栏（`node dist/server.mjs` 自启动，与 zcode-site 同律） |
| 面板页面   | `src/ui` → `dist/ui/panel.html`                                           | 资源 `ui://webflix/panel.html`，官方 `@modelcontextprotocol/ext-apps` + React、lucide-react，脚本内联进页面；视觉照 WebFlix 2.0 组件移植 |
| 数据集     | `src/data.ts`                                                              | oEmbed 逐条校验的快照（标题/频道/缩略图真实，指标为演示值）                                                                              |
| 清单       | `.zcode-plugin/plugin.json`                                                | `mcpServers.webflix`；`ui.surfaces: [{id: "webflix", server: "webflix", resourceUri: "ui://webflix/panel.html", availability: "session"}]` |
| 构建       | `scripts/build.mjs`（esbuild）                                             | server 与 panel 同 zcode-site-plugin 的构建形状                                                            |
| 登记       | `official-plugin-definitions.ts`、`plugin-marketplaces.ts` 与两份打包清单   | `componentTypes: ["ui"]`、默认开启；`requiredSeedPaths` 带两个 dist 产物；桌面包与 dev agent 的运行时构建登记                              |

- **模型不可见**：工具全部声明 `_meta.ui.visibility: ["app"]`，不进入模型的工具列表；
  server 不返回 `instructions`。面板经 `callServerTool` 调用。
- **零网络 server**：数据全部来自静态快照；唯一的文件系统读取是面板页面本身。
- **CSP**：面板资源 `_meta.ui.csp` 声明 `resourceDomains: ["https://i.ytimg.com"]`
  （缩略图）与 `frameDomains: ["https://www.youtube-nocookie.com", "https://www.youtube.com"]`
  （观看页 / Shorts 内嵌官方播放器）；无 `connect-src` —— 面板不自行联网。

## 工具（全部只读、app-only）

| 工具               | 参数                        | 返回                                                                       |
| ------------------ | --------------------------- | -------------------------------------------------------------------------- |
| `webflix_home`     | `{category?, cursor?}`      | 首页信息流（chips、recommended、shorts、continueWatching、分页 cursor）    |
| `webflix_search`   | `{q}`                       | 视频结果 + 频道结果                                                        |
| `webflix_watch`    | `{videoId}`                 | 视频详情 + 订阅数 + 评论 + 相关推荐                                        |
| `webflix_shorts`   | `{}`                        | 纵向 Shorts 列表                                                           |
| `webflix_channel`  | `{handle}`                  | 频道页（订阅数、简介、视频）                                               |
| `webflix_trending` | `{category?}`               | 按观看数排序的榜单 + 类别 tabs                                             |
| `webflix_suggest`  | `{q}`                       | 搜索框自动补全                                                             |

工具结果统一信封：`{data}` 或 `{error: {reason, message?}}`；面板对错误渲染重试态，
不吞错。

## 数据纪律

- videoId / 标题 / 频道（名称、handle、认证标）经 YouTube oEmbed 逐条校验后内嵌；
  缩略图指向 `i.ytimg.com` 官方 CDN（WebFlix 2.0 生产同源）。
- 观看数 / 点赞 / 时长 / 发布时间 / 评论是演示快照值 —— WebFlix 2.0 的 `prisma/seed.ts`
  同一做法；`test/webflix.test.mjs` 机械校验数据集不含凭据形状的内容。
- 侧栏的 Netflix / TikTok / WebFlix LIVE / You 区入口保留（与 WebFlix 2.0 的 guide 一致），
  快照未携带的面渲染诚实的空态，不伪造内容。

## 面板界面（对齐 WebFlix 2.0）

- **AppShell**：固定 56px topbar（logo、搜索、语音、创建、通知、主题切换、账号）、可折叠
  sidebar（240px ↔ 72px）、滚动主列 + 吸底 footer。
- **首页**：类别 chips + 交错行编排（6 长 → Shorts → 3 长 → Shorts → 6 长 →
  continue-watching → growing grid），无限滚动分页（`webflix_home` cursor）；
  网格 **3 列封顶**（源组件 `lg:grid-cols-3`，operator 指令 "3 fit in one row"）。
- **观看页**：官方播放器内嵌 + 标题 + 频道行（订阅按钮）+ 点赞胶囊 + 分享/保存 +
  可展开简介 + 评论（置顶/红心/回复数）+ 相关推荐栏（缩略图 160px、`rounded-md`、
  卡片 `p-1` + hover `bg-secondary/40`，源 `related-rail` 逐项对应）。
- **Shorts**：`snap-y snap-mandatory` 纵向流（每张幻灯 h-full、max-w-480px 居中）；
  播放列 9:16；**动作栏叠在播放列内**（`absolute bottom-16 right-3`，48px 圆钮
  `bg-black/30 backdrop-blur`，源 `shorts-engagement-rail`）；底部渐变信息层
  （`from-black/70 via-black/25`，channel 行 + 标题 + 观看数）。
- **Trending**：全宽容器、Flame 红图标 + 排名行（rank `w-8`、缩略图 `sm:w-[240px]`）+ 类别 tabs。
- **频道页**：全幅 `bg-secondary` banner（`h-28 sm:h-36 lg:h-44`，源组件无圆角无外边距）、
  avatar、tabs（Videos/Shorts/Playlists/About）、`gap-y-8` + `2xl:grid-cols-4` 网格。
- **主题**：dark 默认（WebFlix 基线）+ light 切换；token 逐字移植自 WebFlix 2.0 的
  `globals.css`。
- **路由**：hash 路由 + 宿主 `ui/set-widget-state` 保存（zcode-site 面板同律），重开恢复。

## 与 payswap-4.0 的关系

payswap-4.0 是 zai-org/zcode 的 fork，叠加了 `docs/payswap`、`scripts/payswap`、
`packages/*/src/payswap` 与 `apps/zcode-cli/packages/payswap-plugin`（349 增 / 95 改 / 0 删）。
本仓库同一模式：zcode 内容零删改（除下述登记点），WebFlix 全部增量落在
`apps/zcode-cli/packages/webflix-plugin/` 与 `docs/webflix/`：

1. `apps/zcode-cli/packages/bootstrap/src/app/official-plugin-definitions.ts` —— `webflix` 定义。
2. `packages/shared/src/plugin-marketplaces.ts` —— 默认启用名单（与定义机械对照）。
3. `packages/desktop/scripts/prepare-agent-node-bundle.mjs` + `scripts/build-desktop-agent-cli.mjs`
   —— 生产桌面包与 dev agent 的插件 runtime 登记。
4. `architecture-policy.yaml` + `scripts/engineering-test-files.json` —— 模块与工程测试登记。
