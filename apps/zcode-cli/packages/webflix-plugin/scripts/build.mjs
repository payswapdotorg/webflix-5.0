import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 把插件 MCP server 和面板页面构建到 dist/：server.mjs 自包含（运行时不读 node_modules），
// 面板脚本内联进 panel.html（体积远低于宿主单次读资源的上限，不用分片）。
// 与 zcode-site-plugin 的 scripts/build.mjs 同一形状（WebFlix 面板是纯快照数据面板，
// 不走网络，故无 licenses 聚合步骤）。
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "ui"), { recursive: true });

const server = await build({
  metafile: true,
  entryPoints: [join(root, "src/server/main.ts")],
  outfile: join(dist, "server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node24",
  legalComments: "none",
  banner: {
    js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);',
  },
});

const panel = await build({
  metafile: true,
  entryPoints: [join(root, "src/ui/main.tsx")],
  jsx: "automatic",
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  write: false,
});
const html = (await readFile(join(root, "src/ui/panel.html"), "utf8")).replace(
  "/*__SCRIPT__*/",
  () => panel.outputFiles[0].text.replaceAll("</script", "<\\/script"),
);
await writeFile(join(dist, "ui", "panel.html"), html);

const kb = (path) => `${(path.length / 1024).toFixed(0)} KB`;
console.log(`server.mjs: ${server.outputFiles?.length ?? 1} file(s)`);
console.log(`panel.html: ${kb(html)}`);
