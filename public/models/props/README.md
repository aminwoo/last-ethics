# Town props

Author: **Quaternius**. Pack: [Zombie Apocalypse Kit](https://quaternius.com/packs/zombieapocalypsekit.html), March 2024. The author's pack page licenses these assets under [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/), including personal and commercial use.

The self-contained glTF files were downloaded from the [FreeModels mirror](https://github.com/agentkaerf/FreeModels/tree/db3df04d1e4714298a09510b26fb6de6645138a2/Zombie%20Apocalypse%20Kit%20-%20March%202024), pinned to commit `db3df04d1e4714298a09510b26fb6de6645138a2`. Meshes, textures and materials are unmodified; placement, scale, lighting and emissive fill are configured in the game by `src/gameplay/props.js`.

This directory holds the pack's complete `Environment` and `Vehicles` sets.

| Group | Files |
| --- | --- |
| Streets | `Street_4Way`, `Street_T`, `Street_Turn`, `Street_Straight`, `Street_Straight_Crack1`, `Street_Straight_Crack2` |
| Street furniture | `StreetLights`, `TrafficLight_1`, `TrafficLight_2`, `FireHydrant`, `TownSign`, `WaterTower` |
| Barricades | `TrafficBarrier_1`, `TrafficBarrier_2`, `PlasticBarrier`, `TrafficCone_1`, `TrafficCone_2` |
| Containers and supplies | `Container_Green`, `Container_Red`, `Chest`, `Chest_Special`, `Barrel`, `Pallet`, `Pallet_Broken` |
| Junk | `TrashBag_1`, `TrashBag_2`, `Wheel`, `Wheels_Stack`, `CinderBlock`, `Couch`, `Pipes` |
| Blood | `Blood_1`, `Blood_2`, `Blood_3` |
| Vehicles | `Vehicle_Truck`, `Vehicle_Pickup`, `Vehicle_Sports` and the `_Armored` variant of each |

Every street tile is 8 authored units square with its own kerbs; the openings each tile leaves in those kerbs decide how the layout fits together, and `tests/townProps.test.mjs` checks that the town honours them. Materials named `Light`, `Headlights` and `BrakeLight` carry no texture and are lit as emissive glass by the game.

These assets are served locally and require no third-party requests at runtime. Total source size is approximately 5.6 MB. `License.txt` is the mirror's original license file, preserved verbatim; its heading names a different Quaternius pack, and the author's Zombie Apocalypse Kit page independently confirms CC0 for this one.
