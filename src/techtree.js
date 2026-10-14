// Tech tree data: ages, buildings, units, technologies. Pure data + tiny helpers, no game state.
// Costs / research times follow AoE2 (DE) values; build times are AoE2 values (1 builder).
export const AGES = ['dark', 'feudal', 'castle', 'imperial'];
export const AGE_NAMES = { dark: 'Dark Age', feudal: 'Feudal Age', castle: 'Castle Age', imperial: 'Imperial Age' };
export const ageIndex = a => AGES.indexOf(a);

// Age advancement is researched at the Town Center. `needs` distinct completed building types from `from`
// (or any one of `orAny`).
export const AGE_UPS = {
  feudal: { cost: { food: 500 }, time: 130, needs: 2, from: ['house', 'mill', 'lumber_camp', 'mining_camp', 'barracks', 'dock'] },
  castle: { cost: { food: 800, gold: 200 }, time: 160, needs: 2, from: ['archery_range', 'stable', 'blacksmith', 'market'] },
  imperial: { cost: { food: 1000, gold: 800 }, time: 190, needs: 2, from: ['monastery', 'university', 'castle'], orAny: ['castle'] },
};

export const BUILDINGS = {
  town_center: { name: 'Town Center', age: 'dark', size: 4, maxHp: 2400, armor: '3/5', popCap: 5, accepts: ['food', 'wood', 'gold', 'stone'], trains: ['villager'], cost: { wood: 275, stone: 100 }, buildTime: 150, menu: false },
  house: { name: 'House', age: 'dark', size: 2, maxHp: 550, popCap: 5, cost: { wood: 25 }, buildTime: 25 },
  lumber_camp: { name: 'Lumber Camp', age: 'dark', size: 2, maxHp: 600, cost: { wood: 100 }, buildTime: 35, accepts: ['wood'] },
  mining_camp: { name: 'Mining Camp', age: 'dark', size: 2, maxHp: 600, cost: { wood: 100 }, buildTime: 35, accepts: ['gold', 'stone'] },
  mill: { name: 'Mill', age: 'dark', size: 2, maxHp: 600, cost: { wood: 100 }, buildTime: 35, accepts: ['food'] },
  farm: { name: 'Farm', age: 'dark', size: 3, maxHp: 480, armor: '0/0', cost: { wood: 60 }, buildTime: 15, walkable: true },
  barracks: { name: 'Barracks', age: 'dark', size: 3, maxHp: 1200, cost: { wood: 175 }, buildTime: 50, trains: ['militia', 'spearman'] },
  // Feudal
  archery_range: { name: 'Archery Range', age: 'feudal', size: 3, maxHp: 1500, cost: { wood: 175 }, buildTime: 50, trains: ['archer'] },
  stable: { name: 'Stable', age: 'feudal', size: 3, maxHp: 1500, cost: { wood: 175 }, buildTime: 50, trains: ['scout_cavalry', 'knight'] },
  blacksmith: { name: 'Blacksmith', age: 'feudal', size: 3, maxHp: 1800, cost: { wood: 150 }, buildTime: 40 },
  market: { name: 'Market', age: 'feudal', size: 4, maxHp: 2100, cost: { wood: 175 }, buildTime: 60 },
  watch_tower: { name: 'Watch Tower', age: 'feudal', size: 1, maxHp: 1020, cost: { wood: 25, stone: 125 }, buildTime: 80 },
  // Castle
  castle: { name: 'Castle', age: 'castle', size: 4, maxHp: 4800, cost: { stone: 650 }, buildTime: 200, trains: ['trebuchet'] },
  monastery: { name: 'Monastery', age: 'castle', size: 3, maxHp: 2100, cost: { wood: 175 }, buildTime: 40, trains: ['monk'] },
  university: { name: 'University', age: 'castle', size: 3, maxHp: 2100, cost: { wood: 200 }, buildTime: 60 },
  // Imperial
  wonder: { name: 'Wonder', age: 'imperial', size: 5, maxHp: 4800, cost: { wood: 1000, stone: 1000, gold: 1000 }, buildTime: 3500 },
};
export const BUILD_MENU = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].menu !== false);

// Units. AoE2 stats: hp, attack, armor 'melee/pierce', range (tiles, ranged = pierce damage), reload (s), class bonus damage.
export const UNITS = {
  villager: { name: 'Villager', age: 'dark', cost: { food: 50 }, time: 25, speed: 2.5, hp: 25, attack: 3, armor: '0/0', reload: 2.0 },
  militia: { name: 'Militia', age: 'dark', cost: { food: 60, gold: 20 }, time: 21, speed: 2.2, hp: 40, attack: 4, armor: '0/1', reload: 2.0, infantry: true },
  spearman: { name: 'Spearman', age: 'feudal', cost: { food: 35, wood: 25 }, time: 22, speed: 2.5, hp: 45, attack: 3, armor: '0/0', reload: 3.0, infantry: true, bonus: { cavalry: 15 } },
  archer: { name: 'Archer', age: 'feudal', cost: { wood: 25, gold: 45 }, time: 35, speed: 2.4, hp: 30, attack: 4, armor: '0/0', range: 4, reload: 2.0, upgradesTo: { tech: 'crossbowman', unit: 'crossbowman' } },
  crossbowman: { name: 'Crossbowman', age: 'castle', cost: { wood: 25, gold: 45 }, time: 27, speed: 2.4, hp: 35, attack: 5, armor: '0/0', range: 5, reload: 2.0, trainedVia: 'archer' },
  scout_cavalry: { name: 'Scout Cavalry', age: 'feudal', cost: { food: 80 }, time: 30, speed: 3.6, hp: 45, attack: 3, armor: '0/2', reload: 2.0, cavalry: true },
  knight: { name: 'Knight', age: 'castle', cost: { food: 60, gold: 75 }, time: 30, speed: 3.4, hp: 100, attack: 10, armor: '2/2', reload: 1.8, cavalry: true },
  monk: { name: 'Monk', age: 'castle', cost: { gold: 100 }, time: 51, speed: 1.8, hp: 30, attack: 0, armor: '0/0' },
  trebuchet: { name: 'Trebuchet', age: 'imperial', cost: { wood: 200, gold: 200 }, time: 50, speed: 1.6, hp: 150, attack: 200, armor: '2/8', range: 16, reload: 10, bonus: { building: 250 } },
};

