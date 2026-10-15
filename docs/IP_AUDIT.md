# Inu Empires: IP audit (2026-10-15)

Scope: everything in this repo that ships or is visible on GitHub. That covers page title/meta, menu/HUD/tooltips, unit/building/tech/age/clan names, cosmetics, README/docs, package metadata, code comments, art (sprites, baked building signs), fonts, audio, taunts and third-party code.
Guard: `tests/ip.test.mjs` (part of `npm test`) fails on banned franchise, publisher, age, tech, unit or taunt terms. It checks every display-name table and all shipped files, with code identifiers stripped out.

## Result summary
| Area | Found | Action |
|---|---|---|
| Page title / meta / share card | `<title>Inu Empires</title>`; no og/twitter tags | OK, nothing to change |
| Package | name `inu-empires`; description said "AoE2-style" | now "classic-style browser RTS" |
| Age names | Dark / Feudal / Castle / Imperial Age | Puppy / Pack / Fortress / Shogun Age |
| Building names | Town Center, House, Lumber Camp, Mining Camp, Mill, Farm, Barracks, Archery Range, Stable, Blacksmith, Market, Watch Tower, Castle, Monastery, University, Wonder | Den Hall, Kennel Hut, Timber Lodge, Dig Site, Granary, Rice Paddy, Dojo, Bow Yard, Paddock, Forge, Bazaar, Lookout Tower, Fortress, Shrine, Academy, Grand Torii |
| Unit names | Villager, Militia, Man-at-Arms-style line, Spearman, Pikeman-style line, Archer, Crossbowman, Scout Cavalry, Light-cav line, Knight, Monk, Trebuchet | Worker Pup, Footpaw, Blade Paw, Pike Pup, Halberd Pup, Bow Pup, Longbow Pup, Scout Rider, Swift Rider, Armored Rider, Shrine Keeper, Boulder Thrower |
| Tech names | Loom, Wheelbarrow, Hand Cart, Double-Bit Axe, Bow Saw, Two-Man Saw, Horse Collar, Heavy Plow, Crop Rotation, Gold Mining, Gold Shaft Mining, Stone Mining, Forging, Iron Casting, Blast Furnace, Scale/Chain/Plate armour line, Fletching/Bodkin line, Padded-armour line, Masonry, Ballistics, Crossbowman upgrade | Thick Coat, Carry Sling, Pack Cart, Keen Axe, Crosscut Saw, Twin Saw, Paddy Terraces, Iron Hoe, Season Planting, Gold Sniffing, Deep Dig, Stone Sniffing, Tempered Claws, Steel Claws, Dragon Forge, Lacquer / Lamellar / Kabuto Plates, Fletched / Barbed Arrows, Quilted Vests, Stone Joinery, Wind Reading, Longbow Training |
| Tech descriptions | "Gold mining +15%", "Stone mining +15%" | "Gold yield +15%", "Stone yield +15%" |
| Civilisations | none copied: clans are dog breeds (Shiba, Akita, Kishu, Shikoku, Hokkaido, Kai) with original traits | OK |
| Cosmetics | "Snow Akita knights", "Kai brindle militia", "Spitz monk robe" | "Snow Akita riders", "Kai brindle Footpaws", "Spitz shrine-keeper robe" |
| Building art | Baked sign text on 14 building PNGs used the old names (e.g. TOWN CENTER, BARRACKS) | repainted with the new names in Pixelify Sans (SIL OFL 1.1, open licence) |
| Unit sprites | In-house Inu Verse sprite sheets (art/units); no extracted game assets | OK |
| Audio / taunts / "Wololo" | no audio files, no taunt system, no conversion chant | OK; the guard bans "wololo" and known taunt lines |
| Fonts | system sans-serif in the UI; Pixelify Sans (OFL) only baked into the sign PNGs | OK |
| Third-party code | none; no openage/GPL headers or vendored engines (`playwright` and `ws` are dev dependencies only, Apache-2.0/MIT) | OK |
| UI layout | generic RTS HUD (resource bar, info panel, command buttons); no copied icons or skins. Build menu is now an original 3-tab grid | OK |
| README / docs / comments | "AoE2-style", "AoE2 values", "AoE2 Dark Age", "as in AoE2", "(AoE2: …)", the old names throughout the README tables, and `aoe2-ashen.vercel.app` links | "classic RTS" wording, Inu names everywhere, links point to inu-empires.vercel.app |
| Network ids | BroadcastChannel `aoe2-room-*`; relay banner "aoe2 lockstep relay" | `inu-room-*`; "Inu Empires lockstep relay" |
| Live URL | the project domain `aoe2-ashen.vercel.app` contains "aoe2" | added the alias **inu-empires.vercel.app** (see report); the old domain is still served by Vercel |

## Deliberately unchanged
- **Internal ids** (`town_center`, `militia`, `feudal`, `wheelbarrow`…) are code keys. They are never shown to players and the lockstep command format, saved state and tests depend on them, so they stay. The guard strips identifiers, so any of these leaking into visible text fails the test.
- **Repo folder and Vercel project name** (`aoe2`) are infrastructure. Renaming them needs the owner (GitHub repo rename and Vercel project rename). Recommended.
- **Generic RTS mechanics** (gather/deposit, ages, counters, lockstep) are not protectable expression. Stats are reused as balance reference numbers only, and the guard bans franchise naming.
