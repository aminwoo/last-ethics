// Screen shake constants
const SCREEN_SHAKE_DECAY = 0.9;

// Screen shake settings
const screenShake = {
    trauma: 0,
    decay: SCREEN_SHAKE_DECAY,
    maxOffset: 1.0
};

// Apply screen shake effect
export function applyScreenShake(intensity) {
    // Add trauma based on weapon intensity 
    screenShake.trauma = Math.min(1.0, screenShake.trauma + intensity);
}

// Update the screen shake for each frame
export function updateScreenShake(camera) {
    if (screenShake.trauma > 0) {
        const shake = screenShake.trauma * screenShake.trauma;
        const angle = Math.random() * Math.PI * 2;
        const offsetX = Math.cos(angle) * shake * screenShake.maxOffset;
        const offsetZ = Math.sin(angle) * shake * screenShake.maxOffset;
        
        camera.position.x += offsetX;
        camera.position.z += offsetZ;
        
        screenShake.trauma *= screenShake.decay;
        if (screenShake.trauma < 0.01) screenShake.trauma = 0;
    }
}

