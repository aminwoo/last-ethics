# Animated enemies

Enemies use four authored, textured, skinned Quaternius models from the CC0 Zombie Apocalypse Kit. Provenance is recorded in `public/models/enemies/README.md`. The older `Zombie.glb` is not used: its sole clip lasts about 67 ms, and its textures account for most of its 34 MB size.

`src/gameplay/zombieVisual.js` caches the assets and creates an independent skeleton, animation mixer and set of materials per enemy. Deployment waits for all four assets alongside the survivor and the town. Removal during loading is guarded so a restart cannot attach a model to a removed actor. Cleanup releases per-instance skeletons/materials, retaining shared asset geometry/textures for later waves.

| Type | Height | Locomotion | Attack | Appearance |
| --- | --- | --- | --- | --- |
| Regular | 2.7 | Walk | Punch | Green, blue trousers |
| Runner | 2.35 | Run | Punch | Ochre, asymmetric arms |
| Brute | 3.4 | Slower Walk | Punch | Broad purple body |
| Dog | 1.9 | Run | Attack | Brown shepherd, quadruped rig |

The dog is the fastest enemy in the game and the frailest: 45 health against a
runner's 80, rapid bites for 12 damage, and the lightest knockback decay of the
four. It joins the horde from wave 3 and settles at a fifth of the late waves.
Its rig is a quadruped with its own bone names and no `Punch` clip, so the clip
each type attacks with is part of its visual configuration rather than assumed.
All types use the authored `Idle` and `Death` clips. Transitions blend over 120 ms, locomotion starts at varied phases to avoid synchronized hordes, and stride speed follows wave speed scaling up to a 2× multiplier. Punch playback fits the existing attack cooldown; an attack sequence counter restarts consecutive punches even when they occur in the same animation state. Damage timing, enemy health, speed, separation and collision radii retain their existing values.

Meshes rotate continuously with the actor heading, cast and receive scene shadows, and use a modest textured emissive fill for visibility at night. Hits briefly flash the affected enemy. Death plays once, holds the final pose and dissolves between 1 and 1.5 seconds. Animation and fading advance with simulation time and pause with gameplay.

Deaths mark the ground: the first frame of an enemy's death animation writes one
splash into the town's recycling decal pool, sized by type. See `town.md`.

The real-asset regression tests cover all four skeletons, locomotion, sizing, repeated attacks, per-enemy hit/death isolation, shared geometry and cleanup during loading. The existing sprite tests remain for the retained sprite helper; character sprites are no longer used by active players or enemies.
