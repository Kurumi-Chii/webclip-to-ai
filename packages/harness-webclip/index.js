import { startReceiver } from "./bridge.js";
import { loadConnection } from "./pairing.js";

export const name = "local-harness-webclip";
export const inject = ["connection"];

export function apply(ctx) {
  ctx.effect(async () => {
    const pairing = await loadConnection();
    const receiver = await startReceiver(pairing);
    console.info(`[webclip-to-ai] Local browser pairing file: ${pairing.file}`);
    try {
      for (const method of ["poll", "ack"]) ctx.connection.fetch.register({
        path: `/api/local-webclip/${method}`, methods: ["POST"], requestBody: "buffered",
        async fetch(request) {
          try { return Response.json(receiver[method](await request.json()), { headers: { "Cache-Control": "no-store" } }); }
          catch { return Response.json({ error: "invalid_request" }, { status: 400 }); }
        }
      });
    } catch (error) { await receiver.close(); throw error; }
    return () => receiver.close();
  });
}
