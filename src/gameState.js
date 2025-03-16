// Game state management
import { weapons, switchWeapon, reloadWeapon, checkReloadCompletion } from './weapons.js';

// Score values for different zombie types
export const SCORE_VALUES = {
    REGULAR: 100,
    RUNNER: 150,
    BRUTE: 250
};

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
    score: 0,
    isInvulnerable: false,
    invulnerabilityTime: 0,
    invulnerabilityDuration: 1.0, // 1 second of invulnerability after being hit
    zombiesKilled: {
        REGULAR: 0,
        RUNNER: 0,
        BRUTE: 0,
        get total() {
            return this.REGULAR + this.RUNNER + this.BRUTE;
        }
    },
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
    
    // Update invulnerability state
    if (gameState.isInvulnerable) {
        gameState.invulnerabilityTime += deltaTime;
        if (gameState.invulnerabilityTime >= gameState.invulnerabilityDuration) {
            gameState.isInvulnerable = false;
            gameState.invulnerabilityTime = 0;
        }
    }
    
    // Check if any weapon is currently reloading and needs to be updated
    checkReloadCompletion(gameState);
}

// Make player invulnerable for a short period
export function setPlayerInvulnerable() {
    gameState.isInvulnerable = true;
    gameState.invulnerabilityTime = 0;
}

// Check if player is currently invulnerable
export function isPlayerInvulnerable() {
    return gameState.isInvulnerable;
}

// Add points to the player's score
function addScore(points) {
    gameState.score += points;
}

// Record a zombie kill and update score
function recordZombieKill(zombieType) {
    // Increment the kill counter for this zombie type
    if (gameState.zombiesKilled.hasOwnProperty(zombieType)) {
        gameState.zombiesKilled[zombieType]++;
    }
    
    // Add score based on zombie type
    const scoreValue = SCORE_VALUES[zombieType] || SCORE_VALUES.REGULAR;
    addScore(scoreValue);
}

// Get current score information for display
function getScoreInfo() {
    return {
        score: gameState.score,
        kills: gameState.zombiesKilled
    };
}

// Export the game state and functions
export { 
    gameState, 
    updateGameState, 
    switchWeapon, 
    reloadWeapon,
    addScore,
    recordZombieKill,
    getScoreInfo
}; 