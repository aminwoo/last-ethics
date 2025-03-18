import * as THREE from 'three';
import SoundManager from './sound';

// Rain constants
const RAIN_COUNT = 10000;
const RAIN_AREA_SIZE = 300;
const RAIN_HEIGHT = 50;
const RAIN_SPEED = 0.3;

let thunderLight;
let isThundering = false;
const minThunderInterval = 5000;  // Minimum time between thunders (ms)
const maxThunderInterval = 15000; // Maximum time between thunders (ms)

// Create the environment elements
function createEnvironment(scene, camera) {
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x505050); // Very dim ambient light
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

    // Add grid helper
    const gridHelper = new THREE.GridHelper(300, 300, 0x000000, 0x222222);
    gridHelper.position.y = 0.0;
    scene.add(gridHelper);

    // Create rain
    const rainParticles = createRain(scene);

    // Create flashlight
    const flashlight = createFlashlight(scene, camera);

    //Create thunder 

    // Create a bright directional light for thunder
    thunderLight = new THREE.DirectionalLight(0x9999ff, 0);  // Start with intensity 0
    thunderLight.position.set(0, 50, 0);
    scene.add(thunderLight);
    
    // Start the thunder cycle
    scheduleNextThunder();

    return {
        ground,
        ambientLight,
        gridHelper,
        rainParticles,
        flashlight,
    };
}

// Create flashlight
function createFlashlight(scene, camera) {
    // Create a group to hold the flashlight and its target
    const flashlightGroup = new THREE.Group();
    
    // Create the flashlight target
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -5);
    flashlightGroup.add(flashlightTarget);
    scene.add(flashlightTarget); // Target needs to be in the scene for the spotlight to work
    
    // Create the flashlight
    const flashlight = new THREE.SpotLight(0xffffff, 75, 35, Math.PI / 7, 0.5, 1);
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
        glow: flashlightGlow,
        camera: camera // Add camera reference for raycasting
    };
}

function updateFlashlight(flashlight, playerPosition, direction) {
    // Update flashlight position to match player
    flashlight.group.position.copy(playerPosition);
    
    // Position flashlight target in front of player based on direction
    const targetDistance = 10;
    const targetDirection = direction.clone(); // Clone to avoid modifying the original
    flashlight.target.position.copy(playerPosition)
        .add(targetDirection.multiplyScalar(targetDistance));
    
    // Update flashlight and glow position relative to player
    flashlight.light.position.set(0, 1.5, 0);
    flashlight.glow.position.copy(flashlight.light.position);
    
    // Get the flashlight state from gameState
    const flashlightOn = window.gameState ? window.gameState.flashlightOn : true;
    
    // Set the intensity based on the flashlight state
    const targetIntensity = flashlightOn ? 75 : 0;
    const targetGlowIntensity = flashlightOn ? 2.25 : 0;
    
    // Apply intensities
    flashlight.light.intensity = targetIntensity;
    flashlight.glow.intensity = targetGlowIntensity;
}

function createRain(scene) {
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
    return {
        mesh: rain,
        velocities: rainVelocities,
        positions: rain.geometry.attributes.position.array
    };
}

function updateRain(rainParticles, playerPosition) {
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
            positions[idx] = playerPosition.x + Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2;
            positions[idx + 1] = RAIN_HEIGHT;
            positions[idx + 2] = playerPosition.z + Math.random() * RAIN_AREA_SIZE - RAIN_AREA_SIZE / 2;
            
            // End point of the line
            positions[idx + 3] = positions[idx];
            positions[idx + 4] = positions[idx + 1] - 0.5;
            positions[idx + 5] = positions[idx + 2];
        }
    }
    
    // Update the geometry
    rainParticles.mesh.geometry.attributes.position.needsUpdate = true;
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
    
    // Play thunder sound
    SoundManager.playThunder();
    
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

export {
    RAIN_COUNT,
    RAIN_AREA_SIZE,
    RAIN_HEIGHT,
    RAIN_SPEED,
    createEnvironment,
    createRain,
    updateRain,
    createFlashlight,
    updateFlashlight,
}; 