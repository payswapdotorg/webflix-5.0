// webflix 插件的机械校验（node --test）：清单 ↔ 契约 ↔ 构建产物三方一致，
// 不需要实现细节 —— payswap-reference-pattern.md 的 "contract tests read the manifest
// and pin outputs mechanically" 一条。
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  await readFile(join(root, ".zcode-plugin", "plugin.json"), "utf8"),
);

test("manifest names the plugin webflix with one ui surface", () => {
  assert.equal(manifest.name, "webflix");
  assert.equal(manifest.ui.surfaces.length, 1);
  const surface = manifest.ui.surfaces[0];
  assert.equal(surface.id, "webflix");
  assert.equal(surface.server, "webflix");
  assert.equal(surface.resourceUri, "ui://webflix/panel.html");
  assert.equal(surface.availability, "session");
  assert.equal(surface.title["en-US"], "WebFlix");
  assert.equal(surface.title["zh-CN"], "WebFlix 视频工作区");
});

test("manifest declares the stdio server that the surface points at", () => {
  const server = manifest.mcpServers.webflix;
  assert.equal(server.type, "stdio");
  assert.equal(server.command, "node");
  assert.deepEqual(server.args, ["${ZCODE_PLUGIN_ROOT}/dist/server.mjs"]);
  assert.equal(server.isolation, "workspace");
});

test("contract outputs and manifest stay in the version triangle", async () => {
  const contract = await readFile(join(root, "src", "contract.ts"), "utf8");
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  assert.match(contract, /WEBFLIX_PANEL_OUTPUTS = \["dist\/server\.mjs", "dist\/ui\/panel\.html"\]/);
  assert.equal(manifest.version, pkg.version);
});

test("snapshot dataset only carries verified https thumbnails", async () => {
  const data = await readFile(join(root, "src", "data.ts"), "utf8");
  const thumbs = [...data.matchAll(/thumbnailUrl: "(https:\/\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(thumbs.length >= 50, `expected a full snapshot, got ${thumbs.length}`);
  for (const url of thumbs) {
    assert.ok(url.startsWith("https://i.ytimg.com/vi/"), `non-CDN thumbnail: ${url}`);
  }
  // 数据纪律：不携带任何凭据或 token 形状的内容。
  for (const banned of [/sk-/, /ghp_/, /napi_/, /Bearer /]) {
    assert.doesNotMatch(data, banned);
  }
});
