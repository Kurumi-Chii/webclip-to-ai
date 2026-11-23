import { cropBounds, ocrLanguage, recognizedText } from './ocr-core.js';
import { makeOcrWorkerHandler } from './ocr-protocol.js';
let activeJob;
const notify = message => chrome.runtime.sendMessage({ target: 'ocr-background', ...message }).catch(() => {});

async function recognize(message) {
  if (activeJob) return;
  activeJob = message.jobId;
  let worker, bitmap, canvas;
  const heartbeat = setInterval(() => void notify({ type: 'ocr-progress', jobId: message.jobId }), 5000);
  const timeout = setTimeout(() => {
    void worker?.terminate();
    void notify({ type: 'ocr-failed', jobId: message.jobId });
  }, 120000);
  try {
    const image = new Image();
    image.src = message.image;
    await image.decode();
    bitmap = await createImageBitmap(image);
    image.src = '';
    const r = cropBounds(message.region, bitmap.width, bitmap.height);
    const scale = Math.min(2, Math.max(1, 1000 / Math.max(r.width, r.height)), Math.sqrt(16000000 / (r.width * r.height)));
    canvas = document.createElement('canvas');
    canvas.width = Math.round(r.width * scale); canvas.height = Math.round(r.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, r.x, r.y, r.width, r.height, 0, 0, canvas.width, canvas.height);
    bitmap.close(); bitmap = null;
    message.image = null;
    worker = await Tesseract.createWorker(ocrLanguage(message.language), 1, {
      workerPath: chrome.runtime.getURL('vendor/worker.min.js'),
      corePath: chrome.runtime.getURL('vendor/core'),
      langPath: chrome.runtime.getURL('vendor/lang'),
      workerBlobURL: false, gzip: false, cacheMethod: 'none',
      errorHandler: () => { void notify({ type: 'ocr-failed', jobId: message.jobId }); },
      logger: event => { if (event.status === 'recognizing text') void notify({ type: 'ocr-progress', jobId: message.jobId, progress: event.progress }); }
    });
    await worker.setParameters({ preserve_interword_spaces: '1' });
    const { data } = await worker.recognize(canvas);
    clearTimeout(timeout);
    await notify({ type: 'ocr-complete', jobId: message.jobId, text: recognizedText(data.text), confidence: data.confidence });
  } catch {
    await notify({ type: 'ocr-failed', jobId: message.jobId, message: '识别未完成。请缩小范围、确认语言，或重新加载扩展后重试。' });
  } finally {
    clearTimeout(timeout); clearInterval(heartbeat);
    await worker?.terminate().catch(() => {});
    bitmap?.close(); if (canvas) canvas.width = canvas.height = 0;
    activeJob = null;
    void notify({ type: 'ocr-idle', jobId: message.jobId });
  }
}
chrome.runtime.onMessage.addListener(makeOcrWorkerHandler({ runtime: chrome.runtime, currentJob: () => activeJob, recognize }));
