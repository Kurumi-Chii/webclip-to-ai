import { endpointInfo } from "./core.js";

export function parsePairingFile(source) {
  let data;
  try { data = JSON.parse(source); } catch { throw new Error("配对文件不是有效 JSON。"); }
  if (data?.app !== "webclip-to-ai" || data.version !== 1) throw new Error("请选择 Harness 接收插件生成的 connection.json。");
  const info = endpointInfo(data.endpoint);
  const url = new URL(info.endpoint);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/receive" || url.search) {
    throw new Error("Harness 配对文件必须指向本机 127.0.0.1 的 /receive 地址。");
  }
  if (typeof data.token !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(data.token)) throw new Error("配对码无效，请重新选择 Harness 生成的文件。");
  return { endpoint: info.endpoint, token: data.token };
}
