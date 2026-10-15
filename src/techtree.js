// Tech tree data: ages, buildings, units, technologies. Pure data + tiny helpers, no game state.
// Costs / research times follow classic-RTS reference values; build times are classic-RTS reference values (1 builder).
export const AGES = ['dark', 'feudal', 'castle', 'imperial'];
export const AGE_NAMES = { dark: 'Puppy Age', feudal: 'Pack Age', castle: 'Fortress Age', imperial: 'Shogun Age' };
export const ageIndex = a => AGES.indexOf(a);

// Age advancement is researched at the Den Hall. `needs` distinct completed building types from `from`
// (or any one of `orAny`).
export const AGE_UPS = {
  feudal: { cost: { food: 500 }, time: 130, needs: 2, from: ['house', 'mill', 'lumber_camp', 'mining_camp', 'barracks', 'dock'] },
  castle: { cost: { food: 800, gold: 200 }, time: 160, needs: 2, from: ['archery_range', 'stable', 'blacksmith', 'market'] },
  imperial: { cost: { food: 1000, gold: 800 }, time: 190, needs: 2, from: ['monastery', 'university', 'castle'], orAny: ['castle'] },
};

export const BUILDINGS = {
  town_center: { name: 'Den Hall', age: 'dark', size: 4, maxHp: 2400, armor: '3/5', popCap: 5, accepts: ['food', 'wood', 'gold', 'stone'], trains: ['villager'], garrison: 15, arrows: 1, cost: { wood: 275, stone: 100 }, buildTime: 150, menu: false },
  house: { name: 'Kennel Hut', age: 'dark', size: 2, maxHp: 550, popCap: 5, cost: { wood: 25 }, buildTime: 25 },
  lumber_camp: { name: 'Timber Lodge', age: 'dark', size: 2, maxHp: 600, cost: { wood: 100 }, buildTime: 35, accepts: ['wood'] },
  mining_camp: { name: 'Dig Site', age: 'dark', size: 2, maxHp: 600, cost: { wood: 100 }, buildTime: 35, accepts: ['gold', 'stone'] },
  mill: { name: 'Granary', age: 'dark', size: 2, maxHp: 600, cost: { wood: 100 }, buildTime: 35, accepts: ['food'] },
  farm: { name: 'Rice Paddy', age: 'dark', size: 3, maxHp: 480, armor: '0/0', cost: { wood: 60 }, buildTime: 15, walkable: true },
  barracks: { name: 'Dojo', age: 'dark', size: 3, maxHp: 1200, cost: { wood: 175 }, buildTime: 50, trains: ['militia', 'spearman'] },
  // Feudal
  archery_range: { name: 'Bow Yard', age: 'feudal', size: 3, maxHp: 1500, cost: { wood: 175 }, buildTime: 50, trains: ['archer'] },
  stable: { name: 'Paddock', age: 'feudal', size: 3, maxHp: 1500, cost: { wood: 175 }, buildTime: 50, trains: ['scout_cavalry', 'knight'] },
  blacksmith: { name: 'Forge', age: 'feudal', size: 3, maxHp: 1800, cost: { wood: 150 }, buildTime: 40 },
  market: { name: 'Bazaar', age: 'feudal', size: 4, maxHp: 2100, cost: { wood: 175 }, buildTime: 60 },
  watch_tower: { name: 'Lookout Tower', age: 'feudal', size: 1, maxHp: 1020, garrison: 5, arrows: 1, cost: { wood: 25, stone: 125 }, buildTime: 80 },
  // Castle
  castle: { name: 'Fortress', age: 'castle', size: 4, maxHp: 4800, armor: '8/10', cost: { stone: 650 }, buildTime: 200, trains: ['trebuchet'], garrison: 20, arrows: 4 },
  monastery: { name: 'Shrine', age: 'castle', size: 3, maxHp: 2100, cost: { wood: 175 }, buildTime: 40, trains: ['monk'] },
  university: { name: 'Academy', age: 'castle', size: 3, maxHp: 2100, cost: { wood: 200 }, buildTime: 60 },
  // Imperial
  wonder: { name: 'Grand Torii', age: 'imperial', size: 5, maxHp: 4800, cost: { wood: 1000, stone: 1000, gold: 1000 }, buildTime: 3500 },
};
export const BUILD_MENU = Object.keys(BUILDINGS).filter(k => BUILDINGS[k].menu !== false);

