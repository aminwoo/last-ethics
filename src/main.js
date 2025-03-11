import * as THREE from 'three';
import io from 'socket.io-client';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';


// Game variables
let scene, camera, renderer;
let player, playerModel, gunModel, bulletModel;
let floor;
let bullets = [];
let zombies = [];  // Array to store zombie entities
let lootableBodies = [];  // Array to store lootable bodies
let environmentObjects = [];  // Array to store environment objects
let keysPressed = {};
let mousePosition = { x: 0, y: 0 };
let clientMousePosition = { x: 0, y: 0 };
let isMouseDown = false;  // Track mouse button state
let rainParticles = [];
let flashlight, flashlightTarget;
let isFlashlightOn = true;
let mouseWorldPosition = new THREE.Vector3();
let isPaused = false;  // Track game pause state
let gameStarted = false;  // Track if game has started

// Thunder system
let thunderLight;
let isThundering = false;
const minThunderInterval = 5000;  // Minimum time between thunders (ms)
const maxThunderInterval = 15000; // Maximum time between thunders (ms)
const thunderDuration = 1500;     // Increased duration for longer effect

// Debug helpers
let debugObjects = [];
const DEBUG_MODE = false;

// Rain settings
const RAIN_COUNT = 10000;  // Increased rain count for larger area
const RAIN_AREA_SIZE = 300;  // Increased from 80 to 300
const RAIN_HEIGHT = 50;  // Increased height for better rain effect
const RAIN_SPEED = 0.3;  // Slightly increased rain speed

// Zombie settings
const ZOMBIE_SPAWN_INTERVAL = 500;  // Spawn zombies faster within waves
const BASE_ZOMBIE_SPEED = 0.05;     // Base speed that will increase with waves
const BASE_ZOMBIE_DAMAGE = 10;      // Base damage that will increase with waves
const BASE_ZOMBIE_HEALTH = 100;     // Base health that will increase with waves
const BULLET_DAMAGE = 50;           // Damage dealt by bullets
let lastZombieSpawn = 0;           // Track last spawn time

// Wave system
let currentWave = 0;
let waveActive = false;
let nextWaveTime = null;
let syncedZombies = new Map(); // Map to store synced zombies by ID

// Wave UI
const waveDisplay = document.createElement('div');
waveDisplay.style.position = 'fixed';
waveDisplay.style.top = '20px';
waveDisplay.style.left = '50%';
waveDisplay.style.transform = 'translateX(-50%)';
waveDisplay.style.color = 'white';
waveDisplay.style.fontSize = '24px';
waveDisplay.style.fontWeight = 'bold';
waveDisplay.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
waveDisplay.style.zIndex = '1000';
document.body.appendChild(waveDisplay);

// Player stats
let playerSpeed = 0.1;
let sprintSpeed = 0.2;  // Sprint is twice as fast
let currentAmmo = 14;    // Increased to 14 bullets per magazine
let maxAmmo = 14;        // Magazine size increased to 14
let totalAmmo = 98;      // 7 additional full magazines (14 * 7 = 98) + 14 in gun = 112 total
let health = 100;
let isReloading = false;

// Weapon configurations
const WEAPONS = {
    pistol: {
        name: "Pistol",
        damage: 50,
        fireRate: 250, // ms between shots
        spread: 0.02,
        bulletsPerShot: 1,
        maxAmmo: 14,
        totalAmmo: 98,
        reloadTime: 2000,
        bulletSpeed: 2.0,
        bulletSize: 0.03,
        bulletLength: 0.3,
        color: 0xffffaa
    },
    shotgun: {
        name: "Shotgun",
        damage: 25,
        fireRate: 800,
        spread: 0.15,
        bulletsPerShot: 8,
        maxAmmo: 6,
        totalAmmo: 24,
        reloadTime: 2500,
        bulletSpeed: 1.0,
        bulletSize: 0.02,
        bulletLength: 0.2,
        color: 0xffff00
    },
    smg: {
        name: "SMG",
        damage: 20,
        fireRate: 100,
        spread: 0.05,
        bulletsPerShot: 1,
        maxAmmo: 30,
        totalAmmo: 120,
        reloadTime: 1800,
        bulletSpeed: 2.5,
        bulletSize: 0.02,
        bulletLength: 0.25,
        color: 0x00ffff
    }
};

let currentWeapon = 'pistol';
let lastShotTime = 0;

// Stamina system
let stamina = 100;
let maxStamina = 100;
let staminaDrainRate = 0.5;    // How much stamina is lost per frame while sprinting
let staminaRegenRate = 0.2;    // How much stamina is recovered per frame while not sprinting
let canSprint = true;          // Whether the player has enough stamina to sprint
let staminaRegenDelay = 1000;  // Time in ms before stamina starts regenerating
let lastSprintTime = 0;        // Track when the player last sprinted

// Looting system
let isLooting = false;
let lootingProgress = 0;
let lootingTarget = null;
const LOOTING_DURATION = 3000;  // 3 seconds to loot
const LOOTING_RANGE = 3;  // Distance within which player can loot
const LOOT_AMMO_MIN = 5;  // Minimum ammo from looting
const LOOT_AMMO_MAX = 15; // Maximum ammo from looting

// Environment settings
const ENVIRONMENT_OBJECTS = [
    {
        type: 'car',
        geometry: new THREE.BoxGeometry(4, 2, 2),
        material: new THREE.MeshStandardMaterial({ color: 0x444444 }),
        count: 8  // Increased from 2 to 8
    },
    {
        type: 'barrier',
        geometry: new THREE.BoxGeometry(2, 1, 0.5),
        material: new THREE.MeshStandardMaterial({ color: 0x888888 }),
        count: 4  // Increased from 1 to 4
    }
];

// Bullet physics settings
const BULLET_SPEED = 2.0;         // Increased bullet speed
const BULLET_GRAVITY = 0.05;      // Bullet drop
const BULLET_LIFE_TIME = 1000;    // Bullet lifetime in ms
const BULLET_TRAIL_LENGTH = 10;   // Length of bullet trail

// Muzzle flash settings
let muzzleFlash = null;
const MUZZLE_FLASH_DURATION = 50; // Duration in ms
let lastMuzzleFlashTime = 0;

// Screen shake settings
let screenShake = {
    intensity: 0,
    decay: 0.9,
    maxOffset: 0.5,
    trauma: 0
};

// Add at the top with other game variables
let reloadSound;
let pistolShotSound;
let shotgunShotSound;
let smgShotSound;
let isSmgFiring = false;  // Track if SMG is currently firing

// Add after other game variables
let socket;
let playerID;
let playerName = '';
let otherPlayers = new Map(); // Map to store other players

// Add to game variables
let labelRenderer;

// Add after other socket variables
let chatSocket;
let otherPlayerBullets = new Map(); // Map to store other players' bullets

