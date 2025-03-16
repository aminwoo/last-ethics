// UI management for the game

// Get UI elements from the DOM
function initializeUI() {
    return {
        healthBar: document.getElementById('health-bar'),
        healthText: document.getElementById('health-text'),
        staminaBar: document.getElementById('stamina-bar'),
        weaponName: document.getElementById('weapon-name'),
        ammoCounter: document.getElementById('ammo-counter'),
        crosshair: document.getElementById('crosshair'),
        weaponImage: document.getElementById('weapon-image'),
        minimap: {
            container: document.getElementById('minimap'),
            canvas: document.getElementById('minimap-canvas'),
            pulseRing: document.getElementById('pulse-ring'),
            playerIndicator: document.getElementById('player-indicator'),
            context: null,
            // Minimap properties
            size: 150,
            scale: 1,  // 1 world unit = 0.05 minimap pixels
            range: 750,   // How far the minimap shows (in world units)
            // Pulse properties
            pulseActive: false,
            pulseRadius: 0,
            pulseMaxRadius: 75, // Half of the minimap size
            pulseSpeed: 40,      // Pixels per second
            pulseCooldown: 0,
            pulseCooldownMax: 3000, // Time between pulses in ms
            // Zombie visibility tracking
            zombieVisibility: {}
        }
    };
}

// Initialize minimap
function initializeMinimap(ui) {
    const canvas = ui.minimap.canvas;
    canvas.width = ui.minimap.size;
    canvas.height = ui.minimap.size;
    
    ui.minimap.context = canvas.getContext('2d');
    
    // Set initial transformations
    const ctx = ui.minimap.context;
    // Translate to center of minimap
    ctx.translate(ui.minimap.size / 2, ui.minimap.size / 2);
    
    // Start the pulse animation
    startPulseAnimation(ui);
    
    return ui;
}

// Start pulse animation
function startPulseAnimation(ui) {
    // Set initial pulse state
    ui.minimap.pulseActive = false;
    ui.minimap.pulseRadius = 0;
    ui.minimap.pulseCooldown = 0;
    ui.minimap.fadeOutActive = false;
    
    // Hide pulse ring initially and set it to 0 size
    ui.minimap.pulseRing.style.opacity = '0';
    ui.minimap.pulseRing.style.width = '0px';
    ui.minimap.pulseRing.style.height = '0px';
    
    // Start animation loop
    let lastTime = performance.now();
    
    function animatePulse(currentTime) {
        // Calculate time difference
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Handle the pulse animation states
        if (ui.minimap.fadeOutActive) {
            // We're in the fade-out stage which is handled by CSS transitions
            // Just wait for the fade-out duration
            ui.minimap.pulseCooldown += deltaTime;
            
            // Once fade-out should be complete (after 300ms) plus some buffer
            if (ui.minimap.pulseCooldown >= 400) {
                // Reset everything for the next pulse cycle
                ui.minimap.fadeOutActive = false;
                ui.minimap.pulseActive = false;
                ui.minimap.pulseRadius = 0;
                ui.minimap.pulseCooldown = 0;
                
                // Reset the ring size to 0 (it's already invisible due to opacity: 0)
                ui.minimap.pulseRing.style.width = '0px';
                ui.minimap.pulseRing.style.height = '0px';
            }
        }
        else if (!ui.minimap.pulseActive) {
            // Waiting cooldown between pulses
            ui.minimap.pulseCooldown += deltaTime;
            
            // Check if cooldown is complete
            if (ui.minimap.pulseCooldown >= ui.minimap.pulseCooldownMax) {
                // Start new pulse
                ui.minimap.pulseActive = true;
                ui.minimap.pulseRadius = 0;
                ui.minimap.pulseCooldown = 0;
                
                // Make pulse visible at the start of a new pulse cycle
                ui.minimap.pulseRing.style.opacity = '0.8';
            }
        } else {
            // Pulse is active and expanding
            ui.minimap.pulseRadius += ui.minimap.pulseSpeed * deltaTime / 1000;
            
            // Update pulse ring visual
            ui.minimap.pulseRing.style.width = `${ui.minimap.pulseRadius * 2}px`;
            ui.minimap.pulseRing.style.height = `${ui.minimap.pulseRadius * 2}px`;
            
            // If pulse has reached max radius, begin fade out
            if (ui.minimap.pulseRadius >= ui.minimap.pulseMaxRadius) {
                // Trigger fade-out transition
                ui.minimap.pulseRing.style.opacity = '0';
                
                // Mark that we're in the fade-out phase
                ui.minimap.fadeOutActive = true;
                ui.minimap.pulseCooldown = 0;
                
                // Keep the size at maximum during fade-out
                // The ring will remain at maximum size while fading out,
                // then be reset to 0 size after fade-out completes
            }
        }
        
        // Continue animation loop
        requestAnimationFrame(animatePulse);
    }
    
    // Start animation
    requestAnimationFrame(animatePulse);
}

