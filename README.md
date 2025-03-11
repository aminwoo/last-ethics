# Last Ethics - Atmospheric Shooter

A browser-based 3D zombie survival shooter game built with Three.js. Fight through endless waves of zombies in a dark, atmospheric environment while managing your resources and surviving as long as possible.

## Features

- Three different weapons: Pistol, Shotgun, and SMG
- Dynamic weapon switching and reloading system
- Atmospheric effects including rain and thunder
- Wave-based zombie spawning with increasing difficulty
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

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/last-ethics.git
cd last-ethics
```

2. Start a local server (you can use Python's built-in server):
```bash
python -m http.server
```

3. Open your browser and navigate to `http://localhost:8000`

## Dependencies

- Three.js (r128) - Loaded via CDN

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
