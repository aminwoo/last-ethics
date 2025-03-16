// Game state management
import { weapons, switchWeapon, reloadWeapon, checkReloadCompletion } from './weapons.js';

// Initial game state
const gameState = {
    playerName: "Survivor", // Default player name
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    staminaRegenRate: 10, // per second
    staminaDrainRate: 25, // per second when sprinting
    currentWeaponIndex: 0,
    weapons: weapons,
    get weapon() {
        return this.weapons[this.currentWeaponIndex];
    }
};

// Update game state based on player actions
function updateGameState(deltaTime, keys) {
    // Update stamina based on sprinting
    if (keys.shift && (keys.w || keys.a || keys.s || keys.d)) {
        // Drain stamina when sprinting
        gameState.stamina = Math.max(0, gameState.stamina - gameState.staminaDrainRate * deltaTime);
    } else {
        // Regenerate stamina when not sprinting
        gameState.stamina = Math.min(gameState.maxStamina, gameState.stamina + gameState.staminaRegenRate * deltaTime);
    }
    
    // Check if any weapon is currently reloading and needs to be updated
    checkReloadCompletion(gameState);
}

// Export the game state and functions
export { 
    gameState, 
    updateGameState, 
    switchWeapon, 
    reloadWeapon 
}; 