// Update UI based on game state
function updateUI(ui, gameState) {
    // Update health bar
    const healthPercent = (gameState.health / gameState.maxHealth) * 100;
    ui.healthBar.style.width = `${healthPercent}%`;
    ui.healthText.textContent = `${Math.round(healthPercent)}%`;
    
    // Change health bar color based on health level
    if (healthPercent < 25) {
        ui.healthBar.style.backgroundImage = 'linear-gradient(90deg, rgba(255,0,0,1) 0%, rgba(255,50,0,1) 50%, rgba(255,0,0,1) 100%)';
        ui.healthBar.classList.add('low-health');
    } else if (healthPercent < 50) {
        ui.healthBar.style.backgroundImage = 'linear-gradient(90deg, rgba(255,100,0,1) 0%, rgba(255,150,0,1) 50%, rgba(255,100,0,1) 100%)';
        ui.healthBar.classList.remove('low-health');
    } else {
        ui.healthBar.style.backgroundImage = 'linear-gradient(90deg, rgba(255,30,30,1) 0%, rgba(255,70,70,1) 50%, rgba(255,30,30,1) 100%)';
        ui.healthBar.classList.remove('low-health');
    }
    
    // Update stamina bar
    const staminaPercent = (gameState.stamina / gameState.maxStamina) * 100;
    ui.staminaBar.style.width = `${staminaPercent}%`;
    
    // Update weapon info
    ui.weaponName.textContent = gameState.weapon.name;
    
    // Check if weapon is reloading
    if (gameState.weapon.isReloading) {
        // Show RELOADING text instead of ammo counter
        ui.ammoCounter.textContent = "RELOADING";
        ui.ammoCounter.style.color = '#ffaa00';
        ui.ammoCounter.style.textShadow = '0 0 10px rgba(255, 150, 0, 0.8)';
        ui.ammoCounter.style.fontSize = '22px'; // Slightly smaller text for "RELOADING"
    } else {
        // Show normal ammo counter
        ui.ammoCounter.textContent = `${gameState.weapon.ammo} / ${gameState.weapon.totalAmmo}`;
        ui.ammoCounter.style.fontSize = '28px'; // Reset to original size
        
        // Change ammo counter color based on ammo level
        if (gameState.weapon.ammo === 0) {
            ui.ammoCounter.style.color = '#ff3333';
            ui.ammoCounter.style.textShadow = '0 0 10px rgba(255, 0, 0, 0.8)';
        } else if (gameState.weapon.ammo <= gameState.weapon.maxAmmo * 0.25) {
            ui.ammoCounter.style.color = '#ffaa00';
            ui.ammoCounter.style.textShadow = '0 0 10px rgba(255, 150, 0, 0.8)';
        } else {
            ui.ammoCounter.style.color = '#00ccff';
            ui.ammoCounter.style.textShadow = '0 0 10px rgba(0, 200, 255, 0.8)';
        }
    }
    
    // Update weapon image
    ui.weaponImage.src = gameState.weapon.image;
}

// Update crosshair position
function updateCrosshair(ui, clientMousePosition) {
    ui.crosshair.style.left = clientMousePosition.x + 'px';
    ui.crosshair.style.top = clientMousePosition.y + 'px';
}