// Units. Classic RTS stats: hp, attack, armor 'melee/pierce', range (tiles, ranged = pierce damage), reload (s), class bonus damage.
export const UNITS = {
  villager: { name: 'Worker Pup', age: 'dark', cost: { food: 50 }, time: 25, speed: 2.5, hp: 25, attack: 3, armor: '0/0', reload: 2.0 },
  militia: { name: 'Footpaw', age: 'dark', cost: { food: 60, gold: 20 }, time: 21, speed: 2.2, hp: 40, attack: 4, armor: '0/1', reload: 2.0, infantry: true, upgradesTo: { tech: 'blade_paw', unit: 'blade_paw' } },
  spearman: { name: 'Pike Pup', age: 'feudal', cost: { food: 35, wood: 25 }, time: 22, speed: 2.5, hp: 45, attack: 3, armor: '0/0', reload: 3.0, infantry: true, bonus: { cavalry: 15 }, upgradesTo: { tech: 'halberd_pup', unit: 'halberd_pup' } },
  archer: { name: 'Bow Pup', age: 'feudal', cost: { wood: 25, gold: 45 }, time: 35, speed: 2.4, hp: 30, attack: 4, armor: '0/0', range: 4, reload: 2.0, upgradesTo: { tech: 'crossbowman', unit: 'crossbowman' } },
  crossbowman: { name: 'Longbow Pup', age: 'castle', cost: { wood: 25, gold: 45 }, time: 27, speed: 2.4, hp: 35, attack: 5, armor: '0/0', range: 5, reload: 2.0, trainedVia: 'archer' },
  scout_cavalry: { name: 'Scout Rider', age: 'feudal', cost: { food: 80 }, time: 30, speed: 3.6, hp: 45, attack: 3, armor: '0/2', reload: 2.0, cavalry: true, upgradesTo: { tech: 'swift_rider', unit: 'swift_rider' } },
  knight: { name: 'Armored Rider', age: 'castle', cost: { food: 60, gold: 75 }, time: 30, speed: 3.4, hp: 100, attack: 10, armor: '2/2', reload: 1.8, cavalry: true, bonus: { building: 3 } },
  blade_paw: { name: 'Blade Paw', age: 'feudal', cost: { food: 60, gold: 20 }, time: 21, speed: 2.2, hp: 50, attack: 6, armor: '0/1', reload: 2.0, infantry: true, trainedVia: 'militia', bonus: { building: 2 } },
  halberd_pup: { name: 'Halberd Pup', age: 'castle', cost: { food: 35, wood: 25 }, time: 22, speed: 2.5, hp: 55, attack: 4, armor: '0/0', reload: 3.0, infantry: true, trainedVia: 'spearman', bonus: { cavalry: 22 } },
  swift_rider: { name: 'Swift Rider', age: 'castle', cost: { food: 80 }, time: 30, speed: 3.8, hp: 60, attack: 7, armor: '0/2', reload: 2.0, cavalry: true, trainedVia: 'scout_cavalry' },
  // civilization unique units (trained at the Fortress by that civ only; see src/civs.js)
  red_fang: { name: 'Red Fang', age: 'castle', cost: { food: 55, gold: 30 }, time: 16, speed: 2.9, hp: 55, attack: 8, armor: '0/1', reload: 1.8, infantry: true, unique: 'shiba', bonus: { building: 3 } },
  akita_guardian: { name: 'Akita Guardian', age: 'castle', cost: { food: 70, gold: 50 }, time: 22, speed: 2.0, hp: 110, attack: 9, armor: '2/3', reload: 2.0, infantry: true, unique: 'akita', bonus: { building: 3 } },
  kishu_longbow: { name: 'Kishu Longbow', age: 'castle', cost: { wood: 35, gold: 40 }, time: 18, speed: 2.4, hp: 35, attack: 6, armor: '0/1', range: 7, reload: 2.0, unique: 'kishu' },
  boar_rider: { name: 'Boar Rider', age: 'castle', cost: { food: 70, gold: 70 }, time: 24, speed: 3.4, hp: 105, attack: 10, armor: '1/2', reload: 2.0, cavalry: true, unique: 'shikoku', bonus: { building: 6 } },
  frost_guard: { name: 'Frost Guard', age: 'castle', cost: { food: 60, gold: 40 }, time: 20, speed: 2.2, hp: 80, attack: 9, armor: '1/4', reload: 2.0, infantry: true, unique: 'hokkaido', bonus: { archer: 4 } },
  brindle_striker: { name: 'Brindle Striker', age: 'castle', cost: { food: 50, wood: 40 }, time: 16, speed: 2.6, hp: 65, attack: 8, armor: '1/1', reload: 1.6, infantry: true, unique: 'kai', bonus: { cavalry: 8 } },
  monk: { name: 'Shrine Keeper', age: 'castle', cost: { gold: 100 }, time: 51, speed: 1.8, hp: 30, attack: 0, armor: '0/0' },
  trebuchet: { name: 'Boulder Thrower', age: 'imperial', cost: { wood: 200, gold: 200 }, time: 50, speed: 1.6, hp: 150, attack: 200, armor: '2/8', range: 16, reload: 10, bonus: { building: 250 } },
};

