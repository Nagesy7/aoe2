// Shop / For devs links (main menu) and the once-per-session results nudge (victory/defeat overlay only).
// Optional cosmetics: $KIBBLE is never needed to play. Analytics carry only product/from/site: never wallet, mint, name or score.
export const SITE = 'inu-empires';
export const SHOP_URL = medium => `https://kibbleinu.com/pay?utm_source=${SITE}&utm_medium=${medium}#shop-h`;
export const DEVS_URL = `https://kibbleinu.com/for-devs.html?utm_source=${SITE}&utm_medium=menu`;
export const SHOP_TITLE = 'Optional cosmetics. $KIBBLE is never needed to play.';
export const NUDGE_TEXT = 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.';
export const NUDGE_GO = 'Visit the shop →', NUDGE_NO = 'Not now', NUDGE_KEY = 'inu.shopNudge';

const PRODUCTS = new Set(['shop', 'for-devs']), FROMS = new Set([`${SITE}-menu`, `${SITE}-results`]);
export function paidEvent(product, from) {
  if (!PRODUCTS.has(product) || !FROMS.has(from)) return null;
  return { name: 'paid_link_click', data: { product, from, site: SITE } };
}
export function trackPaid(product, from, g = globalThis) {
  const ev = paidEvent(product, from); if (!ev) return false;
  try { if (typeof g.va !== 'function') return false; g.va('event', ev); return true; } catch { return false; }
}

const store = () => { try { return globalThis.sessionStorage; } catch { return null; } };
export const nudgeSeen = (s = store()) => { try { return !!s?.getItem(NUDGE_KEY); } catch { return true; } };
const markSeen = (s = store()) => { try { s?.setItem(NUDGE_KEY, '1'); } catch {} };

// browser wiring: delegated click tracking for every a[data-paid], plus the results nudge element
export function mountPaidLinks(doc = document) {
  doc.addEventListener('click', e => { const a = e.target.closest?.('a[data-paid]'); if (a) trackPaid(a.dataset.paid, a.dataset.from); }, true);
  const el = doc.createElement('div'); el.id = 'shop-nudge'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Kibble Pay shop'); el.hidden = true;
  el.innerHTML = `<p></p><div class="sn-row"><a class="sn-go" target="_blank" rel="noopener" data-paid="shop" data-from="${SITE}-results"></a><button type="button" class="sn-no"></button></div>`;
  el.querySelector('p').textContent = NUDGE_TEXT;
  const go = el.querySelector('.sn-go'); go.href = SHOP_URL('results'); go.textContent = NUDGE_GO;
  const no = el.querySelector('.sn-no'); no.textContent = NUDGE_NO;
  let shownFor = null; const hide = () => { el.hidden = true; };
  go.addEventListener('click', hide); no.addEventListener('click', hide);
  doc.body.appendChild(el);
  // called every HUD refresh: show only once a match has a winner (the victory/defeat overlay), never in a lobby or live match
  return { el, tick(world, { lobby = false } = {}) {
    const over = !!(world && world.winner && world.banner) && !lobby;
    if (!over) { if (!el.hidden) hide(); shownFor = null; return; }
    if (shownFor === world || nudgeSeen()) return;
    shownFor = world; markSeen(); el.hidden = false;
  } };
}
