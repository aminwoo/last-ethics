# Last Ethics - Atmospheric Shooter

A browser-based 3D zombie survival top-down shooter game built with Three.js. Fight through endless waves of zombies in a dark, atmospheric environment while managing your resources and surviving as long as possible.

## Features

- Four weapons: Pistol, Shotgun, Assault Rifle, and piercing Sniper Rifle
- Six specialist classes with distinct passive abilities
- Choose one of three randomized permanent upgrades after each wave
- Wave-clear health and ammunition supplies, with escalating hordes
- Tactical title screen, field guide, hit markers, kill feed, and local personal best
- Dynamic weapon switching and reloading system
- Atmospheric effects including rain and thunder
- Resource management (ammo, health, stamina)
- Defensive turrets and a rain-soaked, illuminated landing zone
- Modern UI with health, stamina, and ammo indicators
- Multiplayer support for playing with friends
- In-game chat system for player communication

## Controls

- WASD - Move
- SHIFT - Sprint
- Mouse - Aim
- Left Click - Shoot
- R - Reload
- 1–4 - Switch Weapons
- F - Toggle flashlight
- I - Inventory
- ENTER - Call the next wave early during intermission
- ESC - Pause Game
- T - Open Chat / Start Typing
- ESC (while typing) - Close Chat

## Run locally

Run `npm install`, then `npm start`. Open `http://localhost:5173`.
`npm test` checks wave timing, rewards, upgrade stacking/reset, and survival time.
`npm run build` creates the production build.

To run the game the way it is deployed - one process serving the built client and
the multiplayer socket on a single port - use `npm run serve:build`, then open
`http://localhost:3000`. `PORT` overrides the port, and `/healthz` reports status.

Solo play is the default. The game pauses when you open the field guide, choose
an upgrade, or leave the browser tab. Each cleared wave supplies 15 health and
two magazines of reserve ammunition per weapon. Upgrades stack for the current
run; restarting restores the selected class and original weapon stats.

## Project Structure

```
last-ethics/
├── assets/           # Images and audio files
├── src/              # Source code
│   ├── core/         # Shared game state and character definitions
│   │   ├── classes.js
│   │   └── gameState.js
│   ├── gameplay/     # World, player, combat, and enemy systems
│   │   ├── effects.js
│   │   ├── environment.js
│   │   ├── player.js
│   │   ├── turrets.js
│   │   ├── weapons.js
│   │   └── zombies.js
│   ├── services/     # Networking and audio services
│   │   ├── network.js
│   │   └── sound.js
│   ├── ui/           # Interface and inventory modules
│   │   ├── chat.js
│   │   ├── inventory.js
│   │   └── ui.js
│   ├── input.js      # User input handling
│   └── main.js       # Main game initialization and loop
└── server/           # Multiplayer server implementation
    ├── server.js     # WebSocket server for multiplayer
    └── package.json  # Server dependencies
```

## Multiplayer Setup

The game supports multiplayer functionality, allowing players to see and interact with each other in the same game world. The server dependencies live in the root `package.json`, so `npm install` at the root is all you need.

**Against the Vite dev server** (hot reload while you work):

```bash
npm run serve   # terminal 1: multiplayer server on port 3000
npm start       # terminal 2: Vite dev client on port 5173
```

Then open `http://localhost:5173/?multiplayer` in multiple browser windows.

**Against a production build** (one process, one port):

```bash
npm run serve:build
```

Then open `http://localhost:3000/?multiplayer`.

Add `?multiplayer` to opt into the experimental multiplayer mode; connection
attempts do not block play. Waves and pause state are local to each client, not
synchronized co-op progression.

### Choosing a server

The client picks its WebSocket target from the page it was served by:

| Page served from | Connects to |
| --- | --- |
| Vite dev/preview (`:5173`, `:4173`) | `ws://<same host>:3000` |
| Anywhere else (the game server itself) | The same origin, `wss:` when the page is `https:` |

Because production is same-origin, there is no server URL baked into the build -
deploying to a new domain needs no code change. To point a client somewhere else,
append `?server=host:port` (or a full `ws://`/`wss://` URL), which is handy for
testing a local client against a deployed server:

```
http://localhost:5173/?multiplayer&server=wss://your-server.example.com
```

### Multiplayer Troubleshooting

If you're having trouble with the multiplayer functionality:

