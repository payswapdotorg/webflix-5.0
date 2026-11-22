import { describe, expect, it } from "vitest";
import {
  CHANNEL_TOOL,
  HOME_TOOL,
  PANEL_URI,
  SEARCH_TOOL,
  SHORTS_TOOL,
  SUGGEST_TOOL,
  TRENDING_TOOL,
  WATCH_TOOL,
  WEBFLIX_PANEL_OUTPUTS,
  WEBFLIX_SERVER_NAME,
  WEBFLIX_SURFACE_ID,
} from "./contract.ts";
import { exampleFeedSummary, exampleHomeCall, exampleSearch } from "./contract.example.ts";
import { webflixPanelModule } from "./module.ts";

// 契约测试只 import contract 与 module，不知道实现是谁。
describe("webflix-panel contract", () => {
  it("declares its module manifest", () => {
    expect(webflixPanelModule.id).toBe("webflix-panel");
  });

  it("names the server, surface and resources after the plugin", () => {
    expect(WEBFLIX_SERVER_NAME).toBe("webflix");
    expect(WEBFLIX_SURFACE_ID).toBe("webflix");
    expect(PANEL_URI).toBe("ui://webflix/panel.html");
  });

  it("guarantees the build outputs the packaging lists depend on", () => {
    expect(WEBFLIX_PANEL_OUTPUTS).toEqual(["dist/server.mjs", "dist/ui/panel.html"]);
  });

  it("reports either data or an error", () => {
    expect(
      exampleFeedSummary({ data: { continueWatching: [], shorts: [], recommended: [1, 2], recommendedCursor: null, chips: ["All"] } as never }),
    ).toBe("2 recommended, 0 shorts");
    expect(exampleFeedSummary({ error: { reason: "network" } })).toBe("network");
  });

  it("names its tools in the webflix namespace", () => {
    for (const tool of [exampleHomeCall().name, exampleSearch().name, WATCH_TOOL, SHORTS_TOOL, CHANNEL_TOOL, TRENDING_TOOL, SUGGEST_TOOL]) {
      expect(tool.startsWith("webflix_")).toBe(true);
    }
    expect(HOME_TOOL).toBe("webflix_home");
  });
});
