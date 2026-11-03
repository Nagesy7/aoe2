// Shop / For devs links + results nudge: links exist with exact copy/URLs, no banned words, analytics props wallet-free.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { paidEvent, trackPaid, SHOP_URL, DEVS_URL, SHOP_TITLE, NUDGE_TEXT, NUDGE_GO, NUDGE_NO, NUDGE_KEY } from '../src/paidlinks.js';
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const src = readFileSync(new URL('../src/paidlinks.js', import.meta.url), 'utf8');
const dec = s => s.replace(/&amp;/g, '&');
const tag = id => { const m = html.match(new RegExp(`<a id="${id}"[^>]*>([^<]*)</a>`)); assert.ok(m, `#${id} link exists`); return { tag: dec(m[0]), text: m[1] }; };
const shop = tag('m-shop'), devs = tag('m-devs');
assert.equal(shop.text, '🛍️ Shop'); assert.equal(devs.text, '🛠️ For devs');
assert.ok(shop.tag.includes('href="https://kibbleinu.com/pay?utm_source=inu-empires&utm_medium=menu#shop-h"'), 'shop href');
assert.ok(devs.tag.includes('href="https://kibbleinu.com/for-devs.html?utm_source=inu-empires&utm_medium=menu"'), 'devs href');
assert.ok(shop.tag.includes(`title="${SHOP_TITLE}"`) && SHOP_TITLE === 'Optional cosmetics. $KIBBLE is never needed to play.', 'shop title');
for (const l of [shop, devs]) { assert.ok(l.tag.includes('target="_blank"') && l.tag.includes('rel="noopener"'), 'new tab + noopener'); }
// both in the main menu, after the Settings button (under the existing menu buttons)
const home = html.slice(html.indexOf('id="pg-home"'), html.indexOf('id="pg-', html.indexOf('id="pg-home"') + 10));
assert.ok(home.indexOf('id="m-shop"') > home.indexOf('id="m-settings"') && home.includes('id="m-devs"'), 'links sit under the menu buttons in #pg-home');
assert.equal(SHOP_URL('menu'), 'https://kibbleinu.com/pay?utm_source=inu-empires&utm_medium=menu#shop-h');
assert.equal(SHOP_URL('results'), 'https://kibbleinu.com/pay?utm_source=inu-empires&utm_medium=results#shop-h');
assert.equal(DEVS_URL, 'https://kibbleinu.com/for-devs.html?utm_source=inu-empires&utm_medium=menu');
assert.equal(NUDGE_TEXT, 'Like your look? Outfits, pets and cars for every Inu game are in the Kibble Pay shop. Optional, and never needed to play.');
assert.equal(NUDGE_GO, 'Visit the shop →'); assert.equal(NUDGE_NO, 'Not now'); assert.equal(NUDGE_KEY, 'inu.shopNudge');
assert.ok(!/for-devs|For devs/.test(src.slice(src.indexOf('export function mountPaidLinks'))), 'players never see dev products in the nudge');
// copy rules: no urgency / prize / price-promise words
const BANNED = /hurry|limited|last chance|don't miss|guarantee|moon|profit|prize/i;
for (const c of [shop.text, devs.text, SHOP_TITLE, NUDGE_TEXT, NUDGE_GO, NUDGE_NO]) assert.ok(!BANNED.test(c), `banned word in: ${c}`);
// analytics: exact shape, wallet-free, guarded
const ALLOWED = ['product', 'from', 'site'];
for (const [p, f] of [['shop', 'inu-empires-menu'], ['for-devs', 'inu-empires-menu'], ['shop', 'inu-empires-results']]) {
  const ev = paidEvent(p, f); assert.equal(ev.name, 'paid_link_click'); assert.deepEqual(Object.keys(ev.data).sort(), [...ALLOWED].sort());
  assert.deepEqual(ev.data, { product: p, from: f, site: 'inu-empires' });
  assert.ok(!/wallet|mint|name|score|0x|[1-9A-HJ-NP-Za-km-z]{32,}/i.test(JSON.stringify(ev.data)), 'no wallet/mint/name/score');
}
assert.equal(paidEvent('kibble', 'inu-empires-menu'), null, 'unknown products are not sent');
const sent = []; assert.equal(trackPaid('shop', 'inu-empires-menu', { va: (...a) => sent.push(a) }), true); assert.deepEqual(sent[0], ['event', paidEvent('shop', 'inu-empires-menu')]);
assert.equal(trackPaid('shop', 'inu-empires-menu', {}), false, 'va missing: no throw');
assert.equal(trackPaid('shop', 'inu-empires-menu', { va: () => { throw new Error('x'); } }), false, 'va throws: swallowed');
console.log('shoplinks tests passed');