// Add after init() but before startGame()
function initMultiplayer() {
    socket = io(SOCKET_SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
    });

    // Initialize chat socket
    chatSocket = io(SOCKET_SERVER_URL + '/chat', {
        transports: ['websocket']
    });

    chatSocket.on('connect', () => {
        console.log('Connected to chat namespace');
        chatSocket.emit('setName', playerName);
    });

    chatSocket.on('recieved-message', (sender, message, time) => {
        addChatMessage(sender, message, time);
    });

    // Add chat input event listener
    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter' && chatInput.value.trim()) {
            const message = chatInput.value.trim();
            const time = new Date().toLocaleTimeString();
            
            // Add own message to chat
            addChatMessage(playerName, message, time);
            
            // Send message to other players
            chatSocket.emit('send-message', message, time);
            
            // Clear input
            chatInput.value = '';
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server with ID:', socket.id);
        playerID = socket.id;
        isHost = playerName === 'ben';
    });

    socket.on('connect_error', (error) => {
        console.error('Connection error:', error);
    });

    socket.on('playerData', (players) => {
        // Update all players
        for (const playerData of players) {
            if (playerData.id !== playerID) {
                updateOrCreateOtherPlayer(playerData);
            }
        }
    });

    socket.on('removePlayer', (id) => {
        console.log('Player disconnected:', id);
        const otherPlayer = otherPlayers.get(id);
        if (otherPlayer) {
            // Remove flashlight and target
            scene.remove(otherPlayer.userData.flashlight);
            scene.remove(otherPlayer.userData.flashlightTarget);
            
            // Remove all children (including name label) and the player model
            while (otherPlayer.children.length > 0) {
                const child = otherPlayer.children[0];
                otherPlayer.remove(child);
                if (child.material) {
                    child.material.dispose();
                }
                if (child.geometry) {
                    child.geometry.dispose();
                }
            }
            
            scene.remove(otherPlayer);
            otherPlayers.delete(id);
        }
    });

    // Send player updates
    setInterval(() => {
        if (player && playerName && socket.connected) {
            socket.emit('updatePlayer', {
                position: {
                    x: player.position.x,
                    y: player.position.y,
                    z: player.position.z
                },
                quaternion: [
                    player.quaternion.x,
                    player.quaternion.y,
                    player.quaternion.z,
                    player.quaternion.w
                ]
            });
        }
    }, 20);

    // Add new socket event handlers for enemy sync
    socket.on('initEnemies', (enemies) => {
        console.log('Received initial enemies:', enemies);
        enemies.forEach(enemyData => {
            createOrUpdateSyncedZombie(enemyData);
        });
    });

    socket.on('enemyAdded', (enemyData) => {
        console.log('Enemy added:', enemyData);
        createOrUpdateSyncedZombie(enemyData);
    });

    socket.on('enemyDeleted', (enemyId) => {
        console.log('Enemy deleted:', enemyId);
        const zombie = syncedZombies.get(enemyId);
        if (zombie) {
            scene.remove(zombie.mesh);
            scene.remove(zombie.healthBarGroup);
            syncedZombies.delete(enemyId);
        }
    });

    socket.on('enemyDamaged', (data) => {
        const zombie = syncedZombies.get(data.enemyId);
        if (zombie) {
            zombie.health = data.health;
            const healthPercent = zombie.health / zombie.maxHealth;
            zombie.healthBar.scale.x = Math.max(0, healthPercent);
            zombie.healthBar.position.x = -0.5 * (1 - healthPercent);
        }
    });

    socket.on('enemyDefeated', (data) => {
        const zombie = syncedZombies.get(data.enemyId);
        if (zombie) {
            scene.remove(zombie.mesh);
            scene.remove(zombie.healthBarGroup);
            syncedZombies.delete(data.enemyId);
            onZombieKilled(zombie);
        }
    });

    socket.on('enemyData', (enemies) => {
        enemies.forEach(enemyData => {
            const zombie = syncedZombies.get(enemyData.id);
            if (zombie) {
                // Update position and rotation
                zombie.mesh.position.set(
                    enemyData.position.x,
                    enemyData.position.y,
                    enemyData.position.z
                );
                zombie.mesh.quaternion.set(
                    enemyData.quaternion.x,
                    enemyData.quaternion.y,
                    enemyData.quaternion.z,
                    enemyData.quaternion.w
                );
                zombie.healthBarGroup.position.copy(zombie.mesh.position);
            }
        });
    });

    // Add new socket event handlers in initMultiplayer()
    socket.on('waveInfo', (data) => {
        currentWave = data.currentWave;
        waveActive = data.waveActive;
        nextWaveTime = data.nextWaveTime;
        updateWaveDisplay();
    });

    socket.on('waveStarted', (data) => {
        currentWave = data.wave;
        waveActive = true;
        nextWaveTime = null;
        console.log(`Wave ${currentWave} started with ${data.zombieCount} zombies`);
        updateWaveDisplay();
    });

    socket.on('waveCompleted', (data) => {
        waveActive = false;
        console.log(`Wave ${data.wave} completed!`);
        updateWaveDisplay();
    });

    socket.on('gameMessage', (message) => {
        console.log('Game message:', message);
        // You could add a UI element to show these messages
    });

    socket.on('waveStatus', (status) => {
        currentWave = status.wave;
        waveActive = status.active;
        nextWaveTime = status.nextWaveTime;
        updateWaveDisplay();
    });

    // Add player damage handler
    socket.on('playerDamaged', (data) => {
        health = data.health;
        updateHealthUI();
        showDamageEffect();
    });

    // Add to initMultiplayer() after other socket event listeners
    socket.on('playerShot', (data) => {
        console.log('Player shot:', data);
        const otherPlayer = otherPlayers.get(data.playerId);
        if (!otherPlayer) return;
        
        // Create bullet based on weapon type
        const weapon = WEAPONS[data.weapon];
        if (!weapon) return;

        // Create bullets based on weapon type
        for (let i = 0; i < weapon.bulletsPerShot; i++) {
            // Create bullet
            const bulletGeometry = new THREE.CylinderGeometry(
                weapon.bulletSize,
                weapon.bulletSize,
                weapon.bulletLength,
                8
            );
            bulletGeometry.rotateX(Math.PI / 2);
            
            const bulletMaterial = new THREE.MeshStandardMaterial({
                color: weapon.color,
                emissive: weapon.color,
                emissiveIntensity: 0.5,
                metalness: 0.8,
                roughness: 0.2
            });
            
            const bullet = new THREE.Mesh(bulletGeometry, bulletMaterial);
            
            // Position bullet at the other player's gun position
            const gunOffset = new THREE.Vector3(0.5, 1.5, 0.2);
            bullet.position.copy(otherPlayer.position).add(gunOffset);

            // Special handling for shotgun spread pattern
            if (weapon.name === "Shotgun") {
                // Create a circular pattern for pellets
                const angle = (i / weapon.bulletsPerShot) * Math.PI * 2;
                const radius = 0.1; // Initial spread radius
                bullet.position.x += Math.cos(angle) * radius;
                bullet.position.y += Math.sin(angle) * radius;
            }
                
            // Create bullet trail
            const trailGeometry = new THREE.BufferGeometry();
            const trailMaterial = new THREE.LineBasicMaterial({
                color: weapon.color,
                transparent: true,
                opacity: 0.5
            });
            const trailPositions = new Float32Array(BULLET_TRAIL_LENGTH * 3);
            
            // Initialize trail positions
            for (let j = 0; j < BULLET_TRAIL_LENGTH; j++) {
                trailPositions[j * 3] = bullet.position.x;
                trailPositions[j * 3 + 1] = bullet.position.y;
                trailPositions[j * 3 + 2] = bullet.position.z;
            }
            
            trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
            const trail = new THREE.Line(trailGeometry, trailMaterial);
            scene.add(trail);
            
            // Set bullet direction from the data
            const direction = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z).normalize();

            // Apply spread based on weapon type
            if (weapon.name === "Shotgun") {
                // Conical spread pattern
                const spreadAngle = weapon.spread * (1 - (i / weapon.bulletsPerShot)); // Tighter spread for center pellets
                direction.x += (Math.random() - 0.5) * spreadAngle;
                direction.y += (Math.random() - 0.5) * spreadAngle * 0.5; // Less vertical spread
                direction.z += (Math.random() - 0.5) * spreadAngle;
            } else {
                direction.x += (Math.random() - 0.5) * weapon.spread;
                direction.y += (Math.random() - 0.5) * weapon.spread;
                direction.z += (Math.random() - 0.5) * weapon.spread;
            }
            direction.normalize();
            
            // Rotate bullet to face direction
            bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
            
            // Add bullet to scene
            scene.add(bullet);

            // Store bullet data
            const bulletData = {
                mesh: bullet,
                trail: trail,
                trailPositions: trailPositions,
                direction: direction,
                velocity: direction.clone().multiplyScalar(
                    weapon.name === "Shotgun" 
                        ? weapon.bulletSpeed * (0.7 + Math.random() * 0.3) // Reduced speed variation from 0.8-1.2 to 0.7-1.0
                        : weapon.bulletSpeed
                ),
                speed: weapon.bulletSpeed,
                damage: weapon.damage,
                distance: 0,
                maxDistance: 50,
                createdAt: Date.now(),
                playerId: data.playerId
            };
            
            // Add to other player bullets map
            if (!otherPlayerBullets.has(data.playerId)) {
                otherPlayerBullets.set(data.playerId, []);
            }
            otherPlayerBullets.get(data.playerId).push(bulletData);
        }
        
        // Play weapon sound based on weapon type
        switch(data.weapon) {
            case 'pistol':
                const otherPistolSound = pistolShotSound.cloneNode();
                otherPistolSound.volume = 0.5; // Slightly quieter for other players
                otherPistolSound.play();
                break;
            case 'shotgun':
                const otherShotgunSound = shotgunShotSound.cloneNode();
                otherShotgunSound.volume = 0.4;
                otherShotgunSound.play();
                break;
            case 'smg':
                const otherSmgSound = smgShotSound.cloneNode();
                otherSmgSound.volume = 0.4;
                //otherSmgSound.play();
                break;
        }
        
        // Show muzzle flash for other player
        const otherPlayerGun = otherPlayer.children.find(child => child.isGroup && child.children.some(c => c.geometry instanceof THREE.BoxGeometry));
        if (otherPlayerGun) {
            const flash = createMuzzleFlashForPlayer();
            flash.position.copy(otherPlayerGun.position);
            flash.position.z += 0.5;
            otherPlayer.add(flash);
            
            setTimeout(() => {
                otherPlayer.remove(flash);
                flash.children.forEach(child => {
                    if (child.material) child.material.dispose();
                    if (child.geometry) child.geometry.dispose();
                });
            }, MUZZLE_FLASH_DURATION);
        }
    });
}

