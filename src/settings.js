import { normalizeSave } from './story.js';

export function defaultSettings({ narrow = false, reducedMotion = false } = {}) {
  return { language: 'zh-CN', quality: narrow ? 'low' : 'high', reducedMotion, largeText: false, volume: 0.58 };
}

export function normalizeSettings(value, defaults = defaultSettings()) {
  const input = value && typeof value === 'object' ? value : {};
  return {
    language: ['zh-CN', 'en'].includes(input.language) ? input.language : defaults.language,
    quality: ['low', 'high'].includes(input.quality) ? input.quality : defaults.quality,
    reducedMotion: typeof input.reducedMotion === 'boolean' ? input.reducedMotion : defaults.reducedMotion,
    largeText: typeof input.largeText === 'boolean' ? input.largeText : defaults.largeText,
    volume: typeof input.volume === 'number' && Number.isFinite(input.volume) ? Math.max(0, Math.min(1, input.volume)) : defaults.volume,
  };
}

export function encodeBackup(state) {
  return JSON.stringify({ game: 'the-last-post', format: 1, save: normalizeSave(state) }, null, 2);
}

export function decodeBackup(text) {
  if (typeof text !== 'string' || text.length > 200000) throw new Error('这份文件太大，无法放入邮包。');
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('没有读到完整的投递记录。请选择导出的 JSON 存档。'); }
  if (value?.game !== 'the-last-post' || value.format !== 1 || value.save?.version !== 1 || value.save.started !== true) {
    throw new Error('这不是可继续的《余信》投递记录。');
  }
  return normalizeSave(value.save);
}
