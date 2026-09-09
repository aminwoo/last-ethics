# Animated player

The four-view player billboard has been replaced with the repository's existing `public/models/Male Survivor 2 .glb`. This is an authored mesh, skeleton, texture and animation asset, not a character assembled from code geometry. The model rotates continuously with the existing mouse-aim heading.

`src/gameplay/playerVisual.js` loads and caches the asset, clones its skeleton per player, and maps its generically named Blender clips after visual inspection:

| Source clip | Use |
| --- | --- |
| NlaTrack | Idle legs; lowered upper-body pose during reload |
| NlaTrack.001 | Walking legs |
| NlaTrack.002 | Running legs |
| NlaTrack.003 | Aiming upper body |
| NlaTrack.004 | Firing upper body |

Leg and upper-body tracks are disjoint and blend over 120 ms. Running and walking continue while firing or reloading. Each successful shot restarts the firing action and adds a short recoil impulse to the weapon, hands and torso. Reloading blends down to the lowered weapon pose and adds a magazine-reaching hand motion. Reload is a layered animation built on the source poses, not a dedicated imported reload clip. Empty clicks and rejected shots do not trigger firing animation.

Muzzle anchors follow the animated weapon bone, so bullets and flashes originate at the rig's barrel. Reload completion and weapon switching cancel the corresponding action. Animation uses simulation time and pauses with gameplay. The loading screen waits for the local model, and each remote player receives an independent mixer and cloned skeleton.

The source model depicts one outfit with its bundled rifle; weapon and class selection still change gameplay and HUD rather than the mesh. Enemy sprites and environment art remain as described in `sprite-art.md`.

Validation includes the production build, existing survival/sprite tests, tests that parse the actual survivor rig and clips (omitting only image decoding in Node), and browser checks of running/firing/reloading at non-cardinal headings. Repeated zero-time updates verify that procedural offsets never accumulate on constant animation tracks.