1. Make sure the server is running before starting the game
2. Check your browser console (F12) for connection errors
3. If playing across different devices, ensure they're on the same network
4. The players appear with bright red bodies, yellow heads, and a cyan beam above them
5. Press 'M' key to toggle detailed debug information about connected players
6. Try refreshing the page if players don't appear
7. For local testing, you can open multiple browser windows to test with multiple players
8. If you see multiple player counts on the server, try closing all browser windows and restarting both the server and clients

## Deploying

The game deploys as a single Render web service: one process serves the built
client and the multiplayer WebSocket on the same port. Because the client derives
its socket URL from the page's own origin, nothing needs rebuilding when the
domain changes.

`render.yaml` in the repo root is a Render blueprint. To deploy:

1. Push this repo to GitHub (Render reads the blueprint from the default branch).
2. In the Render dashboard, choose **New > Blueprint** and pick this repository.
   Render reads `render.yaml` and proposes a `last-ethics` web service.
3. Apply. The first build runs `npm ci --include=dev && npm run build`, then
   starts `npm run serve`.
4. Once live, the game is at `https://<your-service>.onrender.com/` and
   multiplayer at `https://<your-service>.onrender.com/?multiplayer`.

Check `https://<your-service>.onrender.com/healthz` for status, connected player
count, and whether the client build was found.

Notes:

- `PORT` is supplied by Render; the server binds it automatically.
- The free plan sleeps after ~15 minutes with no traffic, so the first request
  after an idle period takes 30-60 seconds and open sockets drop. The client
  retries with exponential backoff (6 attempts) and rebuilds its player list from
  the server's `init` on reconnect, so a sleeping server recovers on its own.
- `--include=dev` in the build command matters: Render sets `NODE_ENV=production`,
  which would otherwise skip Vite and leave the client unbuilt.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. # last-ethics

## Zombie Model Testing Guide

This guide explains how to test the different zombie types in the game.

### Available Zombie Types

The game features four distinct enemy types, each with its own authored Quaternius rig and behaviour (see `docs/enemy-animation.md`):

1. **REGULAR**: Standard zombies with balanced stats
   - Appearance: green zombie in blue trousers
   - Medium speed, health, and damage

2. **RUNNER**: Fast zombies that can chase you quickly
   - Appearance: ochre mutant with one oversized arm and a hunched run
   - Higher speed, lower health, medium damage

3. **BRUTE**: Heavy zombies that hit hard
   - Appearance: broad purple zombie with an exposed tongue
   - Lower speed, higher health, higher damage

4. **DOG**: Infected shepherds that reach you first
   - Appearance: brown quadruped that bites rather than punches
   - Highest speed, lowest health, rapid low-damage attacks
   - Joins the horde from wave 3

### Testing Keys

Special keys have been added to help test the zombie models:

- `T` - Spawn all three zombie types side by side for comparison
  - This creates stationary zombies that won't move or attack
  - The Regular zombie appears on the left
  - The Runner zombie appears in the middle
  - The Brute zombie appears on the right

- `Y` - Spawn a mixed horde of zombies near your current position
  - Creates 3 Regular zombies
  - Creates 2 Runner zombies
  - Creates 1 Brute zombie
  - These zombies will actively pursue and attack you

- `U` - Apply damage to the test zombies (if spawned with `T`)
  - This will damage all three test zombies
  - Each zombie takes 30 damage, which may kill some types but not others
  - You can see ragdoll physics in action
  - Press multiple times to apply more damage

### How to Test Effectively

1. Start the game
2. Press `T` to spawn the test zombies
3. Walk around them to see the visual differences from all angles
4. Press `U` to test their damage and death animations
5. Press `Y` to test how a mixed horde behaves in actual gameplay
6. Use your weapons to test how each zombie type responds to different damage amounts

### Testing Zombie Behavior

- Runners will chase you faster than Regular zombies
- Brutes will move slower but can take more damage
- Each zombie type has different knockback responses when hit
- Different zombie types have different ragdoll physics when they die

### Console Output

Testing commands will output information to the console (F12 to view):

- Zombie health values
- Damage applied
- Death notifications

Enjoy testing the different zombie types!

## Multiplayer Features

### Player Presence

- See other players moving in real-time
- Players appear with bright red bodies, yellow heads, and a cyan beam
- Player count shown in the top-right corner

### Chat System

- Press 'T' to open the chat box
- Type your message and press Enter to send
- Press ESC to close the chat
- System messages appear in yellow
- Your messages appear in teal
- Other players' messages appear in white
- Chat temporarily appears when new messages arrive
- Chat fades out when inactive
