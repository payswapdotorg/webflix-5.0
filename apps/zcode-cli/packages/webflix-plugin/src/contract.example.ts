/**
 * webflix-panel 标准用法示例：面板读首页信息流、处理失败，以及搜索工具的参数。
 */
import { HOME_TOOL, SEARCH_TOOL, type HomeFeedDTO, type WebflixResult } from "./contract.ts";

/** 工具结果解析后要么是 data，要么是错误原因。 */
export function exampleFeedSummary(result: WebflixResult<HomeFeedDTO>): string {
  if ("data" in result) return `${result.data.recommended.length} recommended, ${result.data.shorts.length} shorts`;
  return result.error.reason;
}

export function exampleSearch(): { name: typeof SEARCH_TOOL; arguments: { q: string } } {
  return { name: SEARCH_TOOL, arguments: { q: "lofi" } };
}

export function exampleHomeCall(): { name: typeof HOME_TOOL; arguments: { category: string } } {
  return { name: HOME_TOOL, arguments: { category: "All" } };
}
