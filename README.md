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
