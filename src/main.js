import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import SoundManager from './sound.js';
import { 
    gameState, 
    updateGameState, 
    switchWeapon, 
    reloadWeapon, 
    initializeGameState,
    getWaveInfo
} from './gameState.js';
import { initializeUI, updateUI, updateCrosshair, initializeMinimap, updateMinimap } from './ui.js';
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
    updateBullets,
    resetBullets,
    getBulletModel,
    addRemoteBullet,
    stopSmgSound
} from './weapons.js';
import { updateScreenShake } from './effects.js';
import * as ZombieSystem from './zombies.js';
// Import turret functionality
import {
    createSpawnTurrets,
    updateTurrets,
    cleanupTurrets
} from './turrets.js';
// Import networking functionality
import { 
    initializeNetworking, 
    sendPlayerUpdate, 
    getRemotePlayerCount, 
    getRemotePlayers, 
    cleanupNetworking, 
    updateNetworking, 
    setPlayerName,
    createPlayerNameTag
} from './network.js';
// Import chat functionality
import { initializeChat } from './chat.js';

// DOM elements
const welcomeScreen = document.getElementById('welcome-screen');
const usernameInput = document.getElementById('username');
const joinGameBtn = document.getElementById('join-game-btn');
const uiContainer = document.getElementById('ui-container');
const gameOverScreen = document.getElementById('game-over-screen');
const restartGameBtn = document.getElementById('restart-game-btn');

// Flag to track if game is starting
let isGameStarting = false;

// Hide UI container and game over screen initially
uiContainer.style.display = 'none';
gameOverScreen.style.display = 'none';

// Welcome screen event handlers
joinGameBtn.addEventListener('click', startGame);
usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        startGame();
    }
});

// Game over screen event handlers
restartGameBtn.addEventListener('click', restartGame);

// Wave event listener
document.addEventListener('waveStart', handleWaveStart);

// Variables to store initialized game objects
let ui, input, scene, camera, renderer, raycaster, groundPlane, 
    groundIntersectPoint, environment, player, chat;

// Add a multiplayer status element to the UI
let multiplayerStatusElement = null;

// Add a variable for the turrets
let turrets = [];

// Function to initialize the scene and renderer
async function initializeScene() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, 0.005);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 25, 0);
    camera.lookAt(0, 0, 0);

    scene.camera = camera;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    document.getElementById('gameContainer').appendChild(renderer.domElement);

    // Initialize CSS2DRenderer for player nametags
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('gameContainer').appendChild(labelRenderer.domElement);
    
    // Store the labelRenderer for use in the animation loop
    window.labelRenderer = labelRenderer;

    // Create a raycaster for mouse interaction
    raycaster = new THREE.Raycaster();
    groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    groundIntersectPoint = new THREE.Vector3();

    // Set up window resize handler
    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
    }

    // Set up input handlers
    setupResizeListener(onWindowResize);

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
    
    return {
        scene,
        camera,
        renderer,
        raycaster,
        groundPlane,
        groundIntersectPoint
    };
}

// Initialize the scene but don't start the game loop yet
initializeScene();

// Function to start the game after username is entered
async function startGame() {
    // Prevent multiple clicks
    if (isGameStarting) return;
    
    // Get the username
    const username = usernameInput.value.trim();
    
    // Validate username (non-empty)
    if (!username) {
        // Add a simple shake animation for invalid input
        usernameInput.classList.add('shake');
        setTimeout(() => {
            usernameInput.classList.remove('shake');
        }, 500);
        return;
    }
    
    // Set starting flag and disable button
    isGameStarting = true;
    joinGameBtn.disabled = true;
    joinGameBtn.style.opacity = '0.6';
    joinGameBtn.style.cursor = 'not-allowed';
    joinGameBtn.textContent = 'STARTING...';
    
    // Store username in game state
    gameState.playerName = username;
    
    try {
        // Initialize audio and play ambient sounds now that we have user interaction
        await SoundManager.playRainAmbience();
        
        // Hide welcome screen with a fade-out effect
        welcomeScreen.style.opacity = '0';
        welcomeScreen.style.transition = 'opacity 1s ease-out';
        
        // Wait for the fade-out animation to complete
        setTimeout(() => {
            // Hide welcome screen
            welcomeScreen.style.display = 'none';
            
            // Show UI
            uiContainer.style.display = 'block';
            
            // Initialize and start the game
            initializeGame();
        }, 1000);
    } catch (error) {
        console.error("Failed to initialize audio:", error);
        // Continue with the game even if audio fails
        welcomeScreen.style.opacity = '0';
        welcomeScreen.style.transition = 'opacity 1s ease-out';
        
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            uiContainer.style.display = 'block';
            initializeGame();
        }, 1000);
    }
}

