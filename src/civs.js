// Civilizations: six original Inu clans. Traits change HOW a clan plays (economy, timing, army style),
// never sell power: every clan is free to play, and Kibble only unlocks cosmetic banners/coats (see COSMETICS).
// Effects use the same keys as technology effects (src/sim.js techEffects), so they stack with the tech tree.
export const CIVS = {
  shiba: { name: 'Shiba Clan', style: 'Economy', unique: 'red_fang',
    traits: ['Berry foraging +15%, lumber +10%', 'Unique: Red Fang (fast, cheap raider infantry)'],
    effect: { ratePct: { tree: 10, berries: 15 } }, ai: { army: ['militia', 'archer', 'spearman'] } },
  akita: { name: 'Akita Dominion', style: 'Fast ages', unique: 'akita_guardian',
    traits: ['Age advancement researches 6% faster', 'Unique: Akita Guardian (armored heavy infantry)'],
    effect: { ageTimePct: -6 }, ai: { army: ['militia', 'archer', 'spearman'] } },
  kishu: { name: 'Kishu Archers', style: 'Archers', unique: 'kishu_longbow',
    traits: ['Archers +1 range', 'Bow Yard units cost 10% more', 'Unique: Kishu Longbow (range 7)'],
    effect: { archerRange: 1, costPct: { archery_range: 10 } }, ai: { army: ['archer', 'militia', 'spearman'] } },
  shikoku: { name: 'Shikoku Riders', style: 'Cavalry', unique: 'boar_rider',
    traits: ['Cavalry move 20% faster', 'Paddock units cost 50% less', 'Unique: Boar Rider (cavalry that breaks buildings)'],
    effect: { cavalrySpeedPct: 20, costPct: { stable: -50 } }, ai: { army: ['scout_cavalry', 'archer', 'spearman', 'militia'] } },
  hokkaido: { name: 'Hokkaido Wardens', style: 'Defense', unique: 'frost_guard',
    traits: ['Buildings +5% HP', 'Worker Pups build 10% faster', 'Den Hall fires +1 arrow', 'Unique: Frost Guard (anti-archer infantry)'],
    effect: { buildingHpPct: 5, buildSpeedPct: 10, extraArrows: 1 }, ai: { army: ['spearman', 'archer', 'militia'] } },
  kai: { name: 'Kai Brindles', style: 'Infantry', unique: 'brindle_striker',
    traits: ['Dojo units train 30% faster', 'Infantry +35% HP', 'Unique: Brindle Striker (fast-attacking anti-cavalry)'],
    effect: { trainTimePct: { barracks: -30 }, infantryHpPct: 35 }, ai: { army: ['militia', 'archer', 'spearman'] } },
};
export const CIV_IDS = Object.keys(CIVS);
export const DEFAULT_CIV = 'shiba';
export const civOf = (world, owner) => CIVS[world.players?.[owner]?.civ] || CIVS[DEFAULT_CIV];
// Cosmetic-only unlocks per clan (banner colours / coat patterns). No gameplay effect anywhere in the sim.
export const COSMETICS = Object.fromEntries(CIV_IDS.map(id => [id, [
  { id: `${id}_banner_gold`, name: `${CIVS[id].name} Gold Banner`, kind: 'banner', price: 5000000 },
  { id: `${id}_coat_winter`, name: `${CIVS[id].name} Winter Coat`, kind: 'coat', price: 8000000 },
]]));
// Visual identity per clan (presentation only, never read by the sim): palette, shield emblem, landmark, unit skin.
export const CIV_LOOK = {
  shiba:    { primary: '#d4682a', secondary: '#f6e6c8', accent: '#3a2414', emblem: 'sun',   landmark: 'torii',  sky: ['#f7b267', '#f4845f'], fur: '#d4853a' },
  akita:    { primary: '#8a1c1c', secondary: '#f3e2b8', accent: '#d4a640', emblem: 'crown', landmark: 'castle', sky: ['#5b2a3c', '#c0584a'], fur: '#c9612c' },
  kishu:    { primary: '#2e6b3a', secondary: '#f4f1ea', accent: '#a8d08d', emblem: 'bow',   landmark: 'pagoda', sky: ['#a8d5ba', '#4f8a5b'], fur: '#f4f1ea' },
  shikoku:  { primary: '#2a4c8a', secondary: '#e6d0a8', accent: '#e8c46a', emblem: 'horse', landmark: 'stable', sky: ['#9ec5e8', '#3d6fb0'], fur: '#b8743c' },
  hokkaido: { primary: '#5a7ea0', secondary: '#ffffff', accent: '#bfe3ff', emblem: 'snow',  landmark: 'wall',   sky: ['#dfeefa', '#8fb3cf'], fur: '#ece4d4' },
  kai:      { primary: '#3a2a20', secondary: '#c8a070', accent: '#e05a2a', emblem: 'stripe', landmark: 'dojo',  sky: ['#7a5a40', '#2a1a12'], fur: '#4a3426' },
};
// Cosmetic rarity of a clan's shield, from owned Kibble cosmetics only (Common / Rare / Legendary). Never gameplay.
export function civRarity(owned = []) { return id => { const n = COSMETICS[id].filter(c => owned.includes(c.id)).length; return n >= 2 ? 'legendary' : n === 1 ? 'rare' : 'common'; }; }