function updateOrCreateOtherPlayer(playerData) {
    if (playerData.id === playerID) return; // Don't create a mesh for our own player

    let otherPlayer = otherPlayers.get(playerData.id);
    
    if (!otherPlayer) {
        // Create player group
        otherPlayer = new THREE.Group();
        
        // Create player body
        const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff3366 }); // Different color to distinguish other players
        const playerModel = new THREE.Mesh(bodyGeometry, bodyMaterial);
        playerModel.position.y = 0.9;
        playerModel.castShadow = false;
        otherPlayer.add(playerModel);
        
        // Create player head
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 2.0;
        head.castShadow = false;
        otherPlayer.add(head);
        
        // Create gun
        const gunGroup = new THREE.Group();
        gunGroup.position.set(0.5, 1.5, 0.2);
        
        const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
        const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
        const gun = new THREE.Mesh(gunGeometry, gunMaterial);
        gun.position.z = 0.25;
        gunGroup.add(gun);
        
        otherPlayer.add(gunGroup);

        // Create flashlight for other player
        const flashlight = new THREE.SpotLight(0xffffff, 50, 35, Math.PI / 7, 0.5, 1);
        flashlight.position.set(0, 1.5, 0);
        
        // Create flashlight target
        const flashlightTarget = new THREE.Object3D();
        flashlightTarget.position.set(0, 0, -5);
        scene.add(flashlightTarget);
        flashlight.target = flashlightTarget;
        
        // Add flashlight and target to player data
        otherPlayer.userData.flashlight = flashlight;
        otherPlayer.userData.flashlightTarget = flashlightTarget;
        
        scene.add(flashlight);
        otherPlayer.add(flashlight);
        
        scene.add(otherPlayer);
        
        // Create name label
        const nameDiv = document.createElement('div');
        nameDiv.className = 'player-name';
        nameDiv.textContent = playerData.name;
        nameDiv.style.color = 'white';
        nameDiv.style.textShadow = '2px 2px 4px rgba(0,0,0,0.5)';
        const nameLabel = new CSS2DObject(nameDiv);
        nameLabel.position.set(0, 2.5, 0); // Position above player
        otherPlayer.add(nameLabel);
        
        otherPlayers.set(playerData.id, otherPlayer);
    }

    // Update position
    otherPlayer.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
    );

    // Update rotation using quaternion array
    otherPlayer.quaternion.set(
        playerData.quaternion.x,
        playerData.quaternion.y,
        playerData.quaternion.z,
        playerData.quaternion.w
    );

    // Update flashlight target position based on player's rotation
    const forward = new THREE.Vector3(0, 0, 5);
    forward.applyQuaternion(otherPlayer.quaternion);
    otherPlayer.userData.flashlightTarget.position.copy(otherPlayer.position).add(forward);
}

// Set up welcome screen
document.getElementById('startButton').addEventListener('click', () => {
    document.getElementById('welcomeScreen').style.display = 'none';
    document.getElementById('nameInputScreen').style.display = 'flex';
    document.getElementById('nameInput').focus();
});

// Add name input event listeners
document.getElementById('nameInput').addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        document.getElementById('joinButton').click();
    }
});

document.getElementById('joinButton').addEventListener('click', startGame);

function startGame() {
    const nameInput = document.getElementById('nameInput');
    playerName = nameInput.value.trim();
    
    if (!playerName) {
        alert('Please enter a name!');
        return;
    }
    
    document.getElementById('nameInputScreen').style.display = 'none';
    gameStarted = true;
    
    // Initialize game first
    init();
    
    // Then initialize multiplayer
    initMultiplayer();
    
    // Wait for socket connection before sending name
    socket.on('connect', () => {
        socket.emit('setName', playerName);
        console.log('Sent player name:', playerName);
    });
    
    chatSocket.on('connect', () => {socket.emit('setName', playerName);});
}

// Set up the scene
function init() {
    try {
        // Create chatbox
        const chatbox = document.createElement('div');
        chatbox.id = 'chatbox';
        chatbox.innerHTML = `
            <div id="chat-messages"></div>
            <div id="chat-input-container">
                <input type="text" id="chat-input" placeholder="Press Enter to chat...">
            </div>
        `;
        document.body.appendChild(chatbox);

        // Add chatbox styles
        const style = document.createElement('style');
        style.textContent = `
            #chatbox {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 300px;
                height: 200px;
                background-color: rgba(0, 0, 0, 0.7);
                border-radius: 5px;
                display: flex;
                flex-direction: column;
                z-index: 1000;
            }

            #chat-messages {
                flex-grow: 1;
                overflow-y: auto;
                padding: 10px;
                color: white;
                font-size: 14px;
            }

            #chat-input-container {
                padding: 10px;
                border-top: 1px solid rgba(255, 255, 255, 0.2);
            }

            #chat-input {
                width: 100%;
                padding: 5px;
                border: none;
                border-radius: 3px;
                background-color: rgba(255, 255, 255, 0.9);
                color: black;
            }

            .chat-message {
                margin-bottom: 5px;
                word-wrap: break-word;
            }

            .chat-message .sender {
                color: #4CAF50;
                font-weight: bold;
            }

            .chat-message .time {
                color: #888;
                font-size: 0.8em;
                margin-left: 5px;
            }
        `;
        document.head.appendChild(style);

        // Create scene
        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x050505); // Almost black
        
        // Initialize UI elements
        updateHealthUI();
        updatePlayerHealthBar();
        updateStaminaBar();
        
        // Load sounds
        reloadSound = new Audio('/assets/sounds/reload.mp3');
        reloadSound.volume = 1.0;
        
        pistolShotSound = new Audio('/assets/sounds/bulletshot-impact-sound-effect-230462.mp3');
        pistolShotSound.volume = 1.0;
        
        shotgunShotSound = new Audio('/assets/sounds/shotgun-sound.mp3');
        shotgunShotSound.volume = 0.8;
        
        smgShotSound = new Audio('/assets/sounds/ak-47.mp3');
        smgShotSound.volume = 1.0;  
        smgShotSound.loop = true;  // Enable looping for SMG sound
        
        // Create fog for atmospheric depth
        scene.fog = new THREE.FogExp2(0x050505, 0.015);
        
        // Setup thunder light (initially invisible)
        setupThunderSystem();
        
        // Create camera (top-down perspective)
        camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 25, 0);
        camera.lookAt(0, 0, 0);
        
        // Create renderer
        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('gameContainer').appendChild(renderer.domElement);
        
        // Setup CSS2D renderer for name tags
        labelRenderer = new CSS2DRenderer();
        labelRenderer.setSize(window.innerWidth, window.innerHeight);
        labelRenderer.domElement.style.position = 'absolute';
        labelRenderer.domElement.style.top = '0';
        labelRenderer.domElement.style.pointerEvents = 'none';
        document.getElementById('gameContainer').appendChild(labelRenderer.domElement);
        
        // Add minimal ambient light (very dark)
        const ambientLight = new THREE.AmbientLight(0x101010, 0.1);
        scene.add(ambientLight);
        
        // Create floor
        const floorGeometry = new THREE.PlaneGeometry(300, 300);
        const floorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            roughness: 0.9,
            metalness: 0.1
        });
        floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);
        
        // Create grid on floor (subtle, dark)
        const gridHelper = new THREE.GridHelper(300, 300, 0x000000, 0x222222);
        gridHelper.position.y = 0.01;
        scene.add(gridHelper);
        
        // Create rain particles
        createRain();
        
        // Create player
        createPlayer();
        
        // Create flashlight target
        flashlightTarget = new THREE.Object3D();
        flashlightTarget.position.set(0, 0, -5);
        scene.add(flashlightTarget);
        
        // Create bullet model (for reuse)
        const bulletGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
        bulletGeometry.rotateX(Math.PI / 2);  // Rotate to point forward
        const bulletMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xffffaa,
            emissive: 0xffff00,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        bulletModel = new THREE.Mesh(bulletGeometry, bulletMaterial);
        
        // Create muzzle flash
        createMuzzleFlash();
        
        // Create flashlight
        createFlashlight();
        
        // Set up event listeners
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('resize', onWindowResize);
        
        // Set up pause menu listeners
        document.getElementById('resumeButton').addEventListener('click', togglePause);
        document.getElementById('restartButton').addEventListener('click', restartGame);
        
        // If debug mode is on, create debug helpers
        if (DEBUG_MODE) {
            createDebugObjects();
        }
        
        // Create environment objects
        createEnvironmentObjects();
        
        // Start animation loop
        animate();
        
        console.log("Game initialized successfully");
    } catch (error) {
        console.error("Error initializing game:", error);
        document.getElementById('loadingMessage').style.display = 'block';
        document.getElementById('loadingMessage').textContent = 
            'Error initializing game: ' + error.message;
    }
}

