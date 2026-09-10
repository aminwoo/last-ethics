# Animated player

The player is one of the Quaternius Zombie Apocalypse Kit's four authored survivors, so the survivor, the enemies and the town are all one art style. Provenance is in `public/models/survivors/README.md`. These are authored meshes, skeletons, textures and animation clips, not characters assembled from code geometry. The model rotates continuously with the existing mouse-aim heading.

The player picks their own survivor on the deployment screen, alongside their
specialist. The class only supplies the default, so the two selections stay in
step until the player chooses a survivor themselves:

| Class | Default survivor |
| --- | --- |
| Soldier | Matt |
| Heavy, Engineer | Sam |
| Scout, Assassin | Shaun |
| Medic | Lis |

Six classes share four outfits rather than wearing tinted copies of one: the kit's texture is a palette atlas and takes tinting badly. The choice is cosmetic — `gameState.playerSurvivor` never touches the class stats. Multiplayer carries neither over the wire, so remote survivors are spread across the four outfits by a hash of the peer id — four distinct people rather than four copies of the same one. Only the survivors a session needs are fetched, and choosing one on the deployment screen starts fetching it there.

`src/gameplay/playerVisual.js` loads and caches each asset, clones its skeleton per player, and splits the kit's named clips into two layers by bone:

| Layer | Bones | Clips |
| --- | --- | --- |
| Lower | `Root`, `Body`, `Hips`, legs, feet, IK pole targets | `Idle_Gun`, `Walk_Gun`, `Run_Gun` |
| Upper | everything above the hips | `Idle_Gun` to aim, `Idle` as the lowered-weapon reload pose |

The two never overlap, so firing cannot stop the walking cycle and a stride never disturbs the aim. Locomotion uses the kit's `_Gun` variants because their legs were authored against this upper body. Layers blend over 120 ms.

The kit has no firing clip, so a shot is recoil: each accepted shot adds a short impulse to the weapon hand, both forearms and the torso, and every accepted shot restarts it, even while already firing. Reload blends the upper body down to the unarmed idle and adds a magazine-fetching motion with the free hand. Both are additive offsets over the authored pose, applied after restoring it, so they never accumulate on constant tracks. Empty clicks and rejected shots trigger nothing.

## Weapons

Each survivor file carries all ten kit weapon meshes parented to the rig's left hand. The equipped weapon is whichever anchor `weapons.js` has made visible — already the game's source of truth — so the mesh follows it with no new plumbing and no protocol change:

| Anchor | Mesh |
| --- | --- |
| `pistol` | `Pistol` |
| `shotgun` | `Shotgun` |
| `assaultRifle` | `SMG` |
| `sniperRifle` | `Rifle` |
| `bat` | `WoodenBat_Barbed` |

Every weapon gets a muzzle anchor at the forward tip of its own geometry, so bullets, muzzle flashes and the barrel the HUD reads all originate at the barrel of the mesh actually in the survivor's hand. That barrel sits higher than the previous rig's did, which exposed a latent problem in `weapons.js`: bullets were tested against a sphere on the enemy's *origin*, at its feet, so most of the hit radius was spent on the vertical gap and the tallest weapons would have shot clean over the horde. The sphere is now centred on the torso. `tests/playerVisual.test.mjs` asserts that every equipped weapon keeps a usable horizontal hit radius.

## Sizing

`Box3` ignores skinning, so measuring a rig that way reports its bind pose: arms out, spear included. Survivors are sized from posed bounds computed off their own bone matrices, over the skinned body only, which is what makes 2.8 units mean the same thing for all four.

## Validation

Production build, the survival regression tests, and tests that parse the real rigs, clips and weapon meshes (omitting only image decoding, which Node has no decoder for): each class's survivor stands 2.8 units with its feet on the ground, legs and upper body run independently through firing and reloading, repeated zero-time updates never accumulate procedural offsets, each anchor shows exactly its own weapon and every barrel tracks that mesh's muzzle, clones stay independent, and removal during loading cannot attach a ghost survivor after a restart. Checked in the running game in a browser: the soldier, scout, heavy and medic outfits each deploy and stand on the asphalt, the held mesh changes with the equipped weapon, and a survivor picked against the class default (Shaun as a medic) is the one that reaches the arena.
