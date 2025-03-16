// Game state management
import { weapons, switchWeapon, reloadWeapon, checkReloadCompletion } from './weapons.js';
import SoundManager from './sound.js';

// Score values for different zombie types
export const SCORE_VALUES = {
    REGULAR: 100,
    RUNNER: 150,
    BRUTE: 250
};

// Wave settings - zombies per wave increases with each wave
export const WAVE_SETTINGS = {
    initialZombies: 20,
    zombiesPerWaveIncrease: 14, // Increased from 3 to 6
    maxWaves: 20, // Maximum number of waves (for difficulty scaling purposes)
    timeBetweenWaves: 10, // seconds
    waveCompleteBonusScore: 500, // Bonus points for completing a wave
    
    // Scaling factors for zombie difficulty - drastically increased
    healthScaling: 0.18, // Increased from 0.1 to 0.18 (18% more health per wave)
    damageScaling: 0.15, // Increased from 0.08 to 0.15 (15% more damage per wave)
    speedScaling: 0.09, // Increased from 0.05 to 0.09 (9% faster per wave)
    
    // Exponential scaling kicks in after wave 10
    exponentialFactor: 0.1, // Additional exponential scaling factor
    exponentialWaveThreshold: 10, // When exponential scaling begins
    
    // Wave composition (percentage of different zombie atypes)
    composition: [
        // Wave 1-3: Mostly regular zombies, few runners
        { REGULAR: 0.85, RUNNER: 0.15, BRUTE: 0 },
        { REGULAR: 0.35, RUNNER: 0.50, BRUTE: 0.15 },
        { REGULAR: 0.25, RUNNER: 0.55, BRUTE: 0.20 },
        // Wave 19+: Nightmare difficulty
        { REGULAR: 0, RUNNER: 0.80, BRUTE: 0.20 },
    ]
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
    
    // Wave system properties
    currentWave: 0,
    waveInProgress: false,
    zombiesRemainingInWave: 0,
    timeSinceLastWave: 0,
    nextWaveCountdown: 0,
    
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
    
    // Reset wave properties
    gameState.currentWave = 0;
    gameState.waveInProgress = false;
    gameState.zombiesRemainingInWave = 0;
    gameState.timeSinceLastWave = 0;
    gameState.nextWaveCountdown = WAVE_SETTINGS.timeBetweenWaves;
    
    // Start the first wave after a short delay
    setTimeout(() => {
        startNextWave();
    }, 3000);
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
    
    // Add wave information if not already present
    if (!document.getElementById('final-wave')) {
        const statsContainer = document.querySelector('.stats-container');
        if (statsContainer) {
            const waveItem = document.createElement('div');
            waveItem.className = 'stat-item';
            
            const waveLabel = document.createElement('div');
            waveLabel.className = 'stat-label';
            waveLabel.textContent = 'HIGHEST WAVE';
            
            const waveValue = document.createElement('div');
            waveValue.id = 'final-wave';
            waveValue.className = 'stat-value';
            waveValue.textContent = gameState.currentWave;
            
            waveItem.appendChild(waveLabel);
            waveItem.appendChild(waveValue);
            statsContainer.appendChild(waveItem);
        }
    } else {
        document.getElementById('final-wave').textContent = gameState.currentWave;
    }
    
    // Show game over screen
    const gameOverScreen = document.getElementById('game-over-screen');
    gameOverScreen.style.display = 'flex';
    
    // Play player death sound
    try {
        // First try to use the sound manager with the registered death sound
        SoundManager.playSound('PLAYER_DEATH');
    } catch (error) {
        console.log('Error playing death sound through SoundManager:', error);
        
        // Fallback to direct Audio API if SoundManager fails
        try {
            const audio = new Audio('/sounds/731506__soundbitersfx__npcplayer-death-groans-male(1)-[AudioTrimmer.com].wav');
            audio.volume = 0.8;
            audio.play().catch(directError => {
                console.log('Error playing death sound directly:', directError);
                // Last resort fallback
                SoundManager.playSound('gameOver');
            });
        } catch (fallbackError) {
            console.log('All sound playback methods failed:', fallbackError);
        }
    }
    
    console.log('Game Over!');
}

