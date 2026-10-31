// Inject only feedback text. Never pass API credentials or selected content into the page.
export function showPageFeedback(message, status) {
  const key = "__textToAgentFeedbackV1";
  const previous = globalThis[key];
  if (previous) { clearTimeout(previous.timer); previous.host.remove(); }
  const host = document.createElement("div");
  const styles = {
    all: "initial", position: "fixed", right: "20px", bottom: "20px",
    "z-index": "2147483647", display: "block", width: "min(380px, calc(100vw - 40px))"
  };
  for (const [name, value] of Object.entries(styles)) host.style.setProperty(name, value, "important");
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = `section{box-sizing:border-box;font:14px/1.6 system-ui,"Microsoft YaHei",sans-serif;background:#fff;color:#20332e;border:1px solid #a8c7b8;border-radius:12px;padding:16px;box-shadow:0 6px 30px #0003}section.error{border-color:#c98678;color:#883b2d}header{display:flex;justify-content:space-between;gap:12px;font-weight:bold}button{font:inherit;cursor:pointer;background:transparent;border:0;color:inherit;padding:0 4px}p{margin:8px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}small{display:block;margin-top:8px;color:#64746e}`;
  const section = document.createElement("section");
  section.className = status === "error" ? "error" : "";
  section.setAttribute("role", "status");
  const header = document.createElement("header");
  const title = document.createElement("span");
  title.textContent = status === "sending" ? "选文送 AI · 正在处理" : status === "error" ? "选文送 AI · 未完成" : "选文送 AI · 已完成";
  const close = document.createElement("button");
  close.textContent = "×";
  close.setAttribute("aria-label", "关闭提示");
  close.addEventListener("click", () => {
    clearTimeout(globalThis[key]?.timer);
    host.remove();
  });
  header.append(title, close);
  const body = document.createElement("p");
  body.textContent = message;
  const hint = document.createElement("small");
  hint.textContent = "点击浏览器右上角「选文送 AI」图标可查看文字与详情。";
  section.append(header, body, hint);
  shadow.append(style, section);
  document.documentElement.append(host);
  globalThis[key] = { host, timer: setTimeout(() => host.remove(), status === "error" ? 45000 : status === "sending" ? 25000 : 10000) };
}
