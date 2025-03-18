import * as THREE from 'three';
import SoundManager from './sound';
import { 
    RAIN_COUNT,
    RAIN_AREA_SIZE,
    RAIN_HEIGHT,
    RAIN_SPEED,
    createRain,
    updateRain,
    createThunderEffect,
    createFlashlight,
    updateFlashlight
} from './effects';

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

    // Create thunder effect
    const thunder = createThunderEffect(scene);

    return {
        ground,
        ambientLight,
        gridHelper,
        rainParticles,
        flashlight,
        thunder
    };
}

export {
    createEnvironment,
    updateRain
}; 