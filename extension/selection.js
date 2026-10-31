// Runs only after an explicit context-menu action, in the clicked frame's isolated world.
export function readPageSelection() {
  const focused = document.activeElement;
  if (focused?.tagName === "TEXTAREA" || (focused?.tagName === "INPUT" && ["text", "search", "url", "tel"].includes(focused.type))) {
    return focused.value.slice(focused.selectionStart ?? 0, focused.selectionEnd ?? 0);
  }
  return window.getSelection()?.toString() || "";
}

export function reconcileSelection(nativeText, pageText) {
  const original = typeof nativeText === "string" ? nativeText : "";
  if (typeof pageText !== "string" || !pageText.trim()) return original;
  const folded = value => value.replace(/\s+/gu, " ").trim();
  // A page changing its selection while the native menu is open must not change the submitted words.
  return folded(pageText) === folded(original) ? pageText : original;
}
