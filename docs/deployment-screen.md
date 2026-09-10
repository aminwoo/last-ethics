# The deployment screen

Two choices, in order, on one screen that fits the viewport: the **specialist**
decides how you fight, the **survivor** decides who does it.

## Selection

The two rosters are independent. Picking a specialist moves the survivor
selection to that class's default outfit, so the screen is always in a
deployable state; picking a survivor pins it, and later specialist changes leave
it alone. The deploy button names both (`DEPLOY LIS / ENGINEER`) and stays
disabled until a specialist is chosen — the survivor always has a value.

`gameState.playerSurvivor` is cosmetic and separate from `playerClass`;
`initializePlayer` prefers it and falls back to the class default. Choosing a
survivor also starts fetching that model, so the ~2.9 MB rig is usually cached
by the time the loading screen asks for it. Both rosters are keyboard-operable
(`role="button"`, `aria-pressed`, Enter and Space).

## Portraits

`public/images/survivors/*.png` are rendered from the game's own rigs — the
`Idle` clip, weapons hidden, three-quarter view, transparent background — so the
portrait is the character the player actually gets. They were produced once with
a throwaway page driving the same three.js loader the game uses, and are checked
in as assets; there is no runtime cost and no second art style to maintain.

## Fitting the viewport

The screen used to overflow: six specialist cards plus a button in a panel
capped at `90vh`, which scrolled and hid half the roster. It now sizes itself
against the viewport instead of the content.

- The console is a flex column at `height: 100%`, capped at `860px` so it stops
  stretching on large monitors, with the specialist grid taking the slack.
- Type, padding and portraits are `clamp()`ed against `vh`, so the whole console
  shrinks with the window rather than spilling out of it.
- Each specialist card is a grid whose last row absorbs the leftover height,
  which keeps the detail grouped at the top and the perks on the bottom edge.
- Narrow windows drop the card blurbs and the roster one-liners, and the
  specialists stay three across down to 700px, because a third row of cards
  costs more height than the extra column saves.

Verified with no scrollbar and no clipped card at 1920×1080, 1600×900,
1440×900, 1366×768, 1280×800/720/640/560, 1024×768, 900×820, 820×640 and
700×700. Below 640px wide the console scrolls on purpose rather than cropping a
card: that is phone width for a mouse-aimed game.
