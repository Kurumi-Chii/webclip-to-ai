import { DEFAULT_CONFIG, makeRequest, endpointInfo } from "./core.js";
import { SELECT_CSS, setPageUnlock } from "./unlock.js";
import { showPageFeedback } from "./feedback.js";
import { readPageSelection, reconcileSelection } from "./selection.js";

const MENU_SEND = "send-selection-to-agent";
const MENU_UNLOCK = "allow-selection-and-context-menu";
const extensionRoot = chrome.runtime.getURL("");
let sendQueue = Promise.resolve();
function enqueueSend(payload) {
  const task = sendQueue.then(() => sendPayload(payload));
  sendQueue = task.catch(() => {});
  return task;
}

// Keep credentials unavailable to future content scripts as well as webpages.
void chrome.storage.local.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });
void chrome.storage.session.setAccessLevel({ accessLevel: "TRUSTED_CONTEXTS" });

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_SEND, title: "发送选中文字到 AI 智能体", contexts: ["selection"] });
    chrome.contextMenus.create({ id: MENU_UNLOCK, title: "允许此页选择文本与右键", contexts: ["page", "selection"] });
  });
});

async function setResult(result) {
  await chrome.storage.session.set({ lastResult: { ...result, time: Date.now() } });
  const labels = { sending: "…", success: "✓", error: "!" };
  await chrome.action.setBadgeText({ text: labels[result.status] || "" });
  await chrome.action.setBadgeBackgroundColor({ color: result.status === "error" ? "#B54735" : "#286757" });
  await chrome.action.setTitle({ title: `选文送 AI：${result.message}` });
}

async function readPreview(response, limit = 8000) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let result = "";
  try {
    while (result.length <= limit) {
      const { done, value } = await reader.read();
      if (done) return result + decoder.decode();
      result += decoder.decode(value, { stream: true });
    }
    return result.slice(0, limit) + "\n（回复较长，仅显示前 8,000 字符）";
  } finally { await reader.cancel().catch(() => {}); }
}

