import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createWebflixServer } from "./server.ts";

// 官方插件宿主通过导出的 main 启动；导入时直接连接会被宿主判定为无效入口。
export async function main(): Promise<void> {
  const dist = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = join(dist, "..");
  const manifest = JSON.parse(
    await readFile(join(pluginRoot, ".zcode-plugin", "plugin.json"), "utf8"),
  ) as { version: string };

  const server = createWebflixServer({
    version: manifest.version,
    panelPath: join(dist, "ui", "panel.html"),
  });

  let stopping = false;
  const close = () => {
    if (stopping) return;
    stopping = true;
    void server.close();
  };
  process.once("SIGTERM", close);
  process.once("SIGINT", close);
  process.stdin.once("end", close);
  await server.connect(new StdioServerTransport());
}

// 保留独立 Node 进程直接启动的用法（plugin.json 的 mcpServers 声明 node dist/server.mjs，
// 宿主按 stdio 子进程拉起 —— 与 zcode-site-plugin 的 server/main.ts 同律）。
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
