import { translateStory } from './story-en.js';
import { translateUI } from './ui-en.js';

let language = 'zh-CN';
const han = /\p{Script=Han}/u;
const originals = new WeakMap();
const attributes = ['aria-label', 'data-tooltip', 'title', 'alt', 'placeholder'];
const translatable = text => han.test(text) || text.trim() === 'THE LAST POST';

export const getLanguage = () => language;

export function setLanguage(value) {
  language = value === 'en' ? 'en' : 'zh-CN';
}

export function t(text) {
  if (language !== 'en' || !translatable(text)) return text;
  const source = text.trim();
  const story = translateStory(source);
  const translated = story === source ? translateUI(source, translateStory) : story;
  return text.replace(source, () => translated);
}

// Keep the authored string so a live dialogue can change back without rebuilding its controls.
function localizeField(node, field, current) {
  let fields = originals.get(node);
  const previous = fields?.get(field);
  if (!previous && !translatable(current)) return;
  const source = previous?.rendered === current ? previous.source : current;
  const rendered = t(source);
  if (!fields) { fields = new Map(); originals.set(node, fields); }
  fields.set(field, { source, rendered });
  if (rendered === current) return;
  if (field === 'text') node.nodeValue = rendered;
  else node.setAttribute(field, rendered);
}

export function localize(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE && (node.getAttribute('translate') === 'no' || ['path', 'circle', 'i'].includes(node.localName))) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = root;
  do {
    if (node.nodeType === Node.TEXT_NODE) localizeField(node, 'text', node.nodeValue);
    else for (const name of attributes) {
      if (node.hasAttribute(name)) localizeField(node, name, node.getAttribute(name));
    }
  } while ((node = walker.nextNode()));
}
