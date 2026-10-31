window.__ModuleLoader__.load({
  id: "@local/harness-webclip",
  factory: () => {
    function apply(ctx) {
      ctx.effect(() => {
        let disposed = false;
        let timer;
        let controller;
        const clientId = globalThis.crypto.randomUUID();
        const delivered = new Set();
        async function api(method, data) {
          const response = await fetch(`api/local-webclip/${method}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data), signal: controller.signal
          });
          if (!response.ok) throw new Error(`Harness browser receiver: HTTP ${response.status}`);
          return response.json();
        }
        async function poll() {
          controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          try {
            const current = ctx.uiSession.current.getSnapshot();
            const actions = current.props?.inputActions;
            const input = current.hooks?.input?.getSnapshot();
            const desktop = ["dsh-app:", "file:"].includes(globalThis.location.protocol);
            const eligible = desktop && typeof current.key === "string" && input?.phase === "plain" && actions?.captureInsertion && actions?.insertText;
            const sessionId = eligible ? current.key : null;
            // Capture the revision before awaiting transport; a changed draft is never overwritten.
            const span = eligible ? actions.captureInsertion() : null;
            const item = await api("poll", { clientId, sessionId });
            if (disposed || !item.id) return;
            let inserted = delivered.has(item.id);
            if (!inserted && Date.now() < item.deadline && eligible && item.sessionId === current.key && ctx.uiSession.current.getSnapshot().key === current.key) {
              const prefix = input.draft ? "\n\n" : "";
              // Collapse an existing selection so the user's selected draft text is preserved.
              inserted = actions.insertText(prefix + item.text, { ...span, start: span.end }) === true;
              if (inserted) {
                delivered.add(item.id);
                if (delivered.size > 256) delivered.delete(delivered.values().next().value);
                actions.persistDraft?.();
              }
            }
            await api("ack", { clientId, sessionId: item.sessionId, id: item.id, inserted });
          } catch { /* A disconnected Host is retried; no text is inserted without a current ticket. */ }
          finally {
            clearTimeout(timeout);
            if (!disposed) timer = setTimeout(poll, 750);
          }
        }
        void poll();
        return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
      });
    }
    return { name: "local-harness-webclip", inject: ["uiSession", "connection"], apply };
  }
});
