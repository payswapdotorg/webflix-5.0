import { mountApp } from "./app.tsx";

// 面板入口：连接宿主（ext-apps），挂载 WebFlix 界面。宿主不可达时给出诚实的提示。
const root = document.getElementById("root");
if (root) {
  mountApp(root).catch((error: Error) => {
    root.innerHTML = `<div class="wf-error-box" role="alert">
      <p class="wf-empty-title">WebFlix could not connect</p>
      <p class="wf-empty-body">This panel needs the ZCode workspace host (open it from the WebFlix surface). ${error.message}</p>
    </div>`;
  });
}
