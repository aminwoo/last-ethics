# Last Ethics - Atmospheric Shooter

A browser-based 3D zombie survival top-down shooter game built with Three.js. Fight through endless waves of zombies in a dark, atmospheric environment while managing your resources and surviving as long as possible.

## Features

- Five different weapons: Chainsaw, Pistol, Shotgun, Grenade launcher, and SMG
- Dynamic weapon switching and reloading system
- Atmospheric effects including rain and thunder
- Resource management (ammo, health, stamina)
- Lootable bodies from defeated zombies
- Environmental obstacles for tactical gameplay
- Modern UI with health, stamina, and ammo indicators
- Multiplayer support for playing with friends
- In-game chat system for player communication

## Controls

- WASD - Move
- SHIFT - Sprint
- Mouse - Aim
- Left Click - Shoot
- R - Reload
- 1,2,3 - Switch Weapons
- ESC - Pause Game
- T - Open Chat / Start Typing
- ESC (while typing) - Close Chat

## Project Structure

```
last-ethics/
├── assets/           # Images and audio files
├── src/              # Source code
│   ├── effects.js    # Visual effects (screen shake, etc.)
│   ├── environment.js # Environmental elements and effects
│   ├── gameState.js  # Core game state management
│   ├── input.js      # User input handling
│   ├── main.js       # Main game initialization and loop
│   ├── network.js    # Multiplayer networking functionality
│   ├── player.js     # Player character implementation
│   ├── sound.js      # Sound effects and music
│   ├── ui.js         # User interface elements
│   ├── weapons.js    # Weapon systems and mechanics
│   └── zombies.js    # Enemy AI and behavior
└── server/           # Multiplayer server implementation
    ├── server.js     # WebSocket server for multiplayer
    └── package.json  # Server dependencies
```

## Multiplayer Setup

The game supports multiplayer functionality, allowing players to see and interact with each other in the same game world. To enable multiplayer:

1. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

2. Start the multiplayer server:
   ```bash
   npm start
   ```

3. Open the game in multiple browser windows or on different computers connected to the same network.

The server runs on port 3000 by default, and the game client will automatically connect to it when launched.

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

The game features three distinct zombie types, each with a unique model and behaviors:

1. **REGULAR**: Standard zombies with balanced stats
   - Appearance: Basic zombie with glowing red eyes
   - Medium speed, health, and damage

2. **RUNNER**: Fast zombies that can chase you quickly
   - Appearance: Leaner with yellow-orange eyes, elongated head, longer limbs
   - Wears athletic clothing
   - Higher speed, lower health, medium damage

3. **BRUTE**: Heavy zombies that hit hard
   - Appearance: Bulkier with dark red eyes, armor pieces, and spikes
   - Lower speed, higher health, higher damage

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
