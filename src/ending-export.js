import harborCover from './art/harbor-cover.webp';
import { getLanguage, t } from './i18n.js';

export function exportEnding(ending, download) {
  const separator = getLanguage() === 'en' ? ': ' : '：';
  const receipts = ending.receipts.map(receipt => [
    t(receipt.title),
    t(receipt.body),
    t('纪念物') + separator + t(receipt.keepsake),
  ].join('\n'));
  const content = [
    `${t('余信')} · ${t(ending.subtitle)}\n${t(ending.title)}`,
    t(ending.text),
    ending.reflections.map(text => t(text)).join('\n'),
    ...receipts,
    t('原创叙事游戏《余信 / The Last Post》· AI 辅助制作'),
  ].join('\n\n');
  download(content, t('余信-投递手记.txt'), 'text/plain;charset=utf-8');
}

function wrapLines(ctx, text, width, english) {
  const tokens = english ? text.trim().split(/\s+/u) : Array.from(text);
  const lines = [];
  let line = '';
  for (const token of tokens) {
    const candidate = english && line ? line + ' ' + token : line + token;
    if (line && ctx.measureText(candidate).width > width) {
      lines.push(line);
      line = token;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function exportPostcard(ending, download, toast) {
  // Capture the language at the click, before loading the illustration.
  const english = getLanguage() === 'en';
  const caption = t('白沙港 · 夜航');
  const title = t(ending.title);
  const subtitle = t(ending.subtitle);
  const reflections = ending.reflections.map(text => t(text));
  const credit = t('原创叙事与美术 · AI 辅助制作');
  const filename = t('余信-夜航明信片.png');
  const postOffice = english ? 'BAISHA POST' : '白沙邮局';
  const delivered = t('已送达');
  const illustration = new Image();
  illustration.src = harborCover;
  const illustrationReady = await illustration.decode().then(() => true, () => false);
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 900;
  const ctx = canvas.getContext('2d');
  if (!ctx) { toast(t('当前浏览器无法绘制明信片。')); return; }
  ctx.fillStyle = '#f5e7c8'; ctx.fillRect(0, 0, 1280, 900);
  for (let x = 0; x < 1280; x += 48) {
    ctx.fillStyle = x % 96 === 0 ? '#9a4a3a' : '#2e6159';
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 24, 0); ctx.lineTo(x + 38, 14); ctx.lineTo(x + 14, 14);
    ctx.fill();
  }
  ctx.fillStyle = '#23474a'; ctx.fillRect(48, 60, 550, 647);
  if (illustrationReady) {
    const cropWidth = illustration.naturalHeight * 550 / 647;
    ctx.drawImage(illustration, illustration.naturalWidth - cropWidth, 0, cropWidth, illustration.naturalHeight, 48, 60, 550, 647);
  }
  ctx.strokeStyle = '#aa9571'; ctx.lineWidth = 2; ctx.strokeRect(48, 60, 550, 647);
  ctx.beginPath(); ctx.moveTo(626, 60); ctx.lineTo(626, 808); ctx.stroke();
  const face = english ? 'Georgia, serif' : '"Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#23473f'; ctx.font = `bold 29px ${face}`; ctx.fillText(caption, 48, 760);
  ctx.font = '18px Georgia, serif'; ctx.fillText('THE LAST POST', 49, 792);
  ctx.fillStyle = '#914536'; ctx.font = `bold 22px ${face}`; ctx.fillText(subtitle, 660, 123);
  ctx.fillStyle = '#23473f';
  const headingSize = english ? 44 : 56;
  ctx.font = `bold ${headingSize}px ${face}`;
  const headings = wrapLines(ctx, title, 556, english);
  headings.forEach((line, i) => ctx.fillText(line, 658, 206 + i * (headingSize + 5)));
  ctx.font = `20px ${face}`;
  let y = 288 + (headings.length - 1) * (headingSize + 5);
  for (const text of reflections) {
    for (const line of wrapLines(ctx, text, 546, english)) {
      ctx.fillText(line, 660, y);
      y += 31;
    }
    y += 19;
  }
  ctx.save();
  ctx.translate(1154, 733); ctx.rotate(-0.14);
  ctx.strokeStyle = '#914536'; ctx.fillStyle = '#914536'; ctx.lineWidth = 2;
  for (const radius of [64, 54]) { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke(); }
  ctx.textAlign = 'center';
  ctx.font = `bold ${english ? 13 : 16}px ${face}`; ctx.fillText(postOffice, 0, -14);
  ctx.font = `bold ${english ? 17 : 20}px ${face}`; ctx.fillText(delivered, 0, 18);
  ctx.restore();
  ctx.fillStyle = '#4e6054'; ctx.font = `16px ${face}`; ctx.fillText(credit, 660, 856);
  canvas.toBlob(blob => {
    if (blob) download(blob, filename, 'image/png');
    else toast(t('这张明信片未能导出。'));
  }, 'image/png');
}
