import http from "node:http";
import { randomUUID, timingSafeEqual } from "node:crypto";

export async function startReceiver({ token, port = 18766, timeoutMs = 12000 }) {
  if (typeof token !== "string" || token.length < 32) throw new Error("A local pairing token is required.");
  const pending = new Map();
  let active;
  let closed = false;
  const reply = (res, status, data) => {
    if (res.destroyed || res.writableEnded) return;
    const body = JSON.stringify(data);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  };
  function finish(id, status, message, inserted = false) {
    const ticket = pending.get(id);
    if (!ticket) return;
    clearTimeout(ticket.timer);
    pending.delete(id);
    reply(ticket.res, status, { inserted, message, sessionId: ticket.sessionId });
  }
  function authenticated(req) {
    const expected = Buffer.from(`Bearer ${token}`);
    const supplied = Buffer.from(req.headers.authorization || "");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  }
  const server = http.createServer(async (req, res) => {
    // A literal loopback authority avoids DNS rebinding; bearer authentication also blocks web forms.
    if (req.headers.host !== `127.0.0.1:${server.address()?.port}`) return reply(res, 403, { message: "主机地址不匹配。" });
    const origin = req.headers.origin;
    if (origin && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) return reply(res, 403, { message: "不接受网页直接提交。" });
    if (!authenticated(req)) return reply(res, 401, { message: "本地配对码不匹配，请在浏览器设置中重新导入当前 Harness 的 connection.json 并保存。" });
    if (req.url === "/health" && req.method === "GET") return reply(res, 200, { app: "harness-webclip", ready: !!active && Date.now() - active.time < 6000 });
    if (req.url !== "/receive" || req.method !== "POST") return reply(res, 404, { message: "接口不存在。" });
    if (req.headers["content-type"]?.split(";")[0].trim() !== "application/json") return reply(res, 415, { message: "请使用 JSON 请求。" });
    try {
      let bytes = 0;
      const chunks = [];
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 2000000) { reply(res, 413, { message: "文字过长。" }); req.destroy(); return; }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (typeof data?.text !== "string" || !data.text.trim() || data.text.length > 100000) return reply(res, 400, { message: "文字为空或超过 100,000 字符。" });
      if (closed || !active || Date.now() - active.time >= 6000 || !active.sessionId) return reply(res, 409, { message: "请先在 DeepSeek Harness 中打开要接收文字的普通会话，保持输入框可编辑，再重试。" });
      if (pending.size >= 8) return reply(res, 429, { message: "待接收文字较多，请稍后重试。" });
      const id = randomUUID();
      const ticket = { id, text: data.text, sessionId: active.sessionId, clientId: active.clientId, deadline: Date.now() + timeoutMs, res };
      ticket.timer = setTimeout(() => finish(id, 504, "未能及时确认输入框写入结果。请检查 Harness 草稿，避免重复插入。"), timeoutMs);
      pending.set(id, ticket);
      res.once("close", () => { clearTimeout(ticket.timer); pending.delete(id); });
    } catch { reply(res, 400, { message: "请求内容不是有效 JSON。" }); }
  });
  server.headersTimeout = 5000;
  server.requestTimeout = 10000;
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return {
    server,
    poll(data) {
      if (typeof data?.clientId !== "string" || data.clientId.length > 100) return {};
      if (typeof data.sessionId === "string" && data.sessionId.length < 200) active = { clientId: data.clientId, sessionId: data.sessionId, time: Date.now() };
      else if (active?.clientId === data.clientId) active = undefined;
      for (const ticket of pending.values()) {
        if (ticket.clientId !== data.clientId) continue;
        if (ticket.sessionId !== data.sessionId) { finish(ticket.id, 409, "接收时会话已切换，文字没有插入，请在目标会话重新操作。"); continue; }
        if (ticket.deadline <= Date.now()) continue;
        return { id: ticket.id, text: ticket.text, sessionId: ticket.sessionId, deadline: ticket.deadline };
      }
      return {};
    },
    ack(data) {
      const ticket = pending.get(data?.id);
      if (!ticket || ticket.clientId !== data.clientId || ticket.sessionId !== data.sessionId) return { accepted: false };
      if (data.inserted === true) finish(ticket.id, 200, "已填入 DeepSeek Harness 当前会话输入框，请手动点击发送。", true);
      else finish(ticket.id, 409, "Harness 输入框状态已变化或暂不可编辑，文字没有插入。请回到目标会话后重试。");
      return { accepted: true };
    },
    async close() {
      closed = true;
      for (const id of [...pending.keys()]) finish(id, 503, "Harness 接收插件已停止，文字没有确认写入。");
      await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
    }
  };
}