// Update minimap
function updateMinimap(ui, playerPosition, direction, obstacles, zombies) {
    const ctx = ui.minimap.context;
    const scale = ui.minimap.scale;
    const size = ui.minimap.size;
    const currentTime = performance.now();
    
    // Clear minimap
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.restore();
    
    // Draw grid
    ctx.strokeStyle = 'rgba(0, 100, 200, 0.2)';
    ctx.lineWidth = 0.5;
    
    // Draw grid lines
    const gridSize = 10; // World units between grid lines
    const gridRange = ui.minimap.range / 2;
    
    // Calculate grid offset based on player position
    const offsetX = (playerPosition.x % gridSize) * scale;
    const offsetZ = (playerPosition.z % gridSize) * scale;
    
    // Draw vertical grid lines
    for (let x = -gridRange; x <= gridRange; x += gridSize) {
        const screenX = x * scale - offsetX;
        if (Math.abs(screenX) <= size / 2) {
            ctx.beginPath();
            ctx.moveTo(screenX, -size / 2);
            ctx.lineTo(screenX, size / 2);
            ctx.stroke();
        }
    }
    
    // Draw horizontal grid lines
    for (let z = -gridRange; z <= gridRange; z += gridSize) {
        const screenZ = z * scale - offsetZ;
        if (Math.abs(screenZ) <= size / 2) {
            ctx.beginPath();
            ctx.moveTo(-size / 2, screenZ);
            ctx.lineTo(size / 2, screenZ);
            ctx.stroke();
        }
    }
    
    // Draw obstacles if provided
    if (obstacles && obstacles.length > 0) {
        ctx.fillStyle = 'rgba(80, 80, 80, 0.7)';
        
        obstacles.forEach(obstacle => {
            const relX = (obstacle.position.x - playerPosition.x) * scale;
            const relZ = (obstacle.position.z - playerPosition.z) * scale;
            
            // Only draw if within minimap range
            if (Math.abs(relX) < size / 2 && Math.abs(relZ) < size / 2) {
                const width = obstacle.scale.x * scale;
                const height = obstacle.scale.z * scale;
                
                ctx.fillRect(
                    relX - width / 2,
                    relZ - height / 2,
                    width,
                    height
                );
            }
        });
    }
    
    // Draw zombies if provided
    if (zombies && zombies.length > 0) {
        zombies.forEach(zombie => {
            // Skip if zombie is dead
            if (zombie.userData && zombie.userData.isDead) return;
            
            const relX = (zombie.position.x - playerPosition.x) * scale;
            const relZ = (zombie.position.z - playerPosition.z) * scale;
            
            // Only process if within minimap range
            if (Math.abs(relX) < size / 2 && Math.abs(relZ) < size / 2) {
                // Calculate distance from center (0,0) to zombie position on minimap
                const distanceFromCenter = Math.sqrt(relX * relX + relZ * relZ);
                const zombieId = zombie.uuid;
                
                // Check if zombie is within the pulse radius
                if (ui.minimap.pulseActive && distanceFromCenter <= ui.minimap.pulseRadius) {
                    // Zombie revealed by pulse
                    ui.minimap.zombieVisibility[zombieId] = {
                        visible: true,
                        opacity: 0.7,
                        lastRevealTime: currentTime
                    };
                }
                
                // Check if we should draw this zombie
                if (ui.minimap.zombieVisibility[zombieId]) {
                    // Calculate fade effect
                    const timeSinceReveal = currentTime - ui.minimap.zombieVisibility[zombieId].lastRevealTime;
                    const fadeDuration = 5000; // ms before completely faded
                    
                    if (timeSinceReveal < fadeDuration) {
                        // Calculate opacity based on time since last reveal
                        const opacity = 0.7 * (1 - timeSinceReveal / fadeDuration);
                        ui.minimap.zombieVisibility[zombieId].opacity = opacity;
                        
                        // Draw zombie with calculated opacity
                        ctx.fillStyle = `rgba(255, 50, 50, ${opacity})`;
                        ctx.beginPath();
                        ctx.arc(relX, relZ, 2, 0, Math.PI * 2);
                        ctx.fill();
                    } else {
                        // Zombie has faded out completely
                        delete ui.minimap.zombieVisibility[zombieId];
                    }
                }
            }
        });
    }
    
    // Update player direction indicator
    const angle = Math.atan2(direction.x, direction.z);
    ui.minimap.playerIndicator.style.transform = `translate(-50%, -50%) rotateZ(${angle}rad)`;
}

// Export UI functions
export {
    initializeUI,
    initializeMinimap,
    updateUI,
    updateCrosshair,
    updateMinimap
}; 