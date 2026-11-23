// Runs only in the isolated world after an explicit shortcut/menu/button invocation.
export function selectOcrRegion(jobId) {
  const key = '__webclipOcrOverlay';
  globalThis[key]?.();
  const host = document.createElement('div');
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `:host{color-scheme:light} *{box-sizing:border-box} .veil{position:fixed;inset:0;cursor:crosshair;background:rgba(0,0,0,.15);touch-action:none;user-select:none} .box{position:fixed;pointer-events:none;border:2px solid #79e0b6;background:rgba(255,255,255,.07)} .hint{position:fixed;top:18px;left:50%;transform:translateX(-50%);background:#163e32;color:white;padding:12px 18px;border-radius:10px;font:15px/1.5 system-ui,sans-serif;pointer-events:none;max-width:90vw;white-space:nowrap}`;
  const veil = document.createElement('div'), box = document.createElement('div'), hint = document.createElement('div');
  veil.className = 'veil'; box.className = 'box'; box.hidden = true; hint.className = 'hint';
  hint.textContent = '拖动框选图片文字 · Esc 取消 · 松开后本机识别并交付';
  shadow.append(style, veil, box, hint);
  document.documentElement.append(host);
  let start, finished = false;
  const viewport = { viewportWidth: innerWidth, viewportHeight: innerHeight, scrollX, scrollY };
  function cleanup() {
    finished = true; host.remove(); clearTimeout(timer);
    window.removeEventListener('keydown', keydown, true);
    window.removeEventListener('resize', cancel, true);
    window.removeEventListener('scroll', cancel, true);
    window.removeEventListener('blur', windowBlur, true);
    if (globalThis[key] === cancel) delete globalThis[key];
  }
  function cancel() {
    if (finished) return;
    cleanup(); void chrome.runtime.sendMessage({ type: 'ocr-cancel', jobId }).catch(() => {});
  }
  function keydown(event) {
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); cancel(); }
  }
  function windowBlur(event) {
    // Captured blur from a webpage input is not a browser-window focus change.
    if (event.target === window) cancel();
  }
  const point = event => ({ x: Math.max(0, Math.min(innerWidth, event.clientX)), y: Math.max(0, Math.min(innerHeight, event.clientY)) });
  const rectangle = end => ({ x: Math.min(start.x, end.x), y: Math.min(start.y, end.y), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y), ...viewport });
  veil.addEventListener('pointerdown', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.button !== 0) return;
    start = point(event); veil.setPointerCapture(event.pointerId);
    box.hidden = false;
    Object.assign(box.style, { left: `${start.x}px`, top: `${start.y}px`, width: '0px', height: '0px' });
  }, true);
  veil.addEventListener('pointermove', event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!start) return;
    const r = rectangle(point(event));
    Object.assign(box.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.width}px`, height: `${r.height}px` });
  }, true);
  veil.addEventListener('pointerup', async event => {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!start || finished || event.button !== 0) return;
    const region = rectangle(point(event));
    cleanup();
    // Let the compositor remove the overlay before captureVisibleTab.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 80));
    try { await chrome.runtime.sendMessage({ type: 'ocr-capture', jobId, region }); } catch { /* Toolbar retains last state. */ }
  }, true);
  veil.addEventListener('contextmenu', event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  veil.addEventListener('pointercancel', cancel, true);
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('resize', cancel, true);
  window.addEventListener('scroll', cancel, true);
  window.addEventListener('blur', windowBlur, true);
  const timer = setTimeout(cancel, 60000);
  globalThis[key] = cancel;
  return { viewportWidth: innerWidth, viewportHeight: innerHeight };
}
