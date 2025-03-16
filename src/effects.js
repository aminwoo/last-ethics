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

// Screen flash effect when player takes damage
export function showDamageFlash() {
    const damageFlash = document.getElementById('damage-flash');
    if (!damageFlash) return;
    
    // Setup flash styles
    damageFlash.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
    damageFlash.style.opacity = '1';
    damageFlash.style.pointerEvents = 'none';
    damageFlash.style.position = 'absolute';
    damageFlash.style.top = '0';
    damageFlash.style.left = '0';
    damageFlash.style.width = '100%';
    damageFlash.style.height = '100%';
    damageFlash.style.zIndex = '1000';
    damageFlash.style.transition = 'opacity 0.5s ease-out';
    
    // Show flash
    setTimeout(() => {
        damageFlash.style.opacity = '0';
    }, 100);
}