function createDebugObjects() {
    // Create a visual indicator for mouse position
    const mouseMarkerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const mouseMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const mouseMarker = new THREE.Mesh(mouseMarkerGeometry, mouseMarkerMaterial);
    scene.add(mouseMarker);
    
    // Create a visual indicator for flashlight target
    const targetMarkerGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const targetMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const targetMarker = new THREE.Mesh(targetMarkerGeometry, targetMarkerMaterial);
    scene.add(targetMarker);
    
    debugObjects.push({
        mouseMarker: mouseMarker,
        targetMarker: targetMarker
    });
}

function createRain() {
    // Create rain droplet geometry (simple line)
    const rainGeometry = new THREE.BufferGeometry();
    const rainVertices = [];
    const rainVelocities = [];
    
    for (let i = 0; i < RAIN_COUNT; i++) {
        // Random position within the rain area
        const x = Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2;
        const z = Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2;
        const y = Math.random() * RAIN_HEIGHT;
        
        // Start and end points of the droplet (small vertical line)
        rainVertices.push(x, y, z);
        rainVertices.push(x, y - 0.5, z);
        
        // Velocity for the raindrops (mostly downward)
        rainVelocities.push(
            (Math.random() - 0.5) * 0.02, 
            -RAIN_SPEED - Math.random() * 0.1, 
            (Math.random() - 0.5) * 0.02
        );
    }
    
    rainGeometry.setAttribute(
        'position', 
        new THREE.Float32BufferAttribute(rainVertices, 3)
    );
    
    // Create a rain material
    const rainMaterial = new THREE.LineBasicMaterial({
        color: 0x8899aa,
        transparent: true,
        opacity: 0.4
    });
    
    // Create rain mesh
    const rain = new THREE.LineSegments(rainGeometry, rainMaterial);
    scene.add(rain);
    
    // Store rain data for animation
    rainParticles = {
        mesh: rain,
        velocities: rainVelocities,
        positions: rain.geometry.attributes.position.array
    };
}

function createFlashlight() {
    flashlight = new THREE.SpotLight(0xffffff, 50, 35, Math.PI / 7, 0.5, 1);  // Increased from 7.5 to 11.25
    flashlight.position.set(0, 1.5, 0); // Positioned at center of player
    scene.add(flashlight); // Add directly to scene, not to player
    flashlight.target = flashlightTarget;
    flashlight.castShadow = true;
    
    // Configure shadows for better quality
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    flashlight.shadow.camera.near = 0.5;
    flashlight.shadow.camera.far = 35;
    
    // Add a small point light at the flashlight position to create a glow effect
    const flashlightGlow = new THREE.PointLight(0xffffcc, 2.25, 3);  // Increased from 1.5 to 2.25
    flashlightGlow.position.copy(flashlight.position);
    scene.add(flashlightGlow);
}

function createPlayer() {
    // Create player group
    player = new THREE.Group();
    
    // Create player body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    playerModel = new THREE.Mesh(bodyGeometry, bodyMaterial);
    playerModel.position.y = 0.9;
    playerModel.castShadow = false;  // Remove shadow from body
    player.add(playerModel);
    
    // Create player head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.0;
    head.castShadow = false;  // Remove shadow from head
    player.add(head);
    
    // Create gun
    const gunGroup = new THREE.Group();
    gunGroup.position.set(0.5, 1.5, 0.2);
    
    const gunGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.5);
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    gunModel = new THREE.Mesh(gunGeometry, gunMaterial);
    gunModel.position.z = 0.25;
    gunGroup.add(gunModel);
    
    player.add(gunGroup);
    
    // Add player to scene
    scene.add(player);
    
    // Update UI
    updateAmmoUI();
    updateHealthUI();
}

function onKeyDown(event) {
    keysPressed[event.key.toLowerCase()] = true;
    
    // Handle Escape key for pause
    if (event.key === 'Escape') {
        togglePause();
        return;
    }
    
    // Only process other keys if game is not paused
    if (!isPaused) {
        // Weapon switching
        if (event.key === '1') switchWeapon('pistol');
        if (event.key === '2') switchWeapon('shotgun');
        if (event.key === '3') switchWeapon('smg');
        
        // Reload
        if (event.key.toLowerCase() === 'r' && !isReloading && currentAmmo < maxAmmo) {
            reload();
        }
        
        // Toggle flashlight
        if (event.key.toLowerCase() === 'f') {
            isFlashlightOn = !isFlashlightOn;
            flashlight.visible = isFlashlightOn;
        }
    }
}

function onKeyUp(event) {
    keysPressed[event.key.toLowerCase()] = false;
}

function onMouseMove(event) {
    // Calculate mouse position in normalized device coordinates
    mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
    mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update client mouse position for crosshair
    clientMousePosition.x = event.clientX;
    clientMousePosition.y = event.clientY;
    
    // Update crosshair position
    const crosshair = document.getElementById('crosshair');
    crosshair.style.left = clientMousePosition.x + 'px';
    crosshair.style.top = clientMousePosition.y + 'px';
}

function onMouseDown(event) {
    if (event.button === 0) { // Left click
        isMouseDown = true;
        shootBullet();
    }
}

function onMouseUp(event) {
    if (event.button === 0) { // Left click
        isMouseDown = false;
        // Stop SMG sound when mouse is released
        if (currentWeapon === 'smg' && isSmgFiring) {
            smgShotSound.pause();
            smgShotSound.currentTime = 0;
            isSmgFiring = false;
        }
    }
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

function getMouseWorldPosition() {
    // Create a ray from the camera through the mouse position
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mousePosition, camera);
    
    // Find intersection with the floor plane
    const planeNormal = new THREE.Vector3(0, 1, 0);
    const playerPlane = new THREE.Plane(planeNormal, 0); // Ground plane at y=0
    
    const intersectionPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(playerPlane, intersectionPoint);
    
    return intersectionPoint;
}

function updatePlayer() {
    // WASD movement
    let moveX = 0;
    let moveZ = 0;
    
    // Handle continuous firing for SMG
    if (isMouseDown && currentWeapon === 'smg') {
        shootBullet();
    }
    
    // Update stamina
    const currentTime = Date.now();
    if (keysPressed['shift'] && stamina > 0) {
        // Drain stamina while sprinting
        stamina = Math.max(0, stamina - staminaDrainRate);
        lastSprintTime = currentTime;
        if (stamina === 0) {
            canSprint = false;
        }
    } else if (!keysPressed['shift'] && stamina < maxStamina && 
                (currentTime - lastSprintTime > staminaRegenDelay)) {
        // Regenerate stamina when not sprinting and after delay
        stamina = Math.min(maxStamina, stamina + staminaRegenRate);
        if (stamina > 20) {  // Need at least 20% stamina to sprint again
            canSprint = true;
        }
    }
    
    updateStaminaBar();
    
    // Determine current speed (sprint or normal)
    const currentSpeed = (keysPressed['shift'] && canSprint) ? sprintSpeed : playerSpeed;
    
    if (keysPressed['w']) moveZ -= currentSpeed;
    if (keysPressed['s']) moveZ += currentSpeed;
    if (keysPressed['a']) moveX -= currentSpeed;
    if (keysPressed['d']) moveX += currentSpeed;
    
    // Apply movement with improved collision detection and sliding
    if (moveX !== 0 || moveZ !== 0) {
        const newPosition = new THREE.Vector3(
            player.position.x + moveX,
            player.position.y,
            player.position.z + moveZ
        );
        
        // Check collision and apply sliding if needed
        if (checkCollisionWithEnvironment(newPosition, 0.5)) {
            const slidePosition = slideAlongObstacle(player.position, moveX, moveZ);
            player.position.copy(slidePosition);
        } else {
            player.position.copy(newPosition);
        }
        
        // Keep player within bounds
        const boundaryLimit = 148;
        player.position.x = Math.max(-boundaryLimit, Math.min(boundaryLimit, player.position.x));
        player.position.z = Math.max(-boundaryLimit, Math.min(boundaryLimit, player.position.z));
    }
    
    // Get precise mouse world position
    mouseWorldPosition = getMouseWorldPosition();
    
    // Debug: set mouse marker position if in debug mode
    if (DEBUG_MODE && debugObjects.length > 0) {
        debugObjects[0].mouseMarker.position.copy(mouseWorldPosition);
    }
    
    // Rotate player body to aim gun toward mouse position
    const angleToMouse = Math.atan2(
        mouseWorldPosition.x - player.position.x,
        mouseWorldPosition.z - player.position.z
    );
    player.rotation.y = angleToMouse;
    
    // Update flashlight position to follow player
    flashlight.position.set(
        player.position.x,
        1.5, // Fixed height
        player.position.z
    );
    
    // Set flashlight target position based on mouse position, but ensure it's in front of the player
    const forward = new THREE.Vector3(
        mouseWorldPosition.x - player.position.x,
        0,  // Keep the light level
        mouseWorldPosition.z - player.position.z
    ).normalize().multiplyScalar(5);  // Project 5 units ahead
    
    flashlightTarget.position.copy(player.position).add(forward);
    flashlightTarget.position.y = 0.5; // Slightly above ground
    
    // Debug: set target marker position if in debug mode
    if (DEBUG_MODE && debugObjects.length > 0) {
        debugObjects[0].targetMarker.position.copy(flashlightTarget.position);
    }
    
    // Update camera position to follow player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 10;
    camera.lookAt(player.position);
}

