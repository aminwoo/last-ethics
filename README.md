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

## Controls

- WASD - Move
- SHIFT - Sprint
- Mouse - Aim
- Left Click - Shoot
- R - Reload
- 1,2,3 - Switch Weapons
- ESC - Pause Game

## Project Structure

```
last-ethics/
├── assets/           # Images and audio files
├── src/             # Source code
│   ├── game.js      # Main game file
│   └── modules/     # Game modules
│       ├── constants.js    # Game constants and settings
│       ├── effects.js      # Visual effects (rain, thunder)
│       ├── environment.js  # Environment objects and collision
│       ├── game-state.js   # Game state management
│       ├── player.js       # Player controls and mechanics
│       ├── ui.js          # User interface
│       ├── weapon.js      # Weapon system
│       ├── weapons.js     # Weapon configurations
│       └── zombie.js      # Zombie AI and mechanics
├── index.html       # Main HTML file
└── README.md       # This file
```

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
