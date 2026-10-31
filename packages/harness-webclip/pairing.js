import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

export async function loadConnection({ home = process.env.DSH_HOME || path.join(homedir(), ".dsh"), port = 18766 } = {}) {
  const directory = path.resolve(home, "webclip-to-ai");
  const file = path.join(directory, "connection.json");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  try {
    await writeFile(file, JSON.stringify({
      app: "webclip-to-ai", version: 1,
      endpoint: `http://127.0.0.1:${port}/receive`,
      token: randomBytes(32).toString("base64url")
    }, null, 2) + "\n", { flag: "wx", mode: 0o600 });
  } catch (error) { if (error.code !== "EEXIST") throw error; }
  const data = JSON.parse(await readFile(file, "utf8"));
  const url = new URL(data.endpoint);
  const effectivePort = Number(url.port || 80);
  if (data.app !== "webclip-to-ai" || data.version !== 1 || typeof data.token !== "string" || !/^[A-Za-z0-9_-]{43,128}$/.test(data.token)
    || url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.pathname !== "/receive" || url.search || url.hash || url.username || url.password
    || !Number.isInteger(effectivePort) || effectivePort < 1 || effectivePort > 65535) {
    throw new Error("Invalid local connection.json. Back it up and regenerate it; it was not overwritten.");
  }
  return { file, token: data.token, port: effectivePort };
}