// Technologies. effect keys are interpreted by sim.js (see techEffects()).
export const TECHS = {
  loom: { name: 'Thick Coat', at: 'town_center', age: 'dark', cost: { gold: 50 }, time: 25, effect: { villagerHp: 15 }, desc: 'Worker Pups +15 HP' },
  wheelbarrow: { name: 'Carry Sling', at: 'town_center', age: 'dark', cost: { food: 175, wood: 50 }, time: 75, effect: { carryPct: 25, villagerSpeedPct: 10 }, desc: 'Worker Pups carry +25%, move +10% faster' },
  hand_cart: { name: 'Pack Cart', at: 'town_center', age: 'castle', cost: { food: 300, wood: 200 }, time: 55, requires: ['wheelbarrow'], effect: { carryPct: 25, villagerSpeedPct: 10 }, desc: 'Worker Pups carry +25% more, move +10% faster' },
  double_bit_axe: { name: 'Keen Axe', at: 'lumber_camp', age: 'feudal', cost: { food: 100, wood: 50 }, time: 25, effect: { ratePct: { tree: 20 } }, desc: 'Wood gathering +20%' },
  bow_saw: { name: 'Crosscut Saw', at: 'lumber_camp', age: 'castle', cost: { food: 150, wood: 100 }, time: 50, requires: ['double_bit_axe'], effect: { ratePct: { tree: 20 } }, desc: 'Wood gathering +20%' },
  two_man_saw: { name: 'Twin Saw', at: 'lumber_camp', age: 'imperial', cost: { food: 300, wood: 200 }, time: 100, requires: ['bow_saw'], effect: { ratePct: { tree: 10 } }, desc: 'Wood gathering +10%' },
  horse_collar: { name: 'Paddy Terraces', at: 'mill', age: 'feudal', cost: { food: 75, wood: 75 }, time: 20, effect: { farmFood: 75 }, desc: 'Farms +75 food' },
  heavy_plow: { name: 'Iron Hoe', at: 'mill', age: 'castle', cost: { food: 125, wood: 125 }, time: 40, requires: ['horse_collar'], effect: { farmFood: 125 }, desc: 'Farms +125 food' },
  crop_rotation: { name: 'Season Planting', at: 'mill', age: 'imperial', cost: { food: 250, wood: 250 }, time: 70, requires: ['heavy_plow'], effect: { farmFood: 175 }, desc: 'Farms +175 food' },
  gold_mining: { name: 'Gold Sniffing', at: 'mining_camp', age: 'feudal', cost: { food: 100, wood: 75 }, time: 30, effect: { ratePct: { gold_mine: 15 } }, desc: 'Gold yield +15%' },
  gold_shaft_mining: { name: 'Deep Dig', at: 'mining_camp', age: 'castle', cost: { food: 200, wood: 100 }, time: 75, requires: ['gold_mining'], effect: { ratePct: { gold_mine: 15 } }, desc: 'Gold yield +15%' },
  forging: { name: 'Tempered Claws', at: 'blacksmith', age: 'feudal', cost: { food: 150 }, time: 50, effect: { meleeAttack: 1 }, desc: 'Infantry & cavalry +1 attack' },
  iron_casting: { name: 'Steel Claws', at: 'blacksmith', age: 'castle', cost: { food: 220, gold: 120 }, time: 75, requires: ['forging'], effect: { meleeAttack: 1 }, desc: 'Infantry & cavalry +1 attack' },
  blast_furnace: { name: 'Dragon Forge', at: 'blacksmith', age: 'imperial', cost: { food: 275, gold: 225 }, time: 100, requires: ['iron_casting'], effect: { meleeAttack: 2 }, desc: 'Infantry & cavalry +2 attack' },
  crossbowman: { name: 'Longbow Training', at: 'archery_range', age: 'castle', cost: { food: 125, gold: 75 }, time: 35, effect: { upgrade: { archer: 'crossbowman' } }, desc: 'Upgrades Bow Pups to Longbow Pups' },
  // Forge (blacksmith-style) armor + archery lines
  lacquer_plates: { name: 'Lacquer Plates', at: 'blacksmith', age: 'feudal', cost: { food: 100 }, time: 40, effect: { meleeArmor: 1, pierceArmor: 1 }, desc: 'Infantry & cavalry +1/+1 armor' },
  lamellar_plates: { name: 'Lamellar Plates', at: 'blacksmith', age: 'castle', cost: { food: 200, gold: 100 }, time: 55, requires: ['lacquer_plates'], effect: { meleeArmor: 1, pierceArmor: 1 }, desc: 'Infantry & cavalry +1/+1 armor' },
  kabuto_plates: { name: 'Kabuto Plates', at: 'blacksmith', age: 'imperial', cost: { food: 300, gold: 150 }, time: 70, requires: ['lamellar_plates'], effect: { meleeArmor: 1, pierceArmor: 2 }, desc: 'Infantry & cavalry +1/+2 armor' },
  fletched_arrows: { name: 'Fletched Arrows', at: 'blacksmith', age: 'feudal', cost: { food: 100, wood: 50 }, time: 30, effect: { archerAttack: 1, archerRange: 1 }, desc: 'Archers +1 attack, +1 range' },
  barbed_arrows: { name: 'Barbed Arrows', at: 'blacksmith', age: 'castle', cost: { food: 200, gold: 100 }, time: 50, requires: ['fletched_arrows'], effect: { archerAttack: 1, archerRange: 1 }, desc: 'Archers +1 attack, +1 range' },
  quilted_vests: { name: 'Quilted Vests', at: 'blacksmith', age: 'feudal', cost: { food: 100 }, time: 40, effect: { archerArmor: 1 }, desc: 'Archers +1/+1 armor' },
  stone_sniffing: { name: 'Stone Sniffing', at: 'mining_camp', age: 'feudal', cost: { food: 100, wood: 75 }, time: 30, effect: { ratePct: { stone_mine: 15 } }, desc: 'Stone yield +15%' },
  masonry: { name: 'Stone Joinery', at: 'university', age: 'castle', cost: { wood: 175, stone: 150 }, time: 50, effect: { buildingHpPct: 10 }, desc: 'Buildings +10% HP' },
  ballistics_t: { name: 'Wind Reading', at: 'university', age: 'castle', cost: { wood: 300, gold: 175 }, time: 60, effect: { archerAttack: 1 }, desc: 'Ranged units +1 attack' },
  // unit-line upgrades
  blade_paw: { name: 'Blade Paw', at: 'barracks', age: 'feudal', cost: { food: 100, gold: 40 }, time: 40, effect: { upgrade: { militia: 'blade_paw' } }, desc: 'Upgrades Footpaws to Blade Paws' },
  halberd_pup: { name: 'Halberd Pup', at: 'barracks', age: 'castle', cost: { food: 215, gold: 90 }, time: 45, effect: { upgrade: { spearman: 'halberd_pup' } }, desc: 'Upgrades Pike Pups to Halberd Pups' },
  swift_rider: { name: 'Swift Rider', at: 'stable', age: 'castle', cost: { food: 150, gold: 50 }, time: 45, effect: { upgrade: { scout_cavalry: 'swift_rider' } }, desc: 'Upgrades Scout Riders to Swift Riders' },
};
export const techsAt = type => Object.keys(TECHS).filter(k => TECHS[k].at === type);
export const costText = c => Object.entries(c).map(([r, v]) => `${v} ${r}`).join(', ');

// Buildings that shoot arrows: base arrows + 1 per garrisoned unit (capped), attack 5 pierce, range 7, reload 2 s.
export const BUILDING_ARROW = { attack: 5, range: 7, reload: 2 };