// Technologies. effect keys are interpreted by sim.js (see techEffects()).
export const TECHS = {
  loom: { name: 'Loom', at: 'town_center', age: 'dark', cost: { gold: 50 }, time: 25, effect: { villagerHp: 15 }, desc: 'Villagers +15 HP' },
  wheelbarrow: { name: 'Wheelbarrow', at: 'town_center', age: 'dark', cost: { food: 175, wood: 50 }, time: 75, effect: { carryPct: 25, villagerSpeedPct: 10 }, desc: 'Villagers carry +25%, move +10% faster' },
  hand_cart: { name: 'Hand Cart', at: 'town_center', age: 'castle', cost: { food: 300, wood: 200 }, time: 55, requires: ['wheelbarrow'], effect: { carryPct: 25, villagerSpeedPct: 10 }, desc: 'Villagers carry +25% more, move +10% faster' },
  double_bit_axe: { name: 'Double-Bit Axe', at: 'lumber_camp', age: 'feudal', cost: { food: 100, wood: 50 }, time: 25, effect: { ratePct: { tree: 20 } }, desc: 'Wood gathering +20%' },
  bow_saw: { name: 'Bow Saw', at: 'lumber_camp', age: 'castle', cost: { food: 150, wood: 100 }, time: 50, requires: ['double_bit_axe'], effect: { ratePct: { tree: 20 } }, desc: 'Wood gathering +20%' },
  two_man_saw: { name: 'Two-Man Saw', at: 'lumber_camp', age: 'imperial', cost: { food: 300, wood: 200 }, time: 100, requires: ['bow_saw'], effect: { ratePct: { tree: 10 } }, desc: 'Wood gathering +10%' },
  horse_collar: { name: 'Horse Collar', at: 'mill', age: 'feudal', cost: { food: 75, wood: 75 }, time: 20, effect: { farmFood: 75 }, desc: 'Farms +75 food' },
  heavy_plow: { name: 'Heavy Plow', at: 'mill', age: 'castle', cost: { food: 125, wood: 125 }, time: 40, requires: ['horse_collar'], effect: { farmFood: 125 }, desc: 'Farms +125 food' },
  crop_rotation: { name: 'Crop Rotation', at: 'mill', age: 'imperial', cost: { food: 250, wood: 250 }, time: 70, requires: ['heavy_plow'], effect: { farmFood: 175 }, desc: 'Farms +175 food' },
  gold_mining: { name: 'Gold Mining', at: 'mining_camp', age: 'feudal', cost: { food: 100, wood: 75 }, time: 30, effect: { ratePct: { gold_mine: 15 } }, desc: 'Gold mining +15%' },
  gold_shaft_mining: { name: 'Gold Shaft Mining', at: 'mining_camp', age: 'castle', cost: { food: 200, wood: 100 }, time: 75, requires: ['gold_mining'], effect: { ratePct: { gold_mine: 15 } }, desc: 'Gold mining +15%' },
  forging: { name: 'Forging', at: 'blacksmith', age: 'feudal', cost: { food: 150 }, time: 50, effect: { meleeAttack: 1 }, desc: 'Infantry & cavalry +1 attack' },
  iron_casting: { name: 'Iron Casting', at: 'blacksmith', age: 'castle', cost: { food: 220, gold: 120 }, time: 75, requires: ['forging'], effect: { meleeAttack: 1 }, desc: 'Infantry & cavalry +1 attack' },
  blast_furnace: { name: 'Blast Furnace', at: 'blacksmith', age: 'imperial', cost: { food: 275, gold: 225 }, time: 100, requires: ['iron_casting'], effect: { meleeAttack: 2 }, desc: 'Infantry & cavalry +2 attack' },
  crossbowman: { name: 'Crossbowman', at: 'archery_range', age: 'castle', cost: { food: 125, gold: 75 }, time: 35, effect: { upgrade: { archer: 'crossbowman' } }, desc: 'Upgrades Archers to Crossbowmen' },
};
export const techsAt = type => Object.keys(TECHS).filter(k => TECHS[k].at === type);
export const costText = c => Object.entries(c).map(([r, v]) => `${v} ${r}`).join(', ');