function updateRain() {
    const positions = rainParticles.positions;
    const velocities = rainParticles.velocities;
    
    for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 6; // 2 points per raindrop, 3 values (x,y,z) per point
        const vidx = i * 3; // 3 velocity values per raindrop
        
        // Update positions with velocity
        positions[idx] += velocities[vidx];
        positions[idx + 1] += velocities[vidx + 1];
        positions[idx + 2] += velocities[vidx + 2];
        
        positions[idx + 3] += velocities[vidx];
        positions[idx + 4] += velocities[vidx + 1];
        positions[idx + 5] += velocities[vidx + 2];
        
        // Reset raindrop if it hits the ground
        if (positions[idx + 1] < 0) {
            // Random position within the rain area, centered on player
            positions[idx] = player.position.x + Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2;
            positions[idx + 1] = RAIN_HEIGHT;
            positions[idx + 2] = player.position.z + Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2;
            
            // End point of the line
            positions[idx + 3] = positions[idx];
            positions[idx + 4] = positions[idx + 1] - 0.5;
            positions[idx + 5] = positions[idx + 2];
        }
    }
    
    // Update the geometry
    rainParticles.mesh.geometry.attributes.position.needsUpdate = true;
}

function shootBullet() {
    const weapon = WEAPONS[currentWeapon];
    const currentTime = Date.now();
    
    // Check if enough time has passed since last shot
    if (currentTime - lastShotTime < weapon.fireRate) return;
    
    if (currentAmmo <= 0 || isReloading) {
        console.log("Click! Out of ammo");
        // Stop SMG sound if we run out of ammo
        if (currentWeapon === 'smg' && isSmgFiring) {
            smgShotSound.pause();
            smgShotSound.currentTime = 0;
            isSmgFiring = false;
        }
        return;
    }
    
    // Play weapon sound based on current weapon
    switch(currentWeapon) {
        case 'pistol':
            pistolShotSound.currentTime = 0;
            pistolShotSound.play();
            break;
        case 'shotgun':
            shotgunShotSound.currentTime = 0;
            shotgunShotSound.play();
            break;
        case 'smg':
            if (!isSmgFiring) {
                smgShotSound.currentTime = 0;
                smgShotSound.play();
                isSmgFiring = true;
            }
            break;
    }
    
    // Calculate initial direction to mouse position (before spread)
    const initialDirection = new THREE.Vector3();
    initialDirection.subVectors(mouseWorldPosition, player.position).normalize();
    
    // Fire multiple bullets for shotgun
    for (let i = 0; i < weapon.bulletsPerShot; i++) {
        // Create bullet with trail
        const bullet = bulletModel.clone();
        bullet.position.copy(player.position);
        bullet.position.y = 1.5;
        bullet.position.x += 0.5; // Offset to match gun position

        // Special handling for shotgun spread pattern
        if (weapon.name === "Shotgun") {
            // Create a circular pattern for pellets
            const angle = (i / weapon.bulletsPerShot) * Math.PI * 2;
            const radius = 0.1; // Initial spread radius
            bullet.position.x += Math.cos(angle) * radius;
            bullet.position.y += Math.sin(angle) * radius;
        }
        
        // Create bullet trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: weapon.color,
            transparent: true,
            opacity: 0.5
        });
        const trailPositions = new Float32Array(BULLET_TRAIL_LENGTH * 3);
        
        // Initialize all trail positions to bullet's starting position
        for (let j = 0; j < BULLET_TRAIL_LENGTH; j++) {
            trailPositions[j * 3] = bullet.position.x;
            trailPositions[j * 3 + 1] = bullet.position.y;
            trailPositions[j * 3 + 2] = bullet.position.z;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        
        // Calculate direction with spread
        const bulletDirection = initialDirection.clone();
        
        // Apply spread based on weapon type
        if (weapon.name === "Shotgun") {
            // Conical spread pattern
            const spreadAngle = weapon.spread * (1 - (i / weapon.bulletsPerShot)); // Tighter spread for center pellets
            bulletDirection.x += (Math.random() - 0.5) * spreadAngle;
            bulletDirection.y += (Math.random() - 0.5) * spreadAngle * 0.5; // Less vertical spread
            bulletDirection.z += (Math.random() - 0.5) * spreadAngle;
        } else {
            bulletDirection.x += (Math.random() - 0.5) * weapon.spread;
            bulletDirection.y += (Math.random() - 0.5) * weapon.spread;
            bulletDirection.z += (Math.random() - 0.5) * weapon.spread;
        }
        bulletDirection.normalize();
        
        // Rotate bullet to face direction
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bulletDirection);
        
        // Add bullet to scene and tracking array
        scene.add(bullet);
        bullets.push({
            mesh: bullet,
            trail: trail,
            trailPositions: trailPositions,
            direction: bulletDirection,
            velocity: bulletDirection.clone().multiplyScalar(
                weapon.name === "Shotgun" 
                    ? weapon.bulletSpeed * (0.7 + Math.random() * 0.3) // Reduced speed variation from 0.8-1.2 to 0.7-1.0
                    : weapon.bulletSpeed
            ),
            speed: weapon.bulletSpeed,
            damage: weapon.damage,
            distance: 0,
            maxDistance: 50,
            createdAt: currentTime
        });
    }
    
    // Show muzzle flash
    if (muzzleFlash) {
        muzzleFlash.visible = true;
        muzzleFlash.children[0].intensity = 3;
        muzzleFlash.children[1].material.opacity = 1;
        lastMuzzleFlashTime = currentTime;
    }
    
    // Add screen shake
    screenShake.trauma = Math.min(screenShake.trauma + (
        weapon.name === "Shotgun" ? 0.6 : 0.3
    ), 1.0);
    
    // Update ammo and timing
    currentAmmo--;
    lastShotTime = currentTime;
    updateAmmoUI();
    
    // Auto reload when empty if we have ammo left
    if (currentAmmo <= 0 && totalAmmo > 0) {
        reload();
    }

    // Emit shooting event to server using the initial direction
    socket.emit('playerShooting', {
        shooting: true,
        position: {
            x: player.position.x,
            y: player.position.y,
            z: player.position.z
        },
        direction: {
            x: initialDirection.x,
            y: initialDirection.y,
            z: initialDirection.z
        },
        weapon: currentWeapon
    });
}

