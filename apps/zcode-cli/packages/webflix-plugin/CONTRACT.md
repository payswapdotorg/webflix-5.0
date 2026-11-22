# WebFlix 插件契约（不变量）

WebFlix（`apps/zcode-cli/packages/webflix-plugin/`）是 ZCode 官方工作区插件：把 WebFlix 2.0
（`payswapdotorg/webflix-2.0`，YouTube-clone 界面基线）渲染成 ZCode 桌面工作区的会话侧栏
面板。沿 payswap-plugin（见 plugin-creator `references/payswap-reference-pattern.md`）与
zcode-site-plugin 的既有模式，逐条列出不变量；改代码前先读这里。

## 界面纪律

- 面板**渲染得与 WebFlix 2.0 一致**：AppShell（固定 56px topbar、可折叠 sidebar、滚动主列）、
  首页交错行编排（6 长 → Shorts → 3 长 → Shorts → 6 长 → continue-watching → growing grid）、
  观察页双栏、Shorts 9:16 纵向流、Trending 排名行、频道页 banner+tabs。间距、圆角、字号与
  徽标值从源组件的 Tailwind 类逐项换算（`src/ui/panel.html` 内注释标注对应关系）。
- 主题 token 逐字移植自 WebFlix 2.0 的 `src/app/globals.css`（dark 默认 + light 切换）。
- 没有 host 时（独立打开 panel.html）显示诚实的连接提示，不渲染假数据。

## 数据纪律

- 数据全部来自 `src/data.ts` 静态快照：videoId / 标题 / 频道（名称、handle、认证标）经
  YouTube oEmbed 逐条校验；缩略图指向 `i.ytimg.com` 官方 CDN。
- 观看数 / 点赞 / 时长 / 发布时间 / 评论是**演示快照值**（WebFlix 2.0 的 `prisma/seed.ts`
  同一做法）；面板对它们按 WebFlix 的展示格式渲染，不声称是实时数据。
- server 零网络、零文件系统读取（panel.html 除外）、零凭据 —— `test/webflix.test.mjs`
  机械校验快照不含凭据形状的内容。
- 面板数据一律经 `callServerTool` 走插件 server；工具是 app-only（宿主不放进模型工具表，
  与 zcode-site 面板同律），全部 `readOnlyHint`。

## 面板资源与 CSP

- 唯一资源 `ui://webflix/panel.html`，MIME `text/html;profile=mcp-app`，
  `_meta.ui.csp` 声明 `resourceDomains: ["https://i.ytimg.com"]`（缩略图）与
  `frameDomains: ["https://www.youtube-nocookie.com", "https://www.youtube.com"]`
  （观看页 / Shorts 的官方播放器内嵌）。无 `connect-src`：面板不自行联网。
- 路由状态经宿主扩展 `ui/set-widget-state` 保存（zcode-site 面板同律），重开恢复。

## 构建与生命周期

- 构建 = esbuild：`src/server/main.ts` → `dist/server.mjs`（node24 esm 自包含），
  `src/ui/main.tsx` → IIFE 内联进 `dist/ui/panel.html`（`scripts/build.mjs`）。
- `WEBFLIX_PANEL_OUTPUTS = ["dist/server.mjs", "dist/ui/panel.html"]`；
  官方插件定义的 `requiredSeedPaths`、`prepare-agent-node-bundle.mjs` 的
  `requiredRuntimePaths` 与 `build-desktop-agent-cli.mjs` 的 `artifactPath` 都按它对齐 ——
  缺任一项都会 seed 出「能看到面板入口却启动不了 MCP server」的残缺插件。
- 入口契约：`src/server/main.ts` 导出 `main()`，SIGTERM/SIGINT/stdin-end 时关闭。
