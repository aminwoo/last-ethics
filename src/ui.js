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
        weaponImage: document.getElementById('weapon-image')
    };
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

// Export UI functions
export {
    initializeUI,
    updateUI,
    updateCrosshair
}; 