const $ = id => document.getElementById(id);
let source = { title: "", url: "" };
let activeTab;
function status(id, message, state = "success") { $(id).textContent = message; $(id).dataset.state = state; }
function showResult(result) {
  if (!result) return;
  status("sendStatus", result.message, result.status);
  $("reply").textContent = result.reply || "";
  $("response").hidden = !result.reply;
}
$("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
async function changePage(enabled) {
  try {
    const result = await chrome.runtime.sendMessage({ type: "unlock", tabId: activeTab?.id, enabled });
    status("pageStatus", result.message, result.ok ? "success" : "error");
  } catch { status("pageStatus", "操作未完成，请重新打开插件面板后重试。", "error"); }
}
$("unlock").addEventListener("click", () => changePage(true));
$("restore").addEventListener("click", () => changePage(false));
$("send").addEventListener("click", async () => {
  if (!$("text").value.trim()) { status("sendStatus", "请先输入要发送的文字。", "error"); return; }
  $("send").disabled = true;
  status("sendStatus", "正在发送…", "sending");
  try {
    const result = await chrome.runtime.sendMessage({ type: "send", payload: { text: $("text").value, ...source } });
    status("sendStatus", result.message, result.ok ? "success" : "error");
    showResult((await chrome.storage.session.get("lastResult")).lastResult);
    if (result.needsSetup) await chrome.runtime.openOptionsPage();
  } catch { status("sendStatus", "发送状态未知，请查看智能体后再决定是否重发。", "error"); }
  finally { $("send").disabled = false; }
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.lastResult) showResult(changes.lastResult.newValue);
});
async function init() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { lastResult } = await chrome.storage.session.get("lastResult");
  if (lastResult?.text) {
    $("text").value = lastResult.text;
    source = { title: lastResult.title || "", url: lastResult.url || "" };
  }
  showResult(lastResult);
  const { config } = await chrome.storage.local.get("config");
  if (config?.target === "harness") $("send").textContent = "填入 Harness 当前输入框";
  if (!config?.endpoint) status("pageStatus", "尚未连接智能体。请先点击「接口设置」，填写真实接收地址并保存；示例地址不是可用接口。", "error");
  // Read selection only after the user opens this extension, never in the background.
  try {
    const selections = await chrome.scripting.executeScript({ target: { tabId: activeTab.id, allFrames: true }, func: () => {
      const focused = document.activeElement;
      if (focused?.tagName === "TEXTAREA" || (focused?.tagName === "INPUT" && ["text", "search", "url", "tel"].includes(focused.type))) {
        return { text: focused.value.slice(focused.selectionStart ?? 0, focused.selectionEnd ?? 0), title: document.title, url: location.href };
      }
      return { text: window.getSelection()?.toString() || "", title: document.title, url: location.href };
    } });
    const selected = selections.find(item => item.result?.text?.trim())?.result;
    if (selected) { $("text").value = selected.text; source = { title: selected.title, url: selected.url }; }
  } catch { /* Internal pages can still use the manual send field. */ }
  $("source").textContent = source.url ? `来源：${source.title || source.url}` : "手动输入的文字不附带网页来源。";
}
void init().catch(() => status("pageStatus", "无法读取当前页；仍可手动输入文字发送。", "error"));