function updateBullets() {
    const currentTime = Date.now();
    
    // Update all bullets
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        // Move bullet
        bullet.mesh.position.add(bullet.velocity);
        
        // Update bullet rotation to match velocity
        bullet.mesh.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            bullet.velocity.clone().normalize()
        );
        
        // Update trail
        const positions = bullet.trailPositions;
        // Shift old positions back
        for (let j = positions.length - 3; j >= 3; j -= 3) {
            positions[j] = positions[j - 3];
            positions[j + 1] = positions[j - 2];
            positions[j + 2] = positions[j - 1];
        }
        // Add new position
        positions[0] = bullet.mesh.position.x;
        positions[1] = bullet.mesh.position.y;
        positions[2] = bullet.mesh.position.z;
        bullet.trail.geometry.attributes.position.needsUpdate = true;
        
        // Update distance traveled
        bullet.distance += bullet.velocity.length();
        
        // Remove bullet if it's gone too far or too old
        if (bullet.distance > bullet.maxDistance || 
            currentTime - bullet.createdAt > BULLET_LIFE_TIME) {
            scene.remove(bullet.mesh);
            scene.remove(bullet.trail);  // Remove the trail from the scene
            bullets.splice(i, 1);
        }
    }
    
    // Update muzzle flash
    if (muzzleFlash && muzzleFlash.visible) {
        const timeSinceFlash = currentTime - lastMuzzleFlashTime;
        if (timeSinceFlash > MUZZLE_FLASH_DURATION) {
            muzzleFlash.visible = false;
        } else {
            const fadeRatio = 1 - (timeSinceFlash / MUZZLE_FLASH_DURATION);
            muzzleFlash.children[0].intensity = 3 * fadeRatio;  // Light fade
            muzzleFlash.children[1].material.opacity = fadeRatio;  // Mesh fade
        }
    }
    
    // Update screen shake
    if (screenShake.trauma > 0) {
        const shake = screenShake.trauma * screenShake.trauma;  // Quadratic falloff
        const angle = Math.random() * Math.PI * 2;
        const offsetX = Math.cos(angle) * shake * screenShake.maxOffset;
        const offsetZ = Math.sin(angle) * shake * screenShake.maxOffset;
        
        camera.position.x += offsetX;
        camera.position.z += offsetZ;
        
        screenShake.trauma *= screenShake.decay;
        if (screenShake.trauma < 0.01) screenShake.trauma = 0;
    }

    // Update other players' bullets
    for (const [playerId, bullets] of otherPlayerBullets) {
        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            
            // Move bullet
            bullet.mesh.position.add(bullet.velocity);
            
            // Update bullet rotation
            bullet.mesh.quaternion.setFromUnitVectors(
                new THREE.Vector3(0, 0, 1),
                bullet.velocity.clone().normalize()
            );
            
            // Update trail
            const positions = bullet.trailPositions;
            for (let j = positions.length - 3; j >= 3; j -= 3) {
                positions[j] = positions[j - 3];
                positions[j + 1] = positions[j - 2];
                positions[j + 2] = positions[j - 1];
            }
            positions[0] = bullet.mesh.position.x;
            positions[1] = bullet.mesh.position.y;
            positions[2] = bullet.mesh.position.z;
            bullet.trail.geometry.attributes.position.needsUpdate = true;
            
            // Update distance traveled
            bullet.distance += bullet.velocity.length();
            
            // Remove bullet if it's gone too far or too old
            if (bullet.distance > bullet.maxDistance || 
                currentTime - bullet.createdAt > BULLET_LIFE_TIME) {
                scene.remove(bullet.mesh);
                scene.remove(bullet.trail);
                bullets.splice(i, 1);
            }
        }
        
        // Remove empty bullet arrays
        if (bullets.length === 0) {
            otherPlayerBullets.delete(playerId);
        }
    }
}

function reload() {
    const weapon = WEAPONS[currentWeapon];
    if (isReloading || (currentAmmo === weapon.maxAmmo) || (totalAmmo === 0 && currentAmmo === 0)) return;
    
    isReloading = true;
    console.log("Reloading...");
    
    // Play reload sound
    reloadSound.currentTime = 0; // Reset sound to start
    reloadSound.play();
    
    // Show reloading indicator
    document.getElementById('reloadingIndicator').style.display = 'block';
    
    // Reload animation
    playerModel.material.color.set(0x999999);
    
    // Reload timer
    setTimeout(() => {
        // Calculate how many bullets we can reload
        const bulletsNeeded = weapon.maxAmmo - currentAmmo;
        const bulletsAvailable = Math.min(totalAmmo, bulletsNeeded);
        
        totalAmmo -= bulletsAvailable;
        currentAmmo += bulletsAvailable;
        
        isReloading = false;
        // Hide reloading indicator
        document.getElementById('reloadingIndicator').style.display = 'none';
        playerModel.material.color.set(0x3366ff);
        updateAmmoUI();
        
        // Stop the reload sound
        reloadSound.pause();
        reloadSound.currentTime = 0;
        
        if (bulletsAvailable === 0) {
            console.log("No ammo left!");
        } else {
            console.log("Reload complete");
        }
    }, weapon.reloadTime);
}

function updateAmmoUI() {
    const weapon = WEAPONS[currentWeapon];
    document.getElementById('ammo').textContent = `${weapon.name}: ${currentAmmo}/${weapon.maxAmmo} [${totalAmmo}]`;
}

function updateHealthUI() {
    document.getElementById('health').textContent = `Health: ${Math.max(0, Math.floor(health))}`;
    updatePlayerHealthBar();
    
    // Check for player death
    if (health <= 0) {
        // Emit death event to server
        socket.emit('playerDeath');
        // Show game over screen or handle death
        handlePlayerDeath();
    }
}

function updatePlayerHealthBar() {
    const healthBar = document.getElementById('playerHealthBar');
    const healthPercent = (health / 100) * 100;
    healthBar.style.width = `${healthPercent}%`;
    
    // Change color based on health level
    if (healthPercent > 60) {
        healthBar.style.backgroundColor = '#2ecc71'; // Green
    } else if (healthPercent > 30) {
        healthBar.style.backgroundColor = '#f1c40f'; // Yellow
    } else {
        healthBar.style.backgroundColor = '#e74c3c'; // Red
    }
}

function updateStaminaBar() {
    const staminaBar = document.getElementById('playerStaminaBar');
    const staminaPercent = (stamina / maxStamina) * 100;
    staminaBar.style.width = `${staminaPercent}%`;
    
    // Change color based on stamina level
    if (staminaPercent > 60) {
        staminaBar.style.backgroundColor = '#3498db'; // Blue
    } else if (staminaPercent > 30) {
        staminaBar.style.backgroundColor = '#e67e22'; // Orange
    } else {
        staminaBar.style.backgroundColor = '#e74c3c'; // Red
    }
}

function showDamageEffect() {
    const overlay = document.getElementById('damageOverlay');
    overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
    
    setTimeout(() => {
        overlay.style.backgroundColor = 'rgba(255, 0, 0, 0)';
    }, 100);
}

function setupThunderSystem() {
    // Create a bright directional light for thunder
    thunderLight = new THREE.DirectionalLight(0x9999ff, 0);  // Start with intensity 0
    thunderLight.position.set(0, 50, 0);
    scene.add(thunderLight);
    
    // Start the thunder cycle
    scheduleNextThunder();
}

function scheduleNextThunder() {
    // Random time until next thunder
    const nextThunder = minThunderInterval + Math.random() * (maxThunderInterval - minThunderInterval);
    
    setTimeout(() => {
        createThunderStrike();
    }, nextThunder);
}

function createThunderStrike() {
    if (isThundering) return;
    isThundering = true;
    
    // Random intensity for variation (very bright!)
    const intensity = 3 + Math.random() * 2;
    
    // Initial flash sequence
    const flashSequence = [
        { intensity: intensity, duration: 100 },      // Initial bright flash
        { intensity: intensity * 0.1, duration: 200 }, // Quick dim
        { intensity: intensity * 0.8, duration: 100 }, // Secondary flash
        { intensity: intensity * 0.2, duration: 300 }, // Slower fade
        { intensity: intensity * 0.6, duration: 150 }, // Another flash
        { intensity: intensity * 0.1, duration: 400 }, // Long fade
        { intensity: intensity * 0.3, duration: 150 }, // Final flicker
        { intensity: 0, duration: 100 }               // Complete darkness
    ];
    
    let currentStep = 0;
    
    function executeFlashStep() {
        if (currentStep >= flashSequence.length) {
            isThundering = false;
            scheduleNextThunder();
            return;
        }
        
        const step = flashSequence[currentStep];
        thunderLight.intensity = step.intensity;
        
        currentStep++;
        setTimeout(executeFlashStep, step.duration);
    }
    
    executeFlashStep();
}

function updateWaveDisplay() {
    if (currentWave === 0) {
        waveDisplay.textContent = 'Waiting for players...';
    } else if (!waveActive && nextWaveTime) {
        const timeLeft = Math.ceil((nextWaveTime - Date.now()) / 1000);
        waveDisplay.textContent = `Wave ${currentWave} completed! Next wave in ${timeLeft}s`;
    } else {
        waveDisplay.textContent = `Wave ${currentWave}`;
    }
    waveDisplay.style.animation = 'fadeIn 2s';
}

