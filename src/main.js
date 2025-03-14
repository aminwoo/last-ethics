import * as THREE from 'three';
import SoundManager from './sound.js';

SoundManager.playRainAmbience();

// Game state
const gameState = {
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    staminaRegenRate: 10, // per second
    staminaDrainRate: 25, // per second when sprinting
    weapon: {
        name: "Pistol",
        damage: 25,
        ammo: 12,
        maxAmmo: 12,
        totalAmmo: 48
    }
};

// Create UI elements
function createUI() {
    // Create UI container
    const uiContainer = document.createElement('div');
    uiContainer.id = 'ui-container';
    uiContainer.style.position = 'absolute';
    uiContainer.style.top = '0';
    uiContainer.style.left = '0';
    uiContainer.style.width = '100%';
    uiContainer.style.pointerEvents = 'none';
    uiContainer.style.fontFamily = 'Arial, sans-serif';
    uiContainer.style.color = 'white';
    uiContainer.style.textShadow = '2px 2px 4px rgba(0, 0, 0, 0.5)';
    document.body.appendChild(uiContainer);
    
    // Create top-left status panel
    const statusPanel = document.createElement('div');
    statusPanel.id = 'status-panel';
    statusPanel.style.position = 'absolute';
    statusPanel.style.top = '20px';
    statusPanel.style.left = '20px';
    statusPanel.style.padding = '10px';
    statusPanel.style.borderRadius = '5px';
    statusPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    statusPanel.style.backdropFilter = 'blur(5px)';
    statusPanel.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
    uiContainer.appendChild(statusPanel);
    
    // Health bar
    const healthContainer = document.createElement('div');
    healthContainer.style.marginBottom = '10px';
    statusPanel.appendChild(healthContainer);
    
    const healthLabel = document.createElement('div');
    healthLabel.textContent = 'HEALTH';
    healthLabel.style.fontSize = '12px';
    healthLabel.style.marginBottom = '5px';
    healthLabel.style.fontWeight = 'bold';
    healthContainer.appendChild(healthLabel);
    
    const healthBarContainer = document.createElement('div');
    healthBarContainer.style.width = '200px';
    healthBarContainer.style.height = '15px';
    healthBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    healthBarContainer.style.borderRadius = '3px';
    healthBarContainer.style.overflow = 'hidden';
    healthBarContainer.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    healthContainer.appendChild(healthBarContainer);
    
    const healthBar = document.createElement('div');
    healthBar.id = 'health-bar';
    healthBar.style.width = '100%';
    healthBar.style.height = '100%';
    healthBar.style.backgroundColor = '#ff3333';
    healthBar.style.transition = 'width 0.3s ease-out';
    healthBarContainer.appendChild(healthBar);
    
    // Stamina bar
    const staminaContainer = document.createElement('div');
    staminaContainer.style.marginBottom = '10px';
    statusPanel.appendChild(staminaContainer);
    
    const staminaLabel = document.createElement('div');
    staminaLabel.textContent = 'STAMINA';
    staminaLabel.style.fontSize = '12px';
    staminaLabel.style.marginBottom = '5px';
    staminaLabel.style.fontWeight = 'bold';
    staminaContainer.appendChild(staminaLabel);
    
    const staminaBarContainer = document.createElement('div');
    staminaBarContainer.style.width = '200px';
    staminaBarContainer.style.height = '10px';
    staminaBarContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    staminaBarContainer.style.borderRadius = '3px';
    staminaBarContainer.style.overflow = 'hidden';
    staminaBarContainer.style.border = '1px solid rgba(255, 255, 255, 0.3)';
    staminaContainer.appendChild(staminaBarContainer);
    
    const staminaBar = document.createElement('div');
    staminaBar.id = 'stamina-bar';
    staminaBar.style.width = '100%';
    staminaBar.style.height = '100%';
    staminaBar.style.backgroundColor = '#33cc33';
    staminaBar.style.transition = 'width 0.1s linear';
    staminaBarContainer.appendChild(staminaBar);
    
    // Create bottom-right weapon panel
    const weaponPanel = document.createElement('div');
    weaponPanel.id = 'weapon-panel';
    weaponPanel.style.position = 'absolute';
    weaponPanel.style.bottom = '20px';
    weaponPanel.style.right = '20px';
    weaponPanel.style.padding = '10px';
    weaponPanel.style.borderRadius = '5px';
    weaponPanel.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    weaponPanel.style.backdropFilter = 'blur(5px)';
    weaponPanel.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.7)';
    weaponPanel.style.textAlign = 'right';
    uiContainer.appendChild(weaponPanel);
    
    // Weapon name
    const weaponName = document.createElement('div');
    weaponName.id = 'weapon-name';
    weaponName.textContent = gameState.weapon.name;
    weaponName.style.fontSize = '18px';
    weaponName.style.fontWeight = 'bold';
    weaponName.style.marginBottom = '5px';
    weaponPanel.appendChild(weaponName);
    
    // Ammo counter
    const ammoCounter = document.createElement('div');
    ammoCounter.id = 'ammo-counter';
    ammoCounter.style.fontSize = '24px';
    ammoCounter.style.fontWeight = 'bold';
    ammoCounter.style.fontFamily = 'monospace';
    ammoCounter.textContent = `${gameState.weapon.ammo} / ${gameState.weapon.totalAmmo}`;
    weaponPanel.appendChild(ammoCounter);
    
    // Crosshair
    const crosshair = document.createElement('div');
    crosshair.id = 'crosshair';
    crosshair.style.position = 'absolute';
    crosshair.style.width = '10px';
    crosshair.style.height = '10px';
    crosshair.style.borderRadius = '50%';
    crosshair.style.border = '2px solid white';
    crosshair.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
    crosshair.style.transform = 'translate(-50%, -50%)';
    crosshair.style.pointerEvents = 'none';
    crosshair.style.boxShadow = '0 0 5px rgba(0, 0, 0, 0.5)';
    uiContainer.appendChild(crosshair);
    
    return {
        healthBar,
        staminaBar,
        weaponName,
        ammoCounter
    };
}

