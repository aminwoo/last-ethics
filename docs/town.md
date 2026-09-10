# The town

The arena is a built place rather than an open field: a crossroads inside a square ring road, dressed with the Quaternius Zombie Apocalypse Kit's complete environment and vehicle sets. Provenance is recorded in `public/models/props/README.md`. `src/gameplay/props.js` builds it; `src/gameplay/environment.js` still owns the ground, weather, fog and the moon.

## Scale

The kit's characters and props are authored at one scale, and the game inherits it. The survivor stands 1.37 authored units in his gun pose, so pinning him at 2.8 game units gives `WORLD_SCALE` in `src/gameplay/kit.js`, and every prop is placed in authored units through `m()`. That is why a barrel comes up to a survivor's chest and a shipping container dwarfs him without anything being tuned by eye.

Two pieces are deliberately off that scale. Street lights are shortened to 60% and the traffic lights and town sign to 70%: the camera sits 25 units up at 45 degrees, and full-height street furniture sweeps across the play area instead of framing it.

## Layout

The layout is authored, not random. A single seed drives the jitter inside each hand-placed cluster, so every session gets the same town.

| Ring | Contents |
| --- | --- |
| Landing zone, r < 20 | Painted markings, four street lamps carrying the scene's only point lights, the spawn turrets |
| Approach lanes, r 20-40 | Four asphalt arms, half-blocked by checkpoint barricades, cones, barrels and armoured wrecks |
| Blocks, r 25-45 | Junk piles between the lanes: pallets, trash, tyres, cinder blocks, pipes |
| Ring road, r ~49 | Cracked tiles, civilian wrecks, shipping containers, traffic lights, the town sign and water tower |

Street tiles are 8 authored units square and carry their own kerbs. Which edges each tile opens through was read off that kerb geometry — `Straight` opens along Z, the `T`'s stem points at -X, `Turn` joins +X to +Z — and the layout's rotations place those openings. `tests/townProps.test.mjs` walks the finished grid and fails if any tile opens onto empty ground or into a neighbour's kerb.

The ground keeps its rolling displacement only beyond `TOWN_RADIUS`, tapering in over 40 units. Streets and props are flat slabs; displacement under them would show as clipping.

## Cost

Every prop type is drawn as one `InstancedMesh` per authored mesh, so around 350 placed props cost roughly 80 draw calls. Only the four landing-zone lamps are real lights. Every other lamp glows through an emissive material and drops an additive pool on the ground, which the near-black fog fades out with distance for free.

Corpses are the one exception to instancing: seven `Zombie_Ribcage` rigs, each posed by playing the authored `Death` clip to its final frame and then dropping the mixer. `Box3` ignores skinning, so they are seated on the ground using bounds measured from their own bone matrices.

## Obstacles

Wrecks, containers, barricades, barrels and crates publish lightweight proxies on `window.environmentObstacles`, the array the horde and the minimap already read. Nothing is published inside the landing zone. Small litter publishes nothing and is walked over.

`calculateZombieSeparation` in `src/gameplay/zombies.js` previously scanned a fixed slice of that array by index, which was harmless while it was empty. With a town in it, that would have steered the horde around whichever props happened to load first, so the scan now tests every obstacle behind a squared-distance cull.

## Blood

Fifteen dried splashes are laid down before the first wave. Kills reuse a ring buffer of twelve instances each of the two smaller splash meshes: a kill writes one instance matrix and allocates nothing, and the arena accumulates evidence of the fight without growing without bound. The largest splash is nearly two bodies across and is reserved for the dried stains — a wave's worth of those in one doorway reads as a red carpet.
