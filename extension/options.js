import { DEFAULT_CONFIG, endpointInfo, validateConfig } from "./core.js";
import { HARNESS_PRESET } from "./harness-preset.js";
import { parsePairingFile } from "./pairing.js";
const $ = id => document.getElementById(id);
const fields = ["endpoint", "token", "template", "headers"];
let target = "generic";
let pairing;
function status(message, state = "success") { $("status").textContent = message; $("status").dataset.state = state; }
const loaded = chrome.storage.local.get("config").then(({ config }) => {
  const value = { ...DEFAULT_CONFIG, ...config };
  for (const key of fields) $(key).value = value[key];
  target = config?.target || "generic";
  if (target === "harness" && config?.token) pairing = { endpoint: config.endpoint, token: config.token };
  $("connectionStatus").textContent = config?.endpoint
    ? "已保存接收地址。可点击下方「发送测试文本」检查连接。"
    : "尚未连接智能体。请填写你自己的接收 API 地址；浅色示例只是提示，不会接收文字。配置完成前，右键选中的文字不会发送到智能体。";
  $("connectionStatus").dataset.state = config?.endpoint ? "success" : "error";
});
$("endpoint").addEventListener("input", () => { target = "generic"; });
$("harness").addEventListener("click", () => {
  if (!pairing) { status("请先选择 Harness 接收插件生成的 connection.json 配对文件。", "error"); return; }
  for (const key of fields) $(key).value = { ...HARNESS_PRESET, ...pairing }[key];
  target = "harness";
  $("configForm").requestSubmit();
});
$("pairingFile").addEventListener("change", async () => {
  try {
    const file = $("pairingFile").files[0];
    if (!file) return;
    if (file.size > 16384) throw new Error("文件过大，请选择 connection.json 配对文件。");
    pairing = parsePairingFile(await file.text());
    for (const key of fields) $(key).value = { ...HARNESS_PRESET, ...pairing }[key];
    target = "harness";
    status("配对文件已在本机读取。请点击「保存 Harness 本地连接」并授权本机地址。");
  } catch (error) { pairing = undefined; status(error.message, "error"); }
});
void chrome.storage.session.get("lastResult").then(({ lastResult }) => {
  if (lastResult?.needsSetup && lastResult.text) status("上次选中的文字已暂存。保存接口后，请打开插件面板点击「发送这段文字」。");
}).catch(() => {});
$("configForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const cfg = validateConfig({ ...Object.fromEntries(fields.map(key => [key, $(key).value])), target });
    // Request immediately inside the submit gesture, before any await.
    const granting = chrome.permissions.request({ origins: [endpointInfo(cfg.endpoint).origin] });
    $("save").disabled = true;
    const granted = await granting;
    if (!granted) throw new Error("未获得接口访问权限，配置没有保存。请重新点击保存并允许访问。");
    await chrome.storage.local.set({ config: cfg });
    $("connectionStatus").textContent = "已保存接收地址。请发送测试文本检查连接；保存配置不会自动发送之前的文字。";
    $("connectionStatus").dataset.state = "success";
    status(target === "harness" ? "Harness 本地连接已保存。先在 Harness 打开目标会话，再返回网页右键交给智能体。测试文本也只填入草稿，不会自动发送给 AI。" : "配置已保存。可以发送测试文本，或返回网页选字发送。");
  } catch (error) { status(error.message || "配置未保存。", "error"); }
  finally { $("save").disabled = false; }
});
$("test").addEventListener("click", async () => {
  $("test").disabled = true;
  status("正在使用已保存配置发送测试文本…", "sending");
  try {
    const result = await chrome.runtime.sendMessage({ type: "send", payload: { text: "这是一条来自「选文送 AI」的连接测试消息。", title: "选文送 AI · 连接测试", url: "" } });
    status(result.message, result.ok ? "success" : "error");
  } catch { status("测试状态未知，请检查接收端再决定是否重发。", "error"); }
  finally { $("test").disabled = false; }
});
void loaded.catch(() => status("设置读取失败，请重新打开此页。", "error"));