// Update UI based on game state
function updateUI() {
    // Update health bar
    const healthPercent = (gameState.health / gameState.maxHealth) * 100;
    ui.healthBar.style.width = `${healthPercent}%`;
    
    // Change health bar color based on health level
    if (healthPercent < 25) {
        ui.healthBar.style.backgroundColor = '#ff0000';
    } else if (healthPercent < 50) {
        ui.healthBar.style.backgroundColor = '#ff7700';
    } else {
        ui.healthBar.style.backgroundColor = '#ff3333';
    }
    
    // Update stamina bar
    const staminaPercent = (gameState.stamina / gameState.maxStamina) * 100;
    ui.staminaBar.style.width = `${staminaPercent}%`;
    
    // Update weapon info
    ui.weaponName.textContent = gameState.weapon.name;
    ui.ammoCounter.textContent = `${gameState.weapon.ammo} / ${gameState.weapon.totalAmmo}`;
}

// Initialize UI
const ui = createUI();

let mousePosition = { x: 0, y: 0 };
let clientMousePosition = { x: 0, y: 0 };

// Player movement controls
const keys = {
    w: false,
    a: false,
    s: false,
    d: false,
    shift: false
};

// Player movement speed
const PLAYER_SPEED = 0.15;
const PLAYER_SPRINT_MULTIPLIER = 1.8;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 25, 0);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

document.getElementById('gameContainer').appendChild(renderer.domElement);

// Add window resize event listener
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('mousemove', onMouseMove);

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

// Keyboard event listeners for player movement
window.addEventListener('keydown', (event) => {
    switch (event.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
        case 'shift': keys.shift = true; break;
    }
});

window.addEventListener('keyup', (event) => {
    switch (event.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
        case 'shift': keys.shift = false; break;
    }
});