function createOrUpdateSyncedZombie(enemyData) {
    if (syncedZombies.has(enemyData.id)) {
        // Update existing zombie
        const zombie = syncedZombies.get(enemyData.id);
        zombie.mesh.position.set(
            enemyData.position.x,
            enemyData.position.y,
            enemyData.position.z
        );
        zombie.mesh.quaternion.set(
            enemyData.quaternion.x,
            enemyData.quaternion.y,
            enemyData.quaternion.z,
            enemyData.quaternion.w
        );
        zombie.health = enemyData.health;
        zombie.maxHealth = enemyData.maxHealth;
        zombie.speed = enemyData.speed;
        zombie.damage = enemyData.damage;

        // Update health bar
        const healthPercent = zombie.health / zombie.maxHealth;
        zombie.healthBar.scale.x = Math.max(0, healthPercent);
        zombie.healthBar.position.x = -0.5 * (1 - healthPercent);
        return;
    }

    // Create new zombie group
    const zombie = new THREE.Group();
    
    // Adjust zombie appearance based on type
    let zombieColor;
    let scale = 1;
    switch(enemyData.type) {
        case 'fast':
            zombieColor = new THREE.Color(0.8, 0.2, 0.2); // Red
            scale = 0.8;
            break;
        case 'tank':
            zombieColor = new THREE.Color(0.2, 0.2, 0.8); // Blue
            scale = 1.5;
            break;
        case 'boss':
            zombieColor = new THREE.Color(0.8, 0.1, 0.8); // Purple
            scale = 2;
            break;
        default: // normal
            zombieColor = new THREE.Color(0.176, 0.361, 0.118); // Original green
            break;
    }
    
    // Create zombie body
    const bodyGeometry = new THREE.CylinderGeometry(0.5 * scale, 0.5 * scale, 2 * scale, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: zombieColor });
    const zombieModel = new THREE.Mesh(bodyGeometry, bodyMaterial);
    zombieModel.position.y = 1 * scale;
    zombie.add(zombieModel);
    
    // Create zombie head
    const headGeometry = new THREE.SphereGeometry(0.3 * scale, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: zombieColor.clone().multiplyScalar(0.8) });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.2 * scale;
    zombie.add(head);

    // Health bar setup
    const healthBarGroup = new THREE.Group();
    scene.add(healthBarGroup);

    const healthBarBgGeometry = new THREE.PlaneGeometry(1, 0.1);
    const healthBarBgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const healthBarBg = new THREE.Mesh(healthBarBgGeometry, healthBarBgMaterial);
    healthBarBg.position.y = 2.8 * scale;
    healthBarGroup.add(healthBarBg);

    const healthBarGeometry = new THREE.PlaneGeometry(1, 0.1);
    const healthBarMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const healthBarFill = new THREE.Mesh(healthBarGeometry, healthBarMaterial);
    healthBarFill.position.y = 2.8 * scale;
    healthBarFill.position.z = 0.01;
    healthBarGroup.add(healthBarFill);

    // Set position and add to scene
    zombie.position.copy(enemyData.position);
    healthBarGroup.position.copy(enemyData.position);
    scene.add(zombie);

    // Store zombie data
    syncedZombies.set(enemyData.id, {
        mesh: zombie,
        health: enemyData.health,
        maxHealth: enemyData.maxHealth,
        speed: enemyData.speed,
        damage: enemyData.damage,
        type: enemyData.type,
        model: zombieModel,
        healthBarGroup: healthBarGroup,
        healthBar: healthBarFill
    });
}

function updateZombies() {
    // Update each zombie's health bar position and rotation
    for (const [enemyId, zombie] of syncedZombies) {
        zombie.healthBarGroup.position.copy(zombie.mesh.position);
        zombie.healthBarGroup.rotation.y = camera.rotation.y;
        
        // Check collision with player
        const distanceToPlayer = zombie.mesh.position.distanceTo(player.position);
        if (distanceToPlayer < 2 && !isInvincible) {
            // Emit player damage event to server
            socket.emit('playerDamage', { damage: zombie.damage });
            health -= zombie.damage;
            updatePlayerHealthBar();
            showDamageEffect();
            updateHealthUI();
            
            // Start invincibility period
            isInvincible = true;
            playerModel.material.transparent = true;
            playerModel.material.opacity = 0.5;
            
            setTimeout(() => {
                isInvincible = false;
                playerModel.material.transparent = false;
                playerModel.material.opacity = 1.0;
            }, INVINCIBILITY_DURATION);
        }
        
        // Bullet collision check
        for (let j = bullets.length - 1; j >= 0; j--) {
            const bullet = bullets[j];
            const dx = bullet.mesh.position.x - zombie.mesh.position.x;
            const dz = bullet.mesh.position.z - zombie.mesh.position.z;
            const distanceToBullet = Math.sqrt(dx * dx + dz * dz);
            const bulletHeight = bullet.mesh.position.y;
            const zombieHeight = zombie.mesh.position.y + 1;
            const heightDiff = Math.abs(bulletHeight - zombieHeight);
            
            if (distanceToBullet < 1.0 && heightDiff < 1.0) {
                // Remove bullet
                scene.remove(bullet.mesh);
                scene.remove(bullet.trail);
                bullets.splice(j, 1);
                
                // Send damage to server
                socket.emit('damageEnemy', {
                    enemyId: enemyId,
                    damage: BULLET_DAMAGE
                });
            }
        }
    }
}

function togglePause() {
    isPaused = !isPaused;
    const pauseMenu = document.getElementById('pauseMenu');
    pauseMenu.style.display = isPaused ? 'block' : 'none';
    
    // Show/hide crosshair based on pause state
    const crosshair = document.getElementById('crosshair');
    crosshair.style.display = isPaused ? 'none' : 'block';
    
    // Enable/disable chat input during pause
    const chatInput = document.getElementById('chat-input');
    chatInput.disabled = isPaused;
}

function restartGame() {
    location.reload();  // Simple restart by reloading the page
}

function animate() {
    requestAnimationFrame(animate);
    
    // Only update game state if not paused
    if (!isPaused) {
        updatePlayer();
        updateBullets();
        updateRain();
        updateZombies();
        updateLooting();
    }
    
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
}

function createEnvironmentObjects() {
    const SAFE_SPAWN_RADIUS = 5;  // 5 unit radius safe zone around spawn point
    
    ENVIRONMENT_OBJECTS.forEach(objType => {
        for (let i = 0; i < objType.count; i++) {
            const obj = new THREE.Mesh(objType.geometry, objType.material);
            
            let validPosition = false;
            let attempts = 0;
            const MAX_ATTEMPTS = 50;  // Prevent infinite loops
            
            while (!validPosition && attempts < MAX_ATTEMPTS) {
                // Random position within game bounds
                const angle = Math.random() * Math.PI * 2;
                const radius = 10 + Math.random() * 130;  // Increased from 5+35 to 10+130
                obj.position.x = Math.cos(angle) * radius;
                obj.position.z = Math.sin(angle) * radius;
                obj.position.y = objType.geometry.parameters.height / 2;
                
                // Check distance from spawn point (0,0)
                const distanceFromSpawn = Math.sqrt(
                    obj.position.x * obj.position.x + 
                    obj.position.z * obj.position.z
                );
                
                // Check if object is far enough from spawn and doesn't overlap with other objects
                if (distanceFromSpawn > SAFE_SPAWN_RADIUS) {
                    validPosition = true;
                    
                    // Check overlap with existing objects
                    for (const existingObj of environmentObjects) {
                        const dx = existingObj.position.x - obj.position.x;
                        const dz = existingObj.position.z - obj.position.z;
                        const minDistance = 3;  // Minimum distance between objects
                        
                        if (Math.sqrt(dx * dx + dz * dz) < minDistance) {
                            validPosition = false;
                            break;
                        }
                    }
                }
                
                attempts++;
            }
            
            if (validPosition) {
                // Random rotation
                obj.rotation.y = Math.random() * Math.PI * 2;
                
                obj.castShadow = true;
                obj.receiveShadow = true;
                
                scene.add(obj);
                environmentObjects.push(obj);
            }
        }
    });
}

function createLootableBody(position) {
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x505050,
        emissive: 0x303030,
        emissiveIntensity: 0.2
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    
    body.position.copy(position);
    body.position.y = 0.15;  // Half height
    body.rotation.x = Math.PI / 2;  // Lay flat
    
    body.userData.isLootable = true;
    body.userData.hasBeenLooted = false;
    
    scene.add(body);
    lootableBodies.push(body);
    
    return body;
}

function updateLooting() {
    if (!isLooting) {
        // Check for nearby lootable bodies
        const nearbyBody = findNearestLootableBody();
        
        if (nearbyBody) {
            document.getElementById('lootingText').style.display = 'block';
            nearbyBody.material.emissiveIntensity = 0.5;  // Highlight effect
        } else {
            document.getElementById('lootingText').style.display = 'none';
            // Reset highlight on all bodies
            lootableBodies.forEach(body => {
                if (!body.userData.hasBeenLooted) {
                    body.material.emissiveIntensity = 0.2;
                }
            });
        }
        
        // Start looting if E is pressed and there's a nearby body
        if (keysPressed['e'] && nearbyBody) {
            startLooting(nearbyBody);
        }
    } else {
        // Continue looting if E is still pressed
        if (keysPressed['e'] && lootingTarget) {
            lootingProgress += 16.67;  // Approximately one frame at 60fps
            const progress = (lootingProgress / LOOTING_DURATION) * 100;
            document.getElementById('lootingBar').style.width = `${progress}%`;
            
            if (lootingProgress >= LOOTING_DURATION) {
                completeLoot();
            }
        } else {
            // Cancel looting if E is released
            cancelLooting();
        }
    }
}