// Full game initialization and start
async function initializeGame() {
    // Initialize game state
    initializeGameState();
    
    // Initialize UI
    ui = initializeUI();
    // Initialize minimap
    initializeMinimap(ui);

    // Initialize input
    input = initializeInput();

    // Create environment
    environment = createEnvironment(scene, camera);

    // Make obstacles available globally for zombie collision detection
    window.environmentObstacles = environment.obstacles || [];
    
    // Make scene globally available for network code
    window.gameScene = scene;

    // Create player
    player = initializePlayer(scene, gameState);

    // Create turrets at player spawn position
    turrets = createSpawnTurrets(scene, player.position);
    console.log(`Created ${turrets.length} automatic turrets near player spawn`);

    // Make gameState available globally for network code
    window.gameState = gameState;
    
    // Make bullet-related functions available globally for network code
    window.getBulletModel = getBulletModel;
    window.addRemoteBullet = addRemoteBullet;

    // Initialize multiplayer networking
    try {
        await initializeNetworking((playerCount) => {
            updateMultiplayerStatus(playerCount);
        }, scene);
        console.log('Networking initialized successfully');
        
        // Make sendPlayerUpdate available globally for weapon firing updates
        window.sendPlayerUpdate = sendPlayerUpdate;
        
        // Send player name to the server
        if (gameState.playerName) {
            setPlayerName(gameState.playerName);
        }
        
        // Initialize chat after networking is set up
        chat = initializeChat();
        
    } catch (error) {
        console.error('Failed to initialize networking:', error);
        // Continue with single-player mode if networking fails
    }

    // Set up mouse listeners for crosshair and shooting
    setupMouseListeners(input, {
        onMouseMove: (clientMousePosition) => {
            updateCrosshair(ui, clientMousePosition);
        },
        onMouseClick: () => {
            // Only allow shooting if not typing in chat
            if (!chat || !chat.isTyping()) {
                handleShooting(input, player, scene, gameState);
            }
        },
        onMouseUp: () => {
            // Stop the SMG sound when mouse is released for Assault Rifle
            if (gameState.weapon && gameState.weapon.name === "Assault Rifle") {
                stopSmgSound();
                
                // Send a network update to inform other clients that we've stopped firing
                sendPlayerUpdate(player, false, gameState.weapon.name);
                console.log("Sent stop firing update for Assault Rifle");
            }
        }
    });

    // Set up keyboard listeners for weapon switching and reloading
    setupKeyboardListeners(input, {
        onReload: () => {
            // Only allow reloading if not typing in chat
            if (!chat || !chat.isTyping()) {
                handleReload(player, reloadWeapon, gameState);
            }
        },
        onWeaponSwitch: (weaponIndex) => {
            // Only allow weapon switching if not typing in chat
            if (!chat || !chat.isTyping()) {
                handleWeaponSwitch(player, weaponIndex, switchWeapon, gameState);
            }
        }
    });

    // Create wave display UI if it doesn't exist
    createWaveUI();

    // Start the animation loop
    renderer.setAnimationLoop(animate);
    
    // Add Z key for spawning zombies (for debugging/testing)
    window.addEventListener('keydown', (event) => {
        // Skip if typing in chat
        if (chat && chat.isTyping()) return;
        
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
}

// Create UI elements for wave display
function createWaveUI() {
    // Check if wave UI already exists
    if (document.getElementById('wave-display')) return;
    
    // Create wave panel
    const wavePanel = document.createElement('div');
    wavePanel.id = 'wave-panel';
    wavePanel.className = 'ui-panel';
    
    // Create wave display
    const waveDisplay = document.createElement('div');
    waveDisplay.id = 'wave-display';
    waveDisplay.className = 'wave-text';
    waveDisplay.textContent = 'Wave: 1';
    
    // Create zombies remaining display
    const zombiesDisplay = document.createElement('div');
    zombiesDisplay.id = 'zombies-remaining';
    zombiesDisplay.className = 'wave-text';
    zombiesDisplay.textContent = 'Zombies: 0';
    
    // Create next wave countdown display
    const countdownDisplay = document.createElement('div');
    countdownDisplay.id = 'wave-countdown';
    countdownDisplay.className = 'wave-text';
    countdownDisplay.textContent = 'Next Wave: --';
    countdownDisplay.style.display = 'none'; // Hidden initially
    
    // Add elements to panel
    wavePanel.appendChild(waveDisplay);
    wavePanel.appendChild(zombiesDisplay);
    wavePanel.appendChild(countdownDisplay);
    
    // Add to UI container
    uiContainer.appendChild(wavePanel);
    
    // Note: Styles are now in /public/css/game-ui.css
}

// Update wave UI elements
function updateWaveUI() {
    const waveInfo = getWaveInfo();
    
    // Update wave display
    const waveDisplay = document.getElementById('wave-display');
    if (waveDisplay) {
        waveDisplay.textContent = `Wave: ${waveInfo.currentWave}`;
    }
    
    // Update zombies remaining
    const zombiesDisplay = document.getElementById('zombies-remaining');
    if (zombiesDisplay) {
        zombiesDisplay.textContent = `Zombies: ${waveInfo.zombiesRemaining}`;
    }
    
    // Update countdown to next wave
    const countdownDisplay = document.getElementById('wave-countdown');
    if (countdownDisplay) {
        if (waveInfo.waveInProgress) {
            countdownDisplay.style.display = 'none';
        } else {
            countdownDisplay.style.display = 'block';
            countdownDisplay.textContent = `Next Wave: ${waveInfo.nextWaveCountdown}s`;
        }
    }
}

// Handle wave start event
function handleWaveStart(event) {
    const { wave, zombieCount } = event.detail;
    
    console.log(`Starting wave ${wave} with ${zombieCount} zombies`);
    
    // Add visual wave start effect
    const waveDisplay = document.getElementById('wave-display');
    if (waveDisplay) {
        waveDisplay.classList.remove('wave-start');
        void waveDisplay.offsetWidth; // Force reflow to restart animation
        waveDisplay.classList.add('wave-start');
    }
    
    // Spawn zombies for the new wave in groups around the player
    const playerPosition = player.position.clone();
    
    // Determine how many spawn groups to create (more for higher waves)
    const minGroups = 2;
    const maxGroups = Math.min(5, 2 + Math.floor(wave / 3));
    const spawnGroups = Math.floor(Math.random() * (maxGroups - minGroups + 1)) + minGroups;
    
    // Calculate zombies per group
    const zombiesPerGroup = Math.ceil(zombieCount / spawnGroups);
    
    // Generate spawn positions around player
    const spawnPositions = ZombieSystem.generateSpawnPointsAroundPlayer(
        player, 20, 30, spawnGroups
    );
    
    // Spawn zombies at each point
    spawnPositions.forEach((position, index) => {
        // For the last group, make sure we don't spawn more than the total count
        const zombiesInThisGroup = (index === spawnPositions.length - 1) 
            ? zombieCount - (index * zombiesPerGroup) 
            : zombiesPerGroup;
            
        if (zombiesInThisGroup > 0) {
            setTimeout(() => {
                ZombieSystem.spawnZombieHorde(scene, position, zombiesInThisGroup, player);
            }, index * 500); // Stagger spawning of groups
        }
    });
}

// Update the animate function to include time delta for animations
let lastTime = 0;

function animate(time) {
    const deltaTime = (lastTime === 0) ? 0 : Math.min(0.05, (time - lastTime) / 1000);
    lastTime = time;
    
    // Increment frame count
    gameState.frameCount++;
    gameState.gameTime += deltaTime;

    // Check if game is over
    if (gameState.health <= 0 && !gameState.gameOver) {
        handleGameOver();
        return;
    }
    
    // Skip rendering if game over
    if (gameState.gameOver) {
        return;
    }
    
    // Update game state
    updateGameState(deltaTime, input.keys);
    
    // Handle automatic weapon firing if mouse is held down
    if (input.mouseDown && gameState.weapon && gameState.weapon.isAutomatic) {
        // Only attempt to fire if not typing in chat
        if (!chat || !chat.isTyping()) {
            handleShooting(input, player, scene, gameState);
        }
    }
    
    // Update player movement and direction
    const direction = updatePlayerAndFlashlight(deltaTime);
    
    // Update bullets
    updateBullets(scene, ZombieSystem.getZombies());
    
    // Update screen shake
    updateScreenShake(camera);
    
    // Update zombies
    ZombieSystem.updateZombies(deltaTime);
    
    // Update turrets to target and shoot zombies
    updateTurrets(deltaTime, scene, ZombieSystem.getZombies());
    
    // Periodically cleanup dead zombies
    if (gameState.frameCount % 120 === 0) {
        ZombieSystem.cleanupDeadZombies(scene);
    }
    
    // Apply screen shake effect if enabled
    if (gameState.screenShake > 0) {
        // Apply screen shake
        const shakeIntensity = gameState.screenShake;
        camera.position.x += (Math.random() - 0.5) * shakeIntensity * 0.1;
        camera.position.y += (Math.random() - 0.5) * shakeIntensity * 0.1;
        camera.position.z += (Math.random() - 0.5) * shakeIntensity * 0.1;
        
        // Decay screen shake
        gameState.screenShake *= 0.9;
        if (gameState.screenShake < 0.01) {
            gameState.screenShake = 0;
        }
    }
    
    // Update UI elements
    updateUI(ui, gameState);
    
    // Update wave UI
    updateWaveUI();
    
    // Update minimap
    if (direction) {
        updateMinimap(ui, player.position, direction, window.environmentObstacles, ZombieSystem.getZombies(), getRemotePlayers());
    }
    
    // Update networking (update other players, send position updates)
    updateNetworking();
    
    // Update rain if active
    updateRain(environment.rainParticles, player.position);
    
    // Always render even when not focused (shows last frame)
    renderer.render(scene, camera);
    
    // Update labels renderer
    window.labelRenderer.render(scene, camera);
}

// Update the updatePlayerAndFlashlight function to send position updates to the server
function updatePlayerAndFlashlight(deltaTime) {
    // Don't update movement if typing in chat
    const isTypingInChat = chat && chat.isTyping();
    
    // Update player movement and get direction
    const direction = updatePlayerMovement(
        player, 
        input, 
        gameState, 
        deltaTime, 
        raycaster, 
        groundPlane, 
        groundIntersectPoint, 
        { camera },
        isTypingInChat // Pass typing state to prevent movement while typing
    );
    
    // Send player position update to server
    // More frequent updates in the first 5 seconds to ensure initial position is set
    const shouldSendUpdate = gameState.gameTime < 5.0 ? 
        (gameState.frameCount % 2 === 0) : // Every 2 frames during first 5 seconds
        (gameState.frameCount % 6 === 0);  // Every 6 frames after that
    
    if (shouldSendUpdate) {
        // For normal position updates, explicitly set isFiring to false
        // Weapon firing updates are sent separately in handleShooting
        sendPlayerUpdate(player, false, gameState.weapon ? gameState.weapon.name : null);
    }
    
    // Update flashlight
    updateFlashlight(environment.flashlight, player.position, direction);
    
    // Update camera position to follow player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 25;
    camera.lookAt(player.position);
    
    // Return direction for minimap
    return direction;
}

// Function to restart the game after game over
function restartGame() {
    // Clean up resources
    cleanupResources();
    
    // Reset game state
    resetGame();
    
    // Start new game
    startGame();
}


// Function to update the multiplayer status display
function updateMultiplayerStatus(remotePlayerCount) {
    if (multiplayerStatusElement) {
        multiplayerStatusElement.textContent = `${remotePlayerCount + 1}`; // +1 for local player
    }
}

// Function to clean up resources when restarting or exiting the game
function cleanupResources() {
    // Reset game state
    initializeGameState();
    
    // Reset bullets before clearing zombies
    resetBullets(scene);
    
    // Clean up turrets
    cleanupTurrets(scene);
    
    // Clear existing zombies
    while (ZombieSystem.getZombies().length > 0) {
        const zombie = ZombieSystem.getZombies()[0];
        scene.remove(zombie);
        ZombieSystem.getZombies().splice(0, 1);
    }
    
    // Reset player position
    player.position.set(0, 1, 0);
    
    // Reset player health and UI
    updateUI(ui, gameState);
    
    // Reset restart button for future use
    setTimeout(() => {
        restartGameBtn.disabled = false;
        restartGameBtn.style.opacity = '1';
        restartGameBtn.style.cursor = 'pointer';
        restartGameBtn.textContent = 'TRY AGAIN';
    }, 1000);
    
    // Clean up networking resources
    cleanupNetworking();
}
