// Game state management
import { weapons, switchWeapon, reloadWeapon, checkReloadCompletion } from './weapons.js';
import SoundManager from './sound.js';

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
    isGameOver: false,
    gameStartTime: 0,
    gameEndTime: 0,
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

// Initialize game state with starting time
export function initializeGameState() {
    // Reset health and other stats
    gameState.health = gameState.maxHealth;
    gameState.stamina = gameState.maxStamina;
    gameState.isInvulnerable = false;
    gameState.invulnerabilityTime = 0;
    gameState.isGameOver = false;
    gameState.score = 0;
    gameState.zombiesKilled.REGULAR = 0;
    gameState.zombiesKilled.RUNNER = 0;
    gameState.zombiesKilled.BRUTE = 0;
    gameState.gameStartTime = Date.now();
    gameState.gameEndTime = 0;
}

// Handle game over state
export function gameOver() {
    if (gameState.isGameOver) return; // Prevent multiple calls
    
    gameState.isGameOver = true;
    gameState.gameEndTime = Date.now();
    
    // Calculate survival time in seconds
    const survivalTimeInSeconds = Math.floor((gameState.gameEndTime - gameState.gameStartTime) / 1000);
    const minutes = Math.floor(survivalTimeInSeconds / 60);
    const seconds = survivalTimeInSeconds % 60;
    const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    // Update UI elements with final stats
    document.getElementById('final-score').textContent = gameState.score;
    document.getElementById('final-kills').textContent = gameState.zombiesKilled.total;
    document.getElementById('survival-time').textContent = formattedTime;
    
    // Show game over screen
    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.style.display = 'flex';
    
    // Try to play game over sound
    try {
        SoundManager.playSound('gameOver');
    } catch (error) {
        console.log('Sound effect not available');
    }
    
    console.log('Game Over!');
}

// Update game state based on player actions
function updateGameState(deltaTime, keys) {
    // Skip updates if game is over
    if (gameState.isGameOver) return;
    
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