function createFlashlight() {
    // Create a group to hold the flashlight and its target
    const flashlightGroup = new THREE.Group();
    
    // Create the flashlight target
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -5);
    flashlightGroup.add(flashlightTarget);
    scene.add(flashlightTarget); // Target needs to be in the scene for the spotlight to work
    
    // Create the flashlight
    const flashlight = new THREE.SpotLight(0xffffff, 50, 35, Math.PI / 7, 0.5, 1);
    flashlight.position.set(0, 1.5, 0);
    flashlight.target = flashlightTarget;
    flashlight.castShadow = true;
    
    // Configure shadows for better quality
    flashlight.shadow.mapSize.width = 1024;
    flashlight.shadow.mapSize.height = 1024;
    flashlight.shadow.camera.near = 0.5;
    flashlight.shadow.camera.far = 35;
    
    // Add the flashlight to the group
    flashlightGroup.add(flashlight);
    
    // Add a small point light at the flashlight position to create a glow effect
    const flashlightGlow = new THREE.PointLight(0xffffcc, 2.25, 3);
    flashlightGlow.position.copy(flashlight.position);
    flashlightGroup.add(flashlightGlow);
    
    // Add the group to the scene
    scene.add(flashlightGroup);
    
    return {
        group: flashlightGroup,
        light: flashlight,
        target: flashlightTarget,
        glow: flashlightGlow
    };
}