// Wave system functions
export function startNextWave() {
    if (gameState.isGameOver) return;
    
    gameState.currentWave++;
    gameState.waveInProgress = true;
    
    // Calculate base number of zombies for this wave
    let zombiesInWave = WAVE_SETTINGS.initialZombies + 
                       (gameState.currentWave - 1) * WAVE_SETTINGS.zombiesPerWaveIncrease;
                       
    // Apply exponential scaling to zombie count for later waves
    if (gameState.currentWave > WAVE_SETTINGS.exponentialWaveThreshold) {
        const exponentialPower = gameState.currentWave - WAVE_SETTINGS.exponentialWaveThreshold;
        const bonusZombies = Math.floor(exponentialPower * exponentialPower * 0.5);
        zombiesInWave += bonusZombies;
        
        console.log(`Wave ${gameState.currentWave}: Adding ${bonusZombies} bonus zombies from exponential scaling`);
    }
                         
    gameState.zombiesRemainingInWave = zombiesInWave;
    
    console.log(`Starting wave ${gameState.currentWave} with ${zombiesInWave} zombies`);
    
    // Try to play wave start sound
    try {
        SoundManager.playSound('waveStart');
    } catch (error) {
        console.log('Wave start sound not available');
    }
    
    // Dispatch an event for the wave start (to be handled in main.js to spawn zombies)
    const waveStartEvent = new CustomEvent('waveStart', { 
        detail: { 
            wave: gameState.currentWave,
            zombieCount: zombiesInWave
        } 
    });
    document.dispatchEvent(waveStartEvent);
}

// Record a zombie kill and check if wave is complete
function recordZombieKill(zombieType) {
    // Increment the kill counter for this zombie type
    if (gameState.zombiesKilled.hasOwnProperty(zombieType)) {
        gameState.zombiesKilled[zombieType]++;
    }
    
    // Add score based on zombie type
    const scoreValue = SCORE_VALUES[zombieType] || SCORE_VALUES.REGULAR;
    addScore(scoreValue);
    
    // Update zombies remaining in current wave
    if (gameState.waveInProgress) {
        gameState.zombiesRemainingInWave--;
        
        // Check if wave is complete
        if (gameState.zombiesRemainingInWave <= 0) {
            completeWave();
        }
    }
}

// Handle wave completion
function completeWave() {
    gameState.waveInProgress = false;
    gameState.timeSinceLastWave = 0;
    gameState.nextWaveCountdown = WAVE_SETTINGS.timeBetweenWaves;
    
    // Award bonus points for completing the wave
    addScore(WAVE_SETTINGS.waveCompleteBonusScore * gameState.currentWave);
    
    console.log(`Wave ${gameState.currentWave} completed! Next wave in ${WAVE_SETTINGS.timeBetweenWaves} seconds`);
    
    // Try to play wave complete sound
    try {
        SoundManager.playSound('waveComplete');
    } catch (error) {
        console.log('Wave complete sound not available');
    }
}

// Get zombie type composition for current wave
export function getWaveComposition() {
    return WAVE_SETTINGS.composition[gameState.currentWave + 1];
}

// Calculate difficulty scaling factors for current wave
export function getWaveDifficultyScaling() {
    // Cap at max wave for scaling purposes
    const wave = Math.min(gameState.currentWave, WAVE_SETTINGS.maxWaves);
    
    // Calculate base scaling multipliers from linear progression
    const baseScaling = {
        health: 1 + (wave - 1) * WAVE_SETTINGS.healthScaling,
        damage: 1 + (wave - 1) * WAVE_SETTINGS.damageScaling,
        speed: 1 + (wave - 1) * WAVE_SETTINGS.speedScaling
    };
    
    // Add exponential scaling for waves beyond the threshold
    if (wave > WAVE_SETTINGS.exponentialWaveThreshold) {
        const exponentialPower = wave - WAVE_SETTINGS.exponentialWaveThreshold;
        const exponentialMultiplier = 1 + (WAVE_SETTINGS.exponentialFactor * exponentialPower * exponentialPower);
        
        // Apply exponential multiplier to all scaling factors
        baseScaling.health *= exponentialMultiplier;
        baseScaling.damage *= exponentialMultiplier;
        baseScaling.speed *= exponentialMultiplier;
        
        console.log(`Wave ${wave}: Exponential scaling x${exponentialMultiplier.toFixed(2)}`);
    }
    
    return baseScaling;
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
    
    // Update wave timing and status
    if (!gameState.waveInProgress && !gameState.isGameOver) {
        gameState.timeSinceLastWave += deltaTime;
        gameState.nextWaveCountdown = Math.max(0, WAVE_SETTINGS.timeBetweenWaves - gameState.timeSinceLastWave);
        
        // Start next wave when countdown reaches zero
        if (gameState.nextWaveCountdown <= 0) {
            startNextWave();
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

// Get current score information for display
function getScoreInfo() {
    return {
        score: gameState.score,
        kills: gameState.zombiesKilled
    };
}

// Get current wave information for UI
export function getWaveInfo() {
    return {
        currentWave: gameState.currentWave,
        zombiesRemaining: gameState.zombiesRemainingInWave,
        waveInProgress: gameState.waveInProgress,
        nextWaveCountdown: Math.ceil(gameState.nextWaveCountdown)
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