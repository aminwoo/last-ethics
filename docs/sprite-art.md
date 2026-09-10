# Painted sprite art

Generated with the built-in image_gen tool. Original PNG outputs, including their alpha channels, are saved in `public/sprites/`; no procedural stand-ins or runtime canvas drawing are used for these assets. Exact generation prompts are in `sprite-prompts.json`.

| File | Contents |
| --- | --- |
| `characters-v1.png` | Survivor, regular zombie, runner, brute; four directional views each, retained as unused source art |
| `props-v1.png` | Sandbags, supply crates, fuel drums, concrete rubble |
| `courtyard-v1.png` | Repeating weathered concrete ground texture |

The generated files are 1254 × 1254. Character row bounds are explicitly mapped in the retained `src/gameplay/sprites.js` helper, because the painted rows are not perfectly uniform. Images are used directly through UV coordinates, preserving the original alpha. Directional frames share texture sources, while individual character materials support independent damage flashes and death fades. Active enemy and player model cleanup is now handled by their respective visual modules.

Only `courtyard-v1.png` is still rendered, as the ground texture. The character
and prop atlases and the `src/gameplay/sprites.js` helpers that read them are
retained as source art and are no longer used by the running game:

- Enemies use four textured, rigged models with authored movement, attack and death clips. See `enemy-animation.md`.
- The player uses the Quaternius survivor rigs, chosen on the deployment screen. See `player-animation.md`.
- The painted prop sprites have been replaced by the kit's authored streets, wrecks, barricades and junk. See `town.md`.

Turrets, lights, weather and combat particles retain their existing rendering.

Validation: production build, survival regression tests, sprite direction/source-sharing/hit/death/disposal tests, and a local browser visual check.