function createPlayer() {
    const player = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    const playerModel = new THREE.Mesh(bodyGeometry, bodyMaterial);
    playerModel.position.y = 1.2;
    playerModel.castShadow = false;
    playerModel.receiveShadow = true;
    player.add(playerModel);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 2.0;
    head.castShadow = false;
    head.receiveShadow = true;
    player.add(head);
    
    // Create arms
    const armMaterial = new THREE.MeshStandardMaterial({ color: 0x3366ff });
    
    // Left arm (gun arm - pointing forward)
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-0.5, 1.6, 0);
    // Rotate the entire arm group to point forward
    leftArmGroup.rotation.x = -Math.PI / 2;
    player.add(leftArmGroup);
    
    const leftUpperArmGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
    const leftUpperArm = new THREE.Mesh(leftUpperArmGeometry, armMaterial);
    leftUpperArm.position.y = -0.2;
    leftUpperArm.castShadow = false;
    leftUpperArm.receiveShadow = true;
    leftArmGroup.add(leftUpperArm);
    
    const leftForearmGroup = new THREE.Group();
    leftForearmGroup.position.y = -0.4;
    // Slight bend at the elbow for a more natural aiming pose
    leftForearmGroup.rotation.x = Math.PI / 12;
    leftArmGroup.add(leftForearmGroup);
    
    const leftForearmGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const leftForearm = new THREE.Mesh(leftForearmGeometry, armMaterial);
    leftForearm.position.y = -0.2;
    leftForearm.castShadow = false;
    leftForearm.receiveShadow = true;
    leftForearmGroup.add(leftForearm);
    
    // Left hand
    const leftHandGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const leftHandMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const leftHand = new THREE.Mesh(leftHandGeometry, leftHandMaterial);
    leftHand.position.y = -0.4;
    leftHand.castShadow = false;
    leftForearmGroup.add(leftHand);
    
    // Gun - attach to left hand
    const gunGroup = new THREE.Group();
    gunGroup.position.set(0, -0.4, 0.2);
    // Rotate gun to point forward properly
    gunGroup.rotation.x = Math.PI / 2;
    leftForearmGroup.add(gunGroup);
    
    // Create a more detailed gun
    const gunBarrelGeometry = new THREE.BoxGeometry(0.08, 0.08, 0.6);
    const gunHandleGeometry = new THREE.BoxGeometry(0.08, 0.2, 0.12);
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    
    // Gun barrel
    const gunBarrel = new THREE.Mesh(gunBarrelGeometry, gunMaterial);
    gunBarrel.position.z = 0.3;
    gunBarrel.name = 'gunBarrel';
    gunGroup.add(gunBarrel);
    
    // Gun handle/grip
    const gunHandle = new THREE.Mesh(gunHandleGeometry, gunMaterial);
    gunHandle.position.y = -0.1;
    gunHandle.position.z = 0.05;
    gunGroup.add(gunHandle);
    
    // Right arm (hanging naturally)
    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(0.5, 1.6, 0);
    player.add(rightArmGroup);
    
    const rightUpperArmGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.4, 8);
    const rightUpperArm = new THREE.Mesh(rightUpperArmGeometry, armMaterial);
    rightUpperArm.position.y = -0.2;
    rightUpperArm.castShadow = false;
    rightUpperArm.receiveShadow = true;
    rightArmGroup.add(rightUpperArm);
    
    const rightForearmGroup = new THREE.Group();
    rightForearmGroup.position.y = -0.4;
    rightArmGroup.add(rightForearmGroup);
    
    const rightForearmGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const rightForearm = new THREE.Mesh(rightForearmGeometry, armMaterial);
    rightForearm.position.y = -0.2;
    rightForearm.castShadow = false;
    rightForearm.receiveShadow = true;
    rightForearmGroup.add(rightForearm);
    
    // Right hand
    const rightHandGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const rightHandMaterial = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
    const rightHand = new THREE.Mesh(rightHandGeometry, rightHandMaterial);
    rightHand.position.y = -0.4;
    rightHand.castShadow = false;
    rightForearmGroup.add(rightHand);
    
    // Create legs
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x2255dd });
    
    // Left leg
    const leftLegGroup = new THREE.Group();
    leftLegGroup.position.set(-0.2, 0.6, 0);
    player.add(leftLegGroup);
    
    const leftThighGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
    const leftThigh = new THREE.Mesh(leftThighGeometry, legMaterial);
    leftThigh.position.y = -0.25;
    leftThigh.castShadow = false;
    leftThigh.receiveShadow = true;
    leftLegGroup.add(leftThigh);
    
    const leftCalfGroup = new THREE.Group();
    leftCalfGroup.position.y = -0.5;
    leftLegGroup.add(leftCalfGroup);
    
    const leftCalfGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
    const leftCalf = new THREE.Mesh(leftCalfGeometry, legMaterial);
    leftCalf.position.y = -0.25;
    leftCalf.castShadow = false;
    leftCalf.receiveShadow = true;
    leftCalfGroup.add(leftCalf);
    
    // Right leg
    const rightLegGroup = new THREE.Group();
    rightLegGroup.position.set(0.2, 0.6, 0);
    player.add(rightLegGroup);
    
    const rightThighGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8);
    const rightThigh = new THREE.Mesh(rightThighGeometry, legMaterial);
    rightThigh.position.y = -0.25;
    rightThigh.castShadow = false;
    rightThigh.receiveShadow = true;
    rightLegGroup.add(rightThigh);
    
    const rightCalfGroup = new THREE.Group();
    rightCalfGroup.position.y = -0.5;
    rightLegGroup.add(rightCalfGroup);
    
    const rightCalfGeometry = new THREE.CylinderGeometry(0.12, 0.12, 0.5, 8);
    const rightCalf = new THREE.Mesh(rightCalfGeometry, legMaterial);
    rightCalf.position.y = -0.25;
    rightCalf.castShadow = false;
    rightCalf.receiveShadow = true;
    rightCalfGroup.add(rightCalf);
    
    // Store references for animation
    player.userData = {
        leftLeg: {
            thigh: leftLegGroup,
            calf: leftCalfGroup
        },
        rightLeg: {
            thigh: rightLegGroup,
            calf: rightCalfGroup
        },
        leftArm: {
            upper: leftArmGroup,
            forearm: leftForearmGroup
        },
        rightArm: {
            upper: rightArmGroup,
            forearm: rightForearmGroup
        },
        animationTime: 0,
        isWalking: false,
        walkSpeed: 1.0
    };
    
    scene.add(player);
    return player; 
}

