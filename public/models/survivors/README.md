# Survivor characters

Author: **Quaternius**. Pack: [Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html), March 2024, [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/). Downloaded from the [FreeModels mirror](https://github.com/agentkaerf/FreeModels/tree/db3df04d1e4714298a09510b26fb6de6645138a2/Zombie%20Apocalypse%20Kit%20-%20March%202024/Characters/glTF) at commit `db3df04d1e4714298a09510b26fb6de6645138a2`. Meshes, skeletons, textures and animation data are unmodified.

| File | Worn by |
| --- | --- |
| `Characters_Matt.gltf` | Soldier |
| `Characters_Sam.gltf` | Heavy, Engineer |
| `Characters_Shaun.gltf` | Scout, Assassin |
| `Characters_Lis.gltf` | Medic |

All four share one skeleton and one set of twenty named clips, and each file carries the pack's ten weapon meshes parented to the rig's left hand: `Pistol`, `Rifle`, `Shotgun`, `SMG`, `Axe`, `Knife`, `Spear`, `Guitar`, `WoodenBat_Barbed` and `WoodenBat_Saw`. The game shows whichever one matches the equipped weapon, so the standalone `Weapons/` files from the pack are not needed and are not vendored.

The full character files are used rather than the pack's `_SingleWeapon` variants precisely because they carry the whole weapon set. Only the survivor a session actually needs is fetched: roughly 2.9 MB for the local player's class, and one more per distinct remote player. See `docs/player-animation.md`.
