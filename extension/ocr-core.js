export const OCR_LANGUAGES = Object.freeze({
  'chi_sim+eng': '简体中文 + English',
  'chi_tra+eng': '繁體中文 + English',
  'jpn+eng': '日本語 + English',
  eng: 'English'
});
export function ocrLanguage(value) {
  return Object.hasOwn(OCR_LANGUAGES, value) ? value : 'chi_sim+eng';
}
// Screenshot dimensions, rather than devicePixelRatio, account for browser zoom and HiDPI.
export function cropBounds(region, width, height) {
  const { x, y, width: w, height: h, viewportWidth: vw, viewportHeight: vh } = region || {};
  if (![x, y, w, h, vw, vh, width, height].every(Number.isFinite) ||
      x < 0 || y < 0 || w < 8 || h < 8 || vw <= 0 || vh <= 0 ||
      x + w > vw + 1 || y + h > vh + 1 || width <= 0 || height <= 0) {
    throw new Error('框选区域无效，请重新框选至少 8 × 8 像素的区域。');
  }
  const left = Math.floor(x * width / vw), top = Math.floor(y * height / vh);
  const right = Math.min(width, Math.ceil((x + w) * width / vw));
  const bottom = Math.min(height, Math.ceil((y + h) * height / vh));
  const result = { x: left, y: top, width: right - left, height: bottom - top };
  if (result.width * result.height > 16000000) throw new Error('区域太大，请只框选需要识别的文字。');
  return result;
}
export function recognizedText(value) {
  const text = typeof value === 'string' ? value.replace(/\r\n?/g, '\n').trim() : '';
  if (!text) throw new Error('没有识别到文字。请放大图片，或在插件面板选择正确的识别语言后重试。');
  if (text.length > 100000) throw new Error('识别结果超过 100,000 字符，请缩小框选范围。');
  return text;
}
