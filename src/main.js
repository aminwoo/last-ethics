import * as THREE from 'three';
import SoundManager from './sound.js';
import { gameState, updateGameState, switchWeapon, reloadWeapon } from './gameState.js';
import { initializeUI, updateUI, updateCrosshair } from './ui.js';
import { initializeInput, setupKeyboardListeners, setupMouseListeners, setupResizeListener } from './input.js';
import { 
    initializePlayer, 
    updatePlayerMovement
} from './player.js';
import {
    createEnvironment,
    updateRain,
    updateFlashlight
} from './environment.js';
import { 
    handleWeaponSwitch,
    handleReload,
    handleShooting,
    updateBullets
} from './weapons.js';
import { updateScreenShake } from './effects.js';
import * as ZombieSystem from './zombies.js';

SoundManager.playRainAmbience();

// Initialize UI
const ui = initializeUI();

// Initialize input
const input = initializeInput();

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 25, 0);
camera.lookAt(0, 0, 0);

scene.camera = camera;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.getElementById('gameContainer').appendChild(renderer.domElement);

// Create a raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundIntersectPoint = new THREE.Vector3();

// Set up window resize handler
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Set up input handlers
setupResizeListener(onWindowResize);

// Create environment
const environment = createEnvironment(scene, camera);

// Make obstacles available globally for zombie collision detection
window.environmentObstacles = environment.obstacles || [];

// Create player
const player = initializePlayer(scene, gameState);

// Spawn initial zombies
function spawnInitialZombies() {
    // Spawn a horde of zombies at different positions
    ZombieSystem.spawnZombieHorde(scene, new THREE.Vector3(10, 0, 10), 5, player);
    ZombieSystem.spawnZombieHorde(scene, new THREE.Vector3(-10, 0, -15), 5, player);
    ZombieSystem.spawnZombieHorde(scene, new THREE.Vector3(15, 0, -10), 3, player);
}


setupMouseListeners(input, {
    onMouseMove: (clientMousePosition) => {
        updateCrosshair(ui, clientMousePosition);
    },
    onMouseClick: () => handleShooting(input, player, scene, gameState)
});

setupKeyboardListeners(input, {
    onReload: () => handleReload(player, reloadWeapon, gameState),
    onWeaponSwitch: (weaponIndex) => handleWeaponSwitch(player, weaponIndex, switchWeapon, gameState)
});

// Add ambient light
const ambientLight = new THREE.AmbientLight(0x101010); // Very dim ambient light
scene.add(ambientLight);

// Create ground plane
const groundGeometry = new THREE.PlaneGeometry(500, 500);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x333333,
    roughness: 0.8,
    metalness: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
ground.receiveShadow = true;
scene.add(ground);

const gridHelper = new THREE.GridHelper(300, 300, 0x000000, 0x222222);
gridHelper.position.y = 0.0;
scene.add(gridHelper);

// Update the animate function to include time delta for animations
let lastTime = 0;

function animate(time) {
    const deltaTime = (lastTime === 0) ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    
    // Update player and flashlight
    updatePlayerAndFlashlight(deltaTime);
    
    // Update rain
    updateRain(environment.rainParticles, player.position);
    
    // Update game state
    updateGameState(deltaTime, input.keys);
    
    // Handle automatic weapons firing
    if (input.mouseDown && gameState.weapon && gameState.weapon.isAutomatic) {
        handleShooting(input, player, scene, gameState);
    }
        
    // Update bullets
    updateBullets(scene, ZombieSystem.getZombies());
    
    // Update zombies with delta time
    ZombieSystem.updateZombies(deltaTime);
    
    // Periodically cleanup dead zombies
    if (Math.random() < 0.01) { // Check roughly every 100 frames
        ZombieSystem.cleanupDeadZombies(scene);
    }

    // Apply screen shake effect
    updateScreenShake(camera);
    
    // Update UI
    updateUI(ui, gameState);
    
    // Render scene
    renderer.render(scene, camera);
}

// Update the updatePlayerAndFlashlight function to include animation
function updatePlayerAndFlashlight(deltaTime) {
    // Update player movement and get direction
    const direction = updatePlayerMovement(
        player, 
        input, 
        gameState, 
        deltaTime, 
        raycaster, 
        groundPlane, 
        groundIntersectPoint, 
        { camera }
    );
    
    // Update flashlight
    updateFlashlight(environment.flashlight, player.position, direction);
    
    // Update camera position to follow player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 25;
    camera.lookAt(player.position);
}

// Start the animation loop
renderer.setAnimationLoop(animate);

// In your key down handler or wherever keyboard input is handled
window.addEventListener('keydown', (event) => {
    // ... existing key handlers ...
    
    // Z key to spawn more zombies around the player
    if (event.key.toLowerCase() === 'z') {
        const playerPosition = player.position.clone();
        // Spawn zombies at a distance from the player in a random direction
        const spawnDistance = 15;
        const spawnPosition = new THREE.Vector3(
            playerPosition.x + (Math.random() * 2 - 1) * spawnDistance,
            0,
            playerPosition.z + (Math.random() * 2 - 1) * spawnDistance
        );
        
        // Spawn 3-8 zombies
        const zombieCount = Math.floor(Math.random() * 6) + 3;
        ZombieSystem.spawnZombieHorde(scene, spawnPosition, zombieCount, player);
        
        console.log(`Spawned ${zombieCount} zombies at distance ${spawnDistance}`);
    }
});