function findNearestLootableBody() {
    let nearestBody = null;
    let nearestDistance = LOOTING_RANGE;
    
    lootableBodies.forEach(body => {
        if (!body.userData.hasBeenLooted) {
            const distance = body.position.distanceTo(player.position);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestBody = body;
            }
        }
    });
    
    return nearestBody;
}

function startLooting(body) {
    isLooting = true;
    lootingTarget = body;
    lootingProgress = 0;
    document.getElementById('lootingBarContainer').style.display = 'block';
    document.getElementById('lootingBar').style.width = '0%';
}

function completeLoot() {
    // Add random amount of ammo
    const ammoGained = Math.floor(Math.random() * (LOOT_AMMO_MAX - LOOT_AMMO_MIN + 1)) + LOOT_AMMO_MIN;
    totalAmmo += ammoGained;
    updateAmmoUI();
    
    // Mark body as looted and change appearance
    lootingTarget.userData.hasBeenLooted = true;
    lootingTarget.material.color.set(0x303030);
    lootingTarget.material.emissiveIntensity = 0;
    
    cancelLooting();
}

function cancelLooting() {
    isLooting = false;
    lootingTarget = null;
    lootingProgress = 0;
    document.getElementById('lootingBarContainer').style.display = 'none';
}

function onZombieKilled(zombie) {
    // 30% chance to spawn a lootable body
    if (Math.random() < 0.3) {
        createLootableBody(zombie.mesh.position);
    }
}

function checkCollisionWithEnvironment(position, radius) {
    for (const obj of environmentObjects) {
        // Get object dimensions and rotation
        const box = new THREE.Box3().setFromObject(obj);
        const objWidth = box.max.x - box.min.x;
        const objDepth = box.max.z - box.min.z;
        
        // Calculate distance between centers
        const dx = position.x - obj.position.x;
        const dz = position.z - obj.position.z;
        
        // Rotate the distance vector to match object's rotation
        const angle = obj.rotation.y;
        const rotatedDx = dx * Math.cos(-angle) - dz * Math.sin(-angle);
        const rotatedDz = dx * Math.sin(-angle) + dz * Math.cos(-angle);
        
        // Add some padding to the collision box
        const collisionPadding = 0.3;
        
        // Check if within collision bounds
        if (Math.abs(rotatedDx) < (objWidth / 2 + radius + collisionPadding) &&
            Math.abs(rotatedDz) < (objDepth / 2 + radius + collisionPadding)) {
            return true; // Collision detected
        }
    }
    return false; // No collision
}

function slideAlongObstacle(position, moveX, moveZ) {
    // Try moving only in X direction
    const xOnlyPosition = new THREE.Vector3(
        position.x + moveX,
        position.y,
        position.z
    );
    
    // Try moving only in Z direction
    const zOnlyPosition = new THREE.Vector3(
        position.x,
        position.y,
        position.z + moveZ
    );
    
    // If we can move in either direction without collision, do so
    if (!checkCollisionWithEnvironment(xOnlyPosition, 0.5)) {
        return xOnlyPosition;
    } else if (!checkCollisionWithEnvironment(zOnlyPosition, 0.5)) {
        return zOnlyPosition;
    }
    
    // If we can't slide in either direction, return original position
    return position;
}

function createMuzzleFlash() {
    // Create a bright point light for the flash
    const flashLight = new THREE.PointLight(0xffaa00, 0, 3);
    
    // Create the visual flash mesh
    const flashGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
    flashGeometry.rotateX(Math.PI / 2);  // Rotate to point forward
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    
    // Create a group for the muzzle flash
    muzzleFlash = new THREE.Group();
    muzzleFlash.add(flashLight);
    muzzleFlash.add(flashMesh);
    muzzleFlash.visible = false;
    
    // Position relative to gun
    muzzleFlash.position.set(0.5, 1.5, 0.5);
    player.add(muzzleFlash);
}

function switchWeapon(weaponName) {
    if (currentWeapon === weaponName || isReloading) return;
    
    // Stop SMG sound if it was firing when switching weapons
    if (currentWeapon === 'smg' && isSmgFiring) {
        smgShotSound.pause();
        smgShotSound.currentTime = 0;
        isSmgFiring = false;
    }
    
    currentWeapon = weaponName;
    const weapon = WEAPONS[weaponName];
    
    // Update ammo display
    currentAmmo = weapon.maxAmmo;
    maxAmmo = weapon.maxAmmo;
    totalAmmo = weapon.totalAmmo;
    
    // Update UI
    updateAmmoUI();
    updateWeaponUI();
    
    // Update bullet model appearance
    updateBulletModel(weapon);
}

function updateWeaponUI() {
    const weaponName = WEAPONS[currentWeapon].name;
    document.getElementById('weaponName').textContent = weaponName;
}

function updateBulletModel(weapon) {
    // Update bullet model geometry and material
    const bulletGeometry = new THREE.CylinderGeometry(
        weapon.bulletSize,
        weapon.bulletSize,
        weapon.bulletLength,
        8
    );
    bulletGeometry.rotateX(Math.PI / 2);
    
    const bulletMaterial = new THREE.MeshStandardMaterial({
        color: weapon.color,
        emissive: weapon.color,
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2
    });
    
    bulletModel.geometry = bulletGeometry;
    bulletModel.material = bulletMaterial;
}

// Start the game only when the start button is clicked
// init() is now called from startGame()

document.getElementById('welcomeScreen').addEventListener('click', function(event) {
    // Don't trigger if clicking the start button itself
    if (event.target.id === 'startButton') return;
    
    // Show all text immediately
    const textElements = document.querySelectorAll('.typed-text');
    textElements.forEach(el => {
        el.style.animation = 'none';
        el.style.opacity = '1';
        el.style.width = '100%';
    });
    
    // Show title immediately
    document.querySelector('#welcomeScreen h1').style.animation = 'none';
    document.querySelector('#welcomeScreen h1').style.opacity = '1';
    
    // Show and enable start button immediately
    const startButton = document.getElementById('startButton');
    startButton.style.animation = 'buttonFlash 2s infinite';
    startButton.style.opacity = '1';
});

// Add after other game variables
const SOCKET_SERVER_URL = 'https://0414-2001-8003-1c34-8000-73d2-678f-df1d-119e.ngrok-free.app';

// Add to game variables section
let isHost = false; // Only one client should spawn zombies
let isInvincible = false;
const INVINCIBILITY_DURATION = 1000; // 1 second of invincibility after taking damage

function handlePlayerDeath() {
    isPaused = true;
    const gameOverScreen = document.createElement('div');
    gameOverScreen.id = 'gameOverScreen';
    gameOverScreen.style.position = 'fixed';
    gameOverScreen.style.top = '0';
    gameOverScreen.style.left = '0';
    gameOverScreen.style.width = '100%';
    gameOverScreen.style.height = '100%';
    gameOverScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    gameOverScreen.style.display = 'flex';
    gameOverScreen.style.flexDirection = 'column';
    gameOverScreen.style.justifyContent = 'center';
    gameOverScreen.style.alignItems = 'center';
    gameOverScreen.style.color = 'white';
    gameOverScreen.style.fontSize = '2em';
    gameOverScreen.style.zIndex = '1000';
    
    gameOverScreen.innerHTML = `
        <h1>Game Over</h1>
        <p>You survived until wave ${currentWave}</p>
        <button onclick="restartGame()" style="padding: 10px 20px; margin-top: 20px; font-size: 0.8em;">Restart Game</button>
    `;
    
    document.body.appendChild(gameOverScreen);
}

function addChatMessage(sender, message, time) {
    const chatMessages = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    messageElement.innerHTML = `<span class="sender">${sender}:</span> ${message}<span class="time">${time}</span>`;
    
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add new function to create muzzle flash for other players
function createMuzzleFlashForPlayer() {
    const flashLight = new THREE.PointLight(0xffaa00, 2, 3);
    
    const flashGeometry = new THREE.ConeGeometry(0.2, 0.5, 8);
    flashGeometry.rotateX(Math.PI / 2);
    const flashMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    
    const flash = new THREE.Group();
    flash.add(flashLight);
    flash.add(flashMesh);
    
    return flash;
}