function createRain() {
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

const RAIN_COUNT = 10000;
const RAIN_AREA_SIZE = 300;
const RAIN_HEIGHT = 50;
const RAIN_SPEED = 0.3;

let rainParticles = [];

// Create player and flashlight
const player = createPlayer();
const flashlight = createFlashlight();

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

createRain();

// Create a raycaster for mouse interaction
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const groundIntersectPoint = new THREE.Vector3();

// Update the animation function to animate only the right arm while keeping the left arm steady for aiming
function animatePlayerLegs(player, isMoving, deltaTime) {
    const userData = player.userData;
    const leftLeg = userData.leftLeg;
    const rightLeg = userData.rightLeg;
    const rightArm = userData.rightArm;
    
    // Update animation state
    userData.isWalking = isMoving;
    
    if (isMoving) {
        // Increment animation time when moving
        userData.animationTime += deltaTime * userData.walkSpeed * (keys.shift ? 1.8 : 1.0);
        
        // Calculate leg angles based on sine wave
        const leftLegAngle = Math.sin(userData.animationTime * 10) * 0.5;
        const rightLegAngle = Math.sin(userData.animationTime * 10 + Math.PI) * 0.5;
        
        // Apply rotation to thighs
        leftLeg.thigh.rotation.x = leftLegAngle;
        rightLeg.thigh.rotation.x = rightLegAngle;
        
        // Apply counter-rotation to calves for a more natural look
        leftLeg.calf.rotation.x = Math.max(0, -leftLegAngle * 0.5);
        rightLeg.calf.rotation.x = Math.max(0, -rightLegAngle * 0.5);
        
        // Animate only the right arm (hanging arm)
        // Arms swing front to back (rotation around Z axis)
        rightArm.upper.rotation.z = leftLegAngle * 0.5;
        
        // Slight forearm movement for right arm
        rightArm.forearm.rotation.x = Math.max(0, leftLegAngle * 0.2);
        
        // Add a slight shoulder rotation for more natural movement (right arm only)
        rightArm.upper.rotation.y = leftLegAngle * 0.1;
        
        // Left arm remains steady for aiming (no animation)
    } else {
        // Gradually return legs to neutral position when not moving
        leftLeg.thigh.rotation.x *= 0.8;
        rightLeg.thigh.rotation.x *= 0.8;
        leftLeg.calf.rotation.x *= 0.8;
        rightLeg.calf.rotation.x *= 0.8;
        
        // Gradually return right arm to neutral position
        rightArm.upper.rotation.z *= 0.8;
        rightArm.upper.rotation.y *= 0.8;
        rightArm.forearm.rotation.x *= 0.8;
        
        // Left arm remains in aiming position
    }
}

// Update the animate function to include time delta for animations
let lastTime = 0;

function animate(time) {
    // Calculate time delta in seconds
    const deltaTime = (lastTime === 0) ? 0 : (time - lastTime) / 1000;
    lastTime = time;
    
    // Update player and flashlight
    updatePlayerAndFlashlight(deltaTime);
    
    // Update rain
    updateRain();
    
    // Update game state
    updateGameState(deltaTime);
    
    // Update UI
    updateUI();
    
    // Render scene
    renderer.render(scene, camera);
}

// Update game state based on player actions
function updateGameState(deltaTime) {
    // Update stamina based on sprinting
    if (keys.shift && (keys.w || keys.a || keys.s || keys.d)) {
        // Drain stamina when sprinting
        gameState.stamina = Math.max(0, gameState.stamina - gameState.staminaDrainRate * deltaTime);
    } else {
        // Regenerate stamina when not sprinting
        gameState.stamina = Math.min(gameState.maxStamina, gameState.stamina + gameState.staminaRegenRate * deltaTime);
    }
}

// Update the updatePlayerAndFlashlight function to include animation
function updatePlayerAndFlashlight(deltaTime) {
    // Calculate movement direction based on keys
    let moveX = 0;
    let moveZ = 0;
    
    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;
    
    // Check if player is moving
    const isMoving = (moveX !== 0 || moveZ !== 0);
    
    // Animate player legs
    animatePlayerLegs(player, isMoving, deltaTime);
    
    // Normalize movement vector if moving diagonally
    if (moveX !== 0 && moveZ !== 0) {
        const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= length;
        moveZ /= length;
    }
    
    // Apply movement speed
    let speed = PLAYER_SPEED;
    // Only allow sprinting if there's stamina available
    if (keys.shift && gameState.stamina > 0) {
        speed *= PLAYER_SPRINT_MULTIPLIER;
    }
    
    // Update player position
    player.position.x += moveX * speed;
    player.position.z += moveZ * speed;
    
    // Calculate direction from player to mouse position on ground
    raycaster.setFromCamera(mousePosition, camera);
    raycaster.ray.intersectPlane(groundPlane, groundIntersectPoint);
    
    // Calculate direction vector
    const direction = new THREE.Vector3()
        .subVectors(groundIntersectPoint, player.position)
        .normalize();
    
    // Rotate player to face mouse direction (only on Y axis)
    if (direction.x !== 0 || direction.z !== 0) {
        player.rotation.y = Math.atan2(direction.x, direction.z);
    }
    
    // Update flashlight position to match player
    flashlight.group.position.copy(player.position);
    
    // Position flashlight target in front of player based on mouse direction
    const targetDistance = 10;
    flashlight.target.position.copy(player.position)
        .add(direction.multiplyScalar(targetDistance));
    
    // Update flashlight and glow position relative to player
    flashlight.light.position.set(0, 1.5, 0);
    flashlight.glow.position.copy(flashlight.light.position);
    
    // Update camera position to follow player
    camera.position.x = player.position.x;
    camera.position.z = player.position.z + 25;
    camera.lookAt(player.position);
}

renderer.setAnimationLoop(animate);

// Add mouse click event for shooting
window.addEventListener('click', onMouseClick);

function onMouseClick(event) {
    // Only allow shooting if we have ammo
    if (gameState.weapon.ammo > 0) {
        // Decrease ammo
        gameState.weapon.ammo--;
        
        // Play gunshot sound (if available)
        if (SoundManager.playGunshot) {
            SoundManager.playGunshot();
        }
        
        // Add muzzle flash effect
        createMuzzleFlash();
    } else {
        // Play empty gun sound (if available)
        if (SoundManager.playEmptyGun) {
            SoundManager.playEmptyGun();
        }
    }
}

// Create a muzzle flash effect
function createMuzzleFlash() {
    // Find the gun barrel
    let gunBarrel = null;
    player.traverse((child) => {
        if (child.name === 'gunBarrel') {
            gunBarrel = child;
        }
    });
    
    // Get the gun position in world space
    const gunWorldPosition = new THREE.Vector3();
    if (gunBarrel) {
        gunBarrel.getWorldPosition(gunWorldPosition);
        
        // Get the forward direction of the player
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(player.quaternion);
        
        // Adjust position to the tip of the barrel
        gunWorldPosition.add(forward.multiplyScalar(0.4));
    } else {
        // Fallback if we can't find the gun barrel
        gunWorldPosition.copy(player.position);
        gunWorldPosition.y += 1.5;
        
        // Get the forward direction of the player
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(player.quaternion);
        
        // Position the muzzle flash in front of the player
        gunWorldPosition.add(forward.multiplyScalar(1.5));
    }
    
    // Create a point light for the muzzle flash
    const muzzleFlash = new THREE.PointLight(0xffaa00, 8, 3);
    muzzleFlash.position.copy(gunWorldPosition);
    scene.add(muzzleFlash);
    
    // Create a small sphere for the visual flash effect
    const flashGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const flashMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xffff00,
        transparent: true,
        opacity: 0.8
    });
    const flashMesh = new THREE.Mesh(flashGeometry, flashMaterial);
    flashMesh.position.copy(gunWorldPosition);
    scene.add(flashMesh);
    
    // Remove the muzzle flash after a short time
    setTimeout(() => {
        scene.remove(muzzleFlash);
        scene.remove(flashMesh);
    }, 50);
}

// Add reload functionality
window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'r') {
        reloadWeapon();
    }
});

function reloadWeapon() {
    // Only reload if we're not already full and have ammo remaining
    if (gameState.weapon.ammo < gameState.weapon.maxAmmo && gameState.weapon.totalAmmo > 0) {
        // Calculate how much ammo we need
        const ammoNeeded = gameState.weapon.maxAmmo - gameState.weapon.ammo;
        // Calculate how much ammo we can actually get from our reserves
        const ammoToAdd = Math.min(ammoNeeded, gameState.weapon.totalAmmo);
        
        // Add the ammo to the weapon
        gameState.weapon.ammo += ammoToAdd;
        // Remove the ammo from the total
        gameState.weapon.totalAmmo -= ammoToAdd;
        
        // Play reload sound (if available)
        if (SoundManager.playReload) {
            SoundManager.playReload();
        }
    }
}
