const $ = id => document.getElementById(id);
import { ocrLanguage } from './ocr-core.js';
let source = { title: "", url: "" };
let activeTab;
function status(id, message, state = "success") { $(id).textContent = message; $(id).dataset.state = state; }
function showResult(result) {
  if (!result) return;
  status("sendStatus", result.message, result.status);
  if (result.ocr) status('ocrStatus', result.message, result.status);
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
async function saveOcrSettings() {
  await chrome.storage.local.set({ ocr: { language: ocrLanguage($('ocrLanguage').value), autoSend: $('ocrAutoSend').checked } });
}
$('ocrLanguage').addEventListener('change', () => void saveOcrSettings());
$('ocrAutoSend').addEventListener('change', () => void saveOcrSettings());
$('ocrCancel').addEventListener('click', async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: 'ocr-abort' });
    status('ocrStatus', result.message, result.ok ? 'success' : 'error');
    status('pageStatus', result.message, result.ok ? 'success' : 'error');
  } catch { status('ocrStatus', '取消未完成，请到扩展管理页重新加载扩展以清除旧任务。', 'error'); }
});
$('ocrStart').addEventListener('click', async () => {
  $('ocrStart').disabled = true;
  try {
    await saveOcrSettings();
    const result = await chrome.runtime.sendMessage({ type: 'ocr-start', tabId: activeTab?.id });
    if (result.ok) window.close();
    else status('pageStatus', result.message, 'error');
  } catch { status('pageStatus', '无法开始框选，请重新加载扩展后在普通网页重试。', 'error'); }
  finally { $('ocrStart').disabled = false; }
});
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
  if (area === "session" && changes.lastResult) {
    const result = changes.lastResult.newValue;
    showResult(result);
    if (result?.text && document.activeElement !== $('text')) {
      $('text').value = result.text;
      source = { title: result.title || '', url: result.url || '' };
      $('source').textContent = source.url ? `来源：${source.title || source.url}` : '手动输入的文字不附带网页来源。';
    }
  }
});
async function init() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { lastResult } = await chrome.storage.session.get("lastResult");
  if (lastResult?.text) {
    $("text").value = lastResult.text;
    source = { title: lastResult.title || "", url: lastResult.url || "" };
  }
  showResult(lastResult);
  const { config, ocr } = await chrome.storage.local.get(['config', 'ocr']);
  $('ocrLanguage').value = ocrLanguage(ocr?.language);
  $('ocrAutoSend').checked = ocr?.autoSend !== false;
  if (config?.target === "harness") $("send").textContent = "填入 Harness 当前输入框";
  if (!config?.endpoint) status("pageStatus", "尚未连接智能体。请先点击「接口设置」，填写真实接收地址并保存；示例地址不是可用接口。", "error");
  if (lastResult?.ocr) {
    $('source').textContent = source.url ? `来源：${source.title || source.url}` : '图片文字识别结果。';
    return;
  }
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
