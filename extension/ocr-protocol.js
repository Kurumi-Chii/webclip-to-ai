// Service-worker messages can omit MessageSender.url. Content scripts have
// sender.tab and must never be accepted as the trusted OCR dispatcher.
export function makeOcrWorkerHandler({ runtime, currentJob, recognize }) {
  return (message, sender, respond) => {
    if (message?.target !== 'ocr-offscreen' || sender.id !== runtime.id || sender.tab ||
        (sender.url !== undefined && sender.url !== runtime.getURL('background.js'))) return false;
    if (message.type === 'ocr-ping') { respond({ ok: true, ready: true }); return false; }
    if (message.type !== 'ocr-recognize') return false;
    const id = message.jobId;
    if (typeof id !== 'string' || !id || id.length > 100 || typeof message.image !== 'string' ||
        !message.image.startsWith('data:image/png;base64,') || message.image.length > 40000000) {
      respond({ ok: false, message: '截图数据无效或过大，请缩小范围重试。' }); return false;
    }
    const busy = currentJob();
    if (busy && busy !== id) { respond({ ok: false, message: '识字组件仍在处理另一项任务，请取消后重试。' }); return false; }
    if (!busy) {
      try { void Promise.resolve(recognize(message)).catch(() => runtime.sendMessage({ target: 'ocr-background', type: 'ocr-failed', jobId: id }).catch(() => {})); }
      catch { respond({ ok: false, message: '识字组件无法启动，请重新加载扩展。' }); return false; }
    }
    respond({ ok: true, jobId: id }); return false;
  };
}

export async function hasOcrDocument(api) {
  // getContexts is available since Chromium 116; offscreen.hasDocument needs 150.
  if (typeof api.runtime.getContexts === 'function') {
    const contexts = await api.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'], documentUrls: [api.runtime.getURL('ocr-offscreen.html')] });
    return contexts.length > 0;
  }
  if (typeof api.offscreen.hasDocument === 'function') return api.offscreen.hasDocument();
  throw new Error('浏览器不支持后台识字页面，请升级 Chrome / Edge 后重试。');
}

export async function withOcrTimeout(task, ms = 8000) {
  let timer;
  try {
    return await Promise.race([task, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('识字组件未及时确认启动。任务已停止，请重新加载扩展后重试。')), ms);
    })]);
  } finally { clearTimeout(timer); }
}
