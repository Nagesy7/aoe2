// Long-press tooltips for touch: hold a button with a title (or data-tip) for 450 ms to see what it does.
// The tap that follows a shown tooltip is swallowed, so peeking never triggers the button. Buttons that already use
// long-press for an action (control groups) are skipped. Desktop keeps the native title tooltips.
export function installTouchTips({ hold = 450, skip = '[data-g]' } = {}) {
  const tip = document.createElement('div'); tip.id = 'touchtip'; tip.setAttribute('role', 'tooltip'); document.body.appendChild(tip);
  let timer = null, shownFor = null, start = null;
  const hide = () => { tip.style.display = 'none'; };
  const show = el => { const text = el.dataset.tip || el.getAttribute('title') || el.getAttribute('aria-label'); if (!text) return;
    tip.textContent = text; tip.style.display = 'block'; const r = el.getBoundingClientRect(), t = tip.getBoundingClientRect();
    let x = r.left + r.width / 2 - t.width / 2, y = r.bottom + 6; if (y + t.height > innerHeight - 4) y = r.top - t.height - 6;
    tip.style.left = Math.max(4, Math.min(innerWidth - t.width - 4, x)) + 'px'; tip.style.top = Math.max(4, y) + 'px'; shownFor = el; navigator.vibrate?.(10); };
  document.addEventListener('touchstart', e => { const el = e.target.closest?.('button[title],button[data-tip],[data-tip]'); hide(); clearTimeout(timer); shownFor = null;
    if (!el || el.matches(skip) || e.touches.length > 1) return; const t0 = e.touches[0]; start = { x: t0.clientX, y: t0.clientY }; timer = setTimeout(() => show(el), hold); }, { capture: true, passive: true });
  document.addEventListener('touchmove', e => { if (!start) return; const t = e.touches[0]; if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > 10) clearTimeout(timer); }, { capture: true, passive: true });
  document.addEventListener('touchend', () => { clearTimeout(timer); start = null; if (shownFor) setTimeout(hide, 1600); }, { capture: true, passive: true });
  document.addEventListener('click', e => { if (shownFor && e.target.closest?.('button,[data-tip]') === shownFor) { e.preventDefault(); e.stopImmediatePropagation(); shownFor = null; } }, true);
  return { hide, state: () => ({ visible: tip.style.display === 'block', text: tip.textContent }) };
}
