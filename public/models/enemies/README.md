# Enemy models

Author: **Quaternius**. Pack: [Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html), March 2024. The author's pack page licenses these assets under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), including personal and commercial use.

The self-contained glTF files were downloaded from the [FreeModels mirror](https://github.com/agentkaerf/FreeModels/tree/db3df04d1e4714298a09510b26fb6de6645138a2/Zombie%20Apocalypse%20Kit%20-%20March%202024/Characters/glTF), pinned to commit `db3df04d1e4714298a09510b26fb6de6645138a2`. Meshes, textures, skeletons and animation data are unmodified; scale, lighting and animation playback are configured in the game.

| File | Enemy |
| --- | --- |
| `Zombie_Basic.gltf` | Regular: green zombie, blue trousers |
| `Zombie_Arm.gltf` | Runner: ochre mutant, oversized arm, hunched running pose |
| `Zombie_Chubby.gltf` | Brute: large purple zombie with exposed tongue |
| `Characters_GermanShepherd.gltf` | Dog: quadruped rig with its own `Attack` clip in place of `Punch` |
| `Zombie_Ribcage.gltf` | Not an enemy: corpses dressed into the town, holding the last frame of `Death` |

`License.txt` is the mirror's original license file, preserved verbatim. Its heading says “Ultimate Platformer Pack”; the author’s Zombie Apocalypse Kit page independently confirms CC0 for this pack.

These assets are served locally and require no third-party requests at runtime. Total source download size is approximately 6.2 MB. Each enemy clones its skeleton and materials, while geometry and textures are shared among instances of the same type.