export async function sendPayload(payload) {
  const safe = { text: String(payload.text || "").slice(0, 100001), title: String(payload.title || ""), url: String(payload.url || "") };
  await setResult({ ...safe, status: "sending", message: "正在发送…" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let needsSetup = false;
  let harness = false;
  try {
    const { config } = await chrome.storage.local.get("config");
    harness = config?.target === "harness";
    if (!config?.endpoint) {
      needsSetup = true;
      throw new Error("还没有连接智能体：请填写真实接收接口并保存。示例地址不是可用接口。文字已暂存在插件面板，配置后可重新发送。");
    }
    if (harness && !config.token) {
      needsSetup = true;
      throw new Error("请先导入 Harness 本机配对文件并保存连接。");
    }
    const request = makeRequest({ ...DEFAULT_CONFIG, ...config }, safe);
    const allowed = await chrome.permissions.contains({ origins: [endpointInfo(request.url).origin] });
    if (!allowed) {
      needsSetup = true;
      throw new Error("接口访问权限尚未授权或已撤销，请在接口设置中重新保存并授权。");
    }
    const response = await fetch(request.url, { ...request.init, signal: controller.signal });
    if (harness) {
      let receipt;
      try { receipt = JSON.parse(await readPreview(response)); } catch { throw new Error("本地接收器的回复格式不匹配，请确认安装的是配套 Harness 接收插件。"); }
      if (!response.ok || receipt.inserted !== true) throw new Error(typeof receipt.message === "string" ? receipt.message.slice(0, 1000) : "Harness 尚未确认文字已写入输入框。");
      const message = "已填入 DeepSeek Harness 当前会话输入框，请手动点击发送。";
      await setResult({ ...safe, status: "success", message, reply: JSON.stringify(receipt, null, 2) });
      return { ok: true, message };
    }
    // Do not record failed response bodies: servers sometimes echo credentials in errors.
    if (!response.ok) throw new Error(`接口返回 HTTP ${response.status}。请检查地址、认证信息和请求模板；本插件不会自动重发。`);
    const reply = await readPreview(response);
    await setResult({ ...safe, status: "success", message: `接口已接收（HTTP ${response.status}）`, reply });
    return { ok: true, message: "接口已接收。" };
  } catch (error) {
    let message = error instanceof TypeError
      ? harness ? "无法连接 DeepSeek Harness 接收插件。请先在 Harness 安装并启用配套接收插件，保持 Harness 运行并打开目标会话。" : "连接失败。请检查接口是否运行、地址是否正确，或是否存在证书、网络、重定向限制。"
      : error.message || "发送失败。";
    if (controller.signal.aborted) message = "等待超过 20 秒。接口可能已收到文字，请先查看智能体，再决定是否重发。";
    await setResult({ ...safe, status: "error", message, needsSetup });
    return { ok: false, message, needsSetup };
  } finally { clearTimeout(timer); }
}

async function pageFeedback(tabId, message, status) {
  if (!Number.isInteger(tabId)) return;
  try {
    await chrome.scripting.executeScript({ target: { tabId }, func: showPageFeedback, args: [message, status] });
  } catch { /* Protected pages retain the toolbar badge and the stored result. */ }
}

export async function handleSelection(info, tab) {
  let text = info.selectionText || "";
  if (Number.isInteger(tab?.id)) {
    try {
      const frameId = Number.isInteger(info.frameId) && info.frameId >= 0 ? info.frameId : 0;
      const results = await chrome.scripting.executeScript({ target: { tabId: tab.id, frameIds: [frameId] }, func: readPageSelection });
      text = reconcileSelection(text, results[0]?.result);
    } catch { /* Restricted pages retain the explicit native-menu selection as a fallback. */ }
  }
  await pageFeedback(tab?.id, "正在提交选中文字，请稍候…", "sending");
  try {
    const result = await enqueueSend({ text, title: tab?.title || "", url: info.frameUrl || info.pageUrl || tab?.url || "" });
    await pageFeedback(tab?.id, result.message, result.ok ? "success" : "error");
    if (result.needsSetup) await chrome.runtime.openOptionsPage();
    return result;
  } catch {
    const message = "发送流程未完成。请打开插件面板查看状态；若面板无法打开，请到扩展管理页查看错误。";
    await pageFeedback(tab?.id, message, "error");
    return { ok: false, message };
  }
}

export async function unlockTab(tabId, enabled = true) {
  if (!Number.isInteger(tabId)) throw new Error("请先打开一个普通网页。");
  const apply = async target => {
    // Remove an earlier insertion before enabling again; repeated clicks remain reversible.
    await chrome.scripting.removeCSS({ target, css: SELECT_CSS, origin: "USER" });
    if (enabled) await chrome.scripting.insertCSS({ target, css: SELECT_CSS, origin: "USER" });
    await chrome.scripting.executeScript({ target, func: setPageUnlock, args: [enabled] });
  };
  try { await apply({ tabId, allFrames: true }); }
  catch {
    try { await apply({ tabId }); }
    catch { throw new Error("此页无法操作。请在普通 HTTP / HTTPS 网页使用；浏览器设置页、扩展商店和部分内嵌页面不支持。"); }
  }
  return { ok: true, message: enabled ? "已允许选择与右键。关闭面板后拖动选字，再右键发送；刷新页面可恢复。" : "已恢复网页原有的选择与右键行为。" };
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_SEND) {
    return handleSelection(info, tab);
  }
  if (info.menuItemId === MENU_UNLOCK) {
    void unlockTab(tab?.id).catch(error => setResult({ status: "error", message: error.message }));
  }
});

// Sequential sends avoid accidental simultaneous requests and confusing status updates.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(extensionRoot)) return false;
  let task;
  if (message?.type === "send") {
    task = enqueueSend(message.payload || {});
  } else if (message?.type === "unlock") task = unlockTab(message.tabId, message.enabled !== false);
  else return false;
  task.then(respond, error => respond({ ok: false, message: error.message || "操作失败。" }));
  return true;
});
