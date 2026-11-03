// Contrast audit for the light theme, run in the browser on a page of the app.
// Usage (devtools or an automation tool): paste, then `await window.__contrastAudit()`.
// Reports text below WCAG AA (4.5:1, or 3:1 for large text) and form-control borders
// below 3:1 (WCAG 1.4.11), grouped by the element's classes so the cause is visible.
(() => {
  // Tailwind 4 colours are oklch(); painting one pixel converts any CSS colour to sRGB.
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  const parse = (c) => {
    if (cache.has(c)) return cache.get(c);
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillStyle = c;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
    // getImageData is premultiplied-free but rounds; un-premultiply for partial alpha
    const out = a === 0 ? [0, 0, 0, 0] : [r, g, b, a / 255];
    cache.set(c, out);
    return out;
  };
  const lum = ([r, g, b]) => {
    const f = (x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const blend = (top, bottom) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + bottom[i] * (1 - a)).concat(1);
  };
  const ratio = (a, b) => { const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x); return (l1 + 0.05) / (l2 + 0.05); };
  const bgOf = (el) => {
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) { layers.push(c); if (c[3] >= 1) break; }
    }
    return layers.reverse().reduce((acc, c) => blend(c, acc), [255, 255, 255, 1]);
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.1;
  };
  const label = (el) => `${el.tagName.toLowerCase()}.${[...el.classList].filter((c) => /text-|bg-|border-|opacity/.test(c)).join('.')}`;

  window.__contrastAudit = () => {
    const issues = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!visible(el) || el.closest('[aria-hidden="true"], svg')) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      const s = getComputedStyle(el);
      const bg = bgOf(el);
      if (own) {
        const fg = blend(parse(s.color), bg);
        const size = parseFloat(s.fontSize), bold = Number(s.fontWeight) >= 700;
        const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
        const r = ratio(fg, bg);
        const disabled = el.closest('button:disabled, [aria-disabled="true"], input:disabled');
        if (r < need && !disabled) issues.push({ kind: 'text', ratio: +r.toFixed(2), need, text: el.textContent.trim().slice(0, 40), el: label(el) });
      }
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) && el.type !== 'checkbox' && el.type !== 'radio' && el.type !== 'hidden') {
        const border = blend(parse(s.borderTopColor), bg);
        const outside = bgOf(el.parentElement);
        const r = ratio(border, outside);
        if (r < 3 && parseFloat(s.borderTopWidth) > 0) issues.push({ kind: 'border', ratio: +r.toFixed(2), need: 3, text: el.name || el.placeholder || el.type, el: label(el) });
      }
    }
    return issues;
  };
})();
