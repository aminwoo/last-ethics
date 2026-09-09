# Painted sprite art

Generated with the built-in image_gen tool. Original PNG outputs, including their alpha channels, are saved in `public/sprites/`; no procedural stand-ins or runtime canvas drawing are used for these assets. Exact generation prompts are in `sprite-prompts.json`.

| File | Contents |
| --- | --- |
| `characters-v1.png` | Regular zombie, runner, brute; four directional views each (survivor row retained as unused source art) |
| `props-v1.png` | Sandbags, supply crates, fuel drums, concrete rubble |
| `courtyard-v1.png` | Repeating weathered concrete ground texture |

The generated files are 1254 × 1254. Character row bounds are explicitly mapped in `src/gameplay/sprites.js`, because the painted rows are not perfectly uniform. Images are used directly through UV coordinates, preserving the original alpha. Directional frames share texture sources, while individual character materials allow independent damage flashes and death fades. Materials are disposed when enemies or remote players are removed and when a run restarts.

Enemies use camera-facing billboards for the existing elevated camera. Four views track world heading. Their motion uses restrained bob, sway, attack lean and death fade; these are directional poses, not frame-by-frame walk cycles. Turrets, lights, weather and combat particles retain their existing rendering.

The player now uses the existing `public/models/Male Survivor 2 .glb` skinned model instead of the survivor sprite. See `player-animation.md`.

Validation: production build, survival regression tests, sprite direction/source-sharing/hit/death/disposal tests, and a local browser visual check.
