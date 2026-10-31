export const SELECT_CSS = `*, *::before, *::after { -webkit-user-select: text !important; user-select: text !important; -webkit-touch-callout: default !important; }`;

// Runs in the extension's isolated world; never receives endpoint settings or credentials.
export function setPageUnlock(enabled) {
  const key = "__textToAgentUnlockV1";
  const events = ["contextmenu", "selectstart", "copy"];
  if (globalThis[key]) {
    for (const event of events) window.removeEventListener(event, globalThis[key], true);
    delete globalThis[key];
  }
  if (enabled) {
    const allowNative = event => event.stopImmediatePropagation();
    for (const event of events) window.addEventListener(event, allowNative, true);
    globalThis[key] = allowNative;
  }
  return { enabled };
}
