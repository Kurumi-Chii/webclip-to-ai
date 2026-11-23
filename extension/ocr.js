import { cropBounds, ocrLanguage, recognizedText } from './ocr-core.js';
import { selectOcrRegion } from './ocr-overlay.js';
import { hasOcrDocument, withOcrTimeout } from './ocr-protocol.js';

const OFFSCREEN = 'ocr-offscreen.html';
const MAX_AGE = 180000;
export function createOcrController({ setResult, enqueueSend, pageFeedback }) {
  let starting = false;
  let messages = Promise.resolve();
  let progressAt = 0;
  function serialize(task) {
    const next = messages.then(task);
    messages = next.catch(() => {});
    return next;
  }
  const getJob = async () => (await chrome.storage.session.get('ocrJob')).ocrJob;
  const save = async job => chrome.storage.session.set({ ocrJob: job });
  const connectionKey = async config => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(config || {})))), b => b.toString(16).padStart(2, '0')).join('');
  const busy = job => job && ['selecting', 'capturing', 'recognizing', 'delivering'].includes(job.phase) && Date.now() - job.time < MAX_AGE;
  const closeWorker = async () => { if (await hasOcrDocument(chrome)) await chrome.offscreen.closeDocument(); };
  async function liveTab(job, { preparing = false } = {}) {
    const tab = await chrome.tabs.get(job.tabId);
    const [active] = await chrome.tabs.query({ active: true, windowId: job.windowId });
    const window = await chrome.windows.get(job.windowId);
    if (active?.id !== job.tabId) throw new Error('目标标签页已切换，请回到要识别的网页重新框选。已识别的文字可在插件面板手动发送。');
    if (tab.url !== job.url || tab.pendingUrl) throw new Error('网页地址已改变或正在跳转，请等待页面稳定后重新框选。已识别的文字可在插件面板手动发送。');
    // The action popup may own focus while preparing. No screenshot is taken until
    // the user drags on the page; enforce foreground focus then and before delivery.
    if (!preparing && !window.focused) throw new Error('浏览器窗口不在前台，已停止截图或自动交付。已识别的文字可在插件面板手动发送。');
    return tab;
  }
  async function fail(job, message, text = '') {
    await closeWorker().catch(() => {});
    await save({ ...job, phase: 'error' });
    await setResult({ text, title: job.title, url: job.url, status: 'error', message, ocr: true });
    await pageFeedback(job.tabId, message, 'error');
    return { ok: false, message };
  }
  async function start(tab) {
    if (starting) return { ok: false, message: '已有识字任务，请在插件面板点击「取消识字任务」后重试。' };
    starting = true;
    let job;
    try {
      if (busy(await getJob())) throw new Error('已有识字任务，请先完成，或在插件面板点击「取消识字任务」。');
      if (!Number.isInteger(tab?.id) || !/^https?:\/\//i.test(tab.url || '')) throw new Error('请在普通 HTTP / HTTPS 网页上使用框选识字。');
      const { config, ocr } = await chrome.storage.local.get(['config', 'ocr']);
      if (!config?.endpoint || (config.target === 'harness' && !config.token)) {
        await chrome.runtime.openOptionsPage();
        throw new Error('请先在接口设置中连接智能体，再使用框选识字。');
      }
      job = { id: crypto.randomUUID(), tabId: tab.id, windowId: tab.windowId, url: tab.url, title: tab.title || '', time: Date.now(), phase: 'selecting', language: ocrLanguage(ocr?.language), autoSend: ocr?.autoSend !== false };
      job.connectionKey = await connectionKey(config);
      await liveTab(job, { preparing: true });
      // A leftover worker from an interrupted job must not receive the new task.
      await closeWorker();
      await save(job);
      const [injection] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: selectOcrRegion, args: [job.id] });
      if (!injection?.documentId || !injection.result) throw new Error('无法在此页框选。请在普通网页重试；浏览器设置页和扩展商店不支持。');
      await liveTab(job, { preparing: true });
      await save({ ...job, documentId: injection.documentId, viewport: injection.result });
      return { ok: true, message: '请拖动框选图片文字，Esc 可取消。' };
    } catch (error) {
      if (job) return fail(job, error.message);
      return { ok: false, message: error.message };
    } finally { starting = false; }
  }
  async function processPageMessage(message, sender) {
    const job = await getJob();
    if (!busy(job) || job.id !== message.jobId || sender.id !== chrome.runtime.id || sender.tab?.id !== job.tabId || sender.frameId !== 0 || sender.documentId !== job.documentId || sender.url !== job.url || job.phase !== 'selecting') return { ok: false };
    if (message.type === 'ocr-cancel') { await save({ ...job, phase: 'cancelled' }); return { ok: true }; }
    try {
      cropBounds(message.region, message.region?.viewportWidth, message.region?.viewportHeight);
      if (message.region.viewportWidth !== job.viewport.viewportWidth || message.region.viewportHeight !== job.viewport.viewportHeight) throw new Error('窗口大小已改变，请重新框选。');
      await save({ ...job, phase: 'capturing' });
      await liveTab(job);
      const [{ result: view, documentId }] = await chrome.scripting.executeScript({ target: { tabId: job.tabId }, func: () => ({ width: innerWidth, height: innerHeight, x: scrollX, y: scrollY }) });
      if (documentId !== job.documentId || view.width !== message.region.viewportWidth || view.height !== message.region.viewportHeight || view.x !== message.region.scrollX || view.y !== message.region.scrollY) throw new Error('页面位置已变化，请重新框选。');
      const image = await chrome.tabs.captureVisibleTab(job.windowId, { format: 'png' });
      await liveTab(job);
      const [{ result: after, documentId: afterDocument }] = await chrome.scripting.executeScript({ target: { tabId: job.tabId }, func: () => ({ width: innerWidth, height: innerHeight, x: scrollX, y: scrollY }) });
      if (afterDocument !== job.documentId || after.width !== view.width || after.height !== view.height || after.x !== view.x || after.y !== view.y) throw new Error('截图期间页面发生变化，已丢弃截图，请重新框选。');
      await chrome.offscreen.createDocument({ url: OFFSCREEN, reasons: ['WORKERS', 'DOM_PARSER'], justification: '在本机裁剪用户主动框选的网页截图，并通过本地 OCR worker 识别文字。' });
      await save({ ...job, phase: 'recognizing' });
      await setResult({ text: '', title: job.title, url: job.url, status: 'sending', ocr: true, message: '正在启动本机识字组件…' });
      const receipt = await withOcrTimeout(chrome.runtime.sendMessage({ target: 'ocr-offscreen', type: 'ocr-recognize', jobId: job.id, region: message.region, language: job.language, image }));
      if (receipt?.ok !== true || receipt.jobId !== job.id) throw new Error(receipt?.message || '识字组件没有确认接收截图，任务已停止。请重新加载扩展后重试。');
      await setResult({ text: '', title: job.title, url: job.url, status: 'sending', ocr: true, message: '已接收截图，正在本机识别图片文字…' });
      await pageFeedback(job.tabId, '已框选截图，正在本机识别文字。可打开插件面板查看进度或取消任务。', 'sending');
      return { ok: true };
    } catch (error) { return fail(job, error.message || '无法截图，请重新框选。'); }
  }
  async function processWorkerMessage(message) {
    const job = await getJob();
    if (!job || job.id !== message.jobId) return { ok: false };
    if (message.type === 'ocr-idle') {
      await closeWorker();
      return { ok: true };
    }
    if (job.phase !== 'recognizing') return { ok: false };
    if (Date.now() - job.time >= MAX_AGE) return fail(job, '识字等待时间过长，请缩小范围后重试。');
    if (message.type === 'ocr-progress') {
      if (Date.now() - progressAt > 750) {
        progressAt = Date.now();
        const percent = Number.isFinite(message.progress) ? ` ${Math.round(Math.max(0, Math.min(1, message.progress)) * 100)}%` : '';
        await setResult({ text: '', title: job.title, url: job.url, status: 'sending', ocr: true, message: `正在本机识别图片文字${percent}…` });
      }
      return { ok: true };
    }
    if (message.type === 'ocr-failed') {
      const result = await fail(job, '识别未完成。请缩小范围、确认语言，或重新加载扩展后重试。');
      return result;
    }
    if (message.type !== 'ocr-complete') return { ok: false };
    let text = '';
    try {
      text = recognizedText(message.text);
      // Persist the claim before HTTP: duplicated completions must never deliver twice.
      await save({ ...job, phase: 'delivering' });
      if (!job.autoSend) {
        const message = '识别完成。请打开插件面板检查文字，再点击发送。';
        await setResult({ text, title: job.title, url: job.url, status: 'success', message, ocr: true });
        await save({ ...job, phase: 'done' });
        await pageFeedback(job.tabId, message, 'success');
        return { ok: true };
      }
      await liveTab(job);
      const { config } = await chrome.storage.local.get('config');
      if (await connectionKey(config) !== job.connectionKey) throw new Error('识别期间连接设置已更改，文字已保存在插件面板，请检查后手动发送。');
      const [{ documentId }] = await chrome.scripting.executeScript({ target: { tabId: job.tabId }, func: () => true });
      if (documentId !== job.documentId) throw new Error('页面已刷新，识别结果已保存在插件面板，请检查后手动发送。');
      const result = await enqueueSend({ text, title: job.title, url: job.url, ocr: true });
      await save({ ...job, phase: 'done' });
      await pageFeedback(job.tabId, result.message, result.ok ? 'success' : 'error');
      if (result.needsSetup) await chrome.runtime.openOptionsPage();
      return result;
    } catch (error) { return fail(job, error.message || '交付未完成，文字已保存在插件面板。', text); }
  }
  function onMessage(message, sender) {
    if (message?.target === 'ocr-background' && sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL(OFFSCREEN)) return serialize(() => processWorkerMessage(message));
    if (['ocr-capture', 'ocr-cancel'].includes(message?.type) && sender.id === chrome.runtime.id && sender.tab) return serialize(() => processPageMessage(message, sender));
    return undefined;
  }
  function cancel() {
    return serialize(async () => {
      const job = await getJob();
      if (!job || !['selecting', 'capturing', 'recognizing'].includes(job.phase)) return { ok: false, message: job?.phase === 'delivering' || job?.phase === 'done' ? '任务可能已交付，请先查看 dsh 草稿；取消不能撤回已写入的文字。' : '当前没有正在识别的任务，可以重新框选。' };
      await closeWorker().catch(() => {});
      await save({ ...job, phase: 'cancelled' });
      try { await chrome.scripting.executeScript({ target: { tabId: job.tabId }, func: () => globalThis.__webclipOcrOverlay?.() }); } catch { /* Navigated/protected tab. */ }
      const message = '识字任务已取消，可以重新框选。';
      await setResult({ text: '', title: job.title, url: job.url, status: 'success', ocr: true, message });
      return { ok: true, message };
    });
  }
  return { start, onMessage, cancel };
}
