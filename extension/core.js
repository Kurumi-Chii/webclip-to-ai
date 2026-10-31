export const DEFAULT_CONFIG = {
  endpoint: "",
  token: "",
  headers: "{}",
  template: JSON.stringify({ text: "{{text}}", source: { title: "{{title}}", url: "{{url}}" } }, null, 2)
};
export const MAX_TEXT = 100000;

export function endpointInfo(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("请填写完整的接口地址，例如 https://example.com/api/receive。"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error("接口地址需要使用 HTTP / HTTPS，且不能包含用户名、密码或 # 片段。");
  }
  // Chrome match patterns do not scope permissions to an individual TCP port.
  return { endpoint: url.href, origin: `${url.protocol}//${url.hostname}/*` };
}

function parseObject(source, label) {
  let result;
  try { result = JSON.parse(source); } catch { throw new Error(`${label}必须是有效的 JSON。`); }
  if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error(`${label}必须是 JSON 对象。`);
  return result;
}

export function validateConfig(raw) {
  const cfg = { ...DEFAULT_CONFIG, ...raw };
  cfg.endpoint = endpointInfo(String(cfg.endpoint).trim()).endpoint;
  cfg.token = String(cfg.token || "").trim();
  if (cfg.target === "harness" && !cfg.token) throw new Error("请先导入 Harness 的本机配对文件，再保存连接。");
  if (/[\r\n]/.test(cfg.token)) throw new Error("Token 不能包含换行。");
  const extra = parseObject(cfg.headers, "自定义请求头");
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(extra)) {
    if (typeof value !== "string") throw new Error("请求头的值必须是字符串。");
    if (/^(host|cookie|origin|referer|content-length|connection|content-type|accept-encoding|sec-.+|proxy-.+)$/i.test(key)) {
      throw new Error(`不支持设置请求头 ${key}。插件固定发送 application/json。`);
    }
    try { headers.set(key, value); } catch { throw new Error("请求头名称或值无效，请检查格式。"); }
  }
  if (cfg.token) {
    if (headers.has("Authorization")) throw new Error("Bearer Token 与自定义 Authorization 请求头只需填写一个。");
    try { headers.set("Authorization", `Bearer ${cfg.token}`); } catch { throw new Error("Token 格式无效。"); }
  }
  const template = parseObject(cfg.template, "请求模板");
  if (!JSON.stringify(template).includes("{{text}}")) throw new Error("请求模板至少需要包含一个 {{text}} 占位符。");
  return cfg;
}

// Substitute string values after parsing JSON, so quotes, newlines, and backslashes stay literal.
export function renderTemplate(source, values) {
  const visit = value => {
    if (typeof value === "string") return value.replace(/\{\{(text|title|url)\}\}/g, (_, key) => values[key] ?? "");
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, visit(v)]));
    return value;
  };
  return visit(parseObject(source, "请求模板"));
}

export function makeRequest(raw, payload) {
  const cfg = validateConfig(raw);
  if (typeof payload.text !== "string" || !payload.text.trim()) throw new Error("请先选中文字，或在插件面板中输入文字。");
  if (payload.text.length > MAX_TEXT) throw new Error("单次最多发送 100,000 个字符，请分段发送。");
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const [key, value] of Object.entries(JSON.parse(cfg.headers))) headers.set(key, value);
  if (cfg.token) headers.set("Authorization", `Bearer ${cfg.token}`);
  return {
    url: cfg.endpoint,
    init: {
      method: "POST", headers, credentials: "omit", redirect: "error", cache: "no-store",
      body: JSON.stringify(renderTemplate(cfg.template, { text: payload.text, title: payload.title || "", url: payload.url || "" }))
    }
  };
}
