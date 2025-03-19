// Input management for the game

// Initialize input state
function initializeInput() {
    return {
        // Keyboard controls
        keys: {
            w: false,
            a: false,
            s: false,
            d: false,
            shift: false
        },
        // Mouse position
        mousePosition: { x: 0, y: 0 },
        clientMousePosition: { x: 0, y: 0 },
        // Mouse buttons
        mouseDown: false,
        // Flag to disable input (when inventory is open, etc.)
        inputDisabled: false,
        // Flag to indicate inventory mode
        inventoryModifier: false
    };
}

// Disable/enable input
function setInputDisabled(inputState, disabled) {
    inputState.inputDisabled = disabled;
    
    // Reset all keys when disabling input
    if (disabled) {
        inputState.keys.w = false;
        inputState.keys.a = false;
        inputState.keys.s = false;
        inputState.keys.d = false;
        inputState.keys.shift = false;
        inputState.mouseDown = false;
    }
}

// Set up keyboard event listeners
function setupKeyboardListeners(inputState, callbacks) {
    window.addEventListener('keydown', (event) => {
        // Skip input processing if disabled (except for inventory toggle)
        if (inputState.inputDisabled && event.key.toLowerCase() !== 'i') {
            return;
        }
        
        switch (event.key.toLowerCase()) {
            case 'w': inputState.keys.w = true; break;
            case 'a': inputState.keys.a = true; break;
            case 's': inputState.keys.s = true; break;
            case 'd': inputState.keys.d = true; break;
            case 'shift': inputState.keys.shift = true; break;
            case 'r': 
                if (callbacks.onReload) callbacks.onReload();
                break;
            case 'f':
                if (callbacks.onFlashlightToggle) callbacks.onFlashlightToggle();
                break;
            case '1': 
                if (callbacks.onWeaponSwitch) callbacks.onWeaponSwitch(0);
                break;
            case '2': 
                if (callbacks.onWeaponSwitch) callbacks.onWeaponSwitch(1);
                break;
            case '3': 
                if (callbacks.onWeaponSwitch) callbacks.onWeaponSwitch(2);
                break;
            case '4': 
                if (callbacks.onWeaponSwitch) callbacks.onWeaponSwitch(3);
                break;
            // Add test mode keys
            case 't': 
                if (callbacks.onTestZombies) callbacks.onTestZombies();
                break;
            case 'y': 
                if (callbacks.onTestZombieHorde) callbacks.onTestZombieHorde();
                break;
            case 'u': 
                if (callbacks.onTestZombieDamage) callbacks.onTestZombieDamage();
                break;
            case 'i':
                if (callbacks.onInventoryToggle) callbacks.onInventoryToggle();
                break;
        }
    });

    window.addEventListener('keyup', (event) => {
        switch (event.key.toLowerCase()) {
            case 'w': inputState.keys.w = false; break;
            case 'a': inputState.keys.a = false; break;
            case 's': inputState.keys.s = false; break;
            case 'd': inputState.keys.d = false; break;
            case 'shift': inputState.keys.shift = false; break;
        }
    });
}

// Set up mouse event listeners
function setupMouseListeners(inputState, callbacks) {
    window.addEventListener('mousemove', (event) => {
        // Always update mouse position even when input is disabled
        // (needed for UI interactions)
        
        // Calculate mouse position in normalized device coordinates
        inputState.mousePosition.x = (event.clientX / window.innerWidth) * 2 - 1;
        inputState.mousePosition.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Update client mouse position for crosshair
        inputState.clientMousePosition.x = event.clientX;
        inputState.clientMousePosition.y = event.clientY;
        
        // Call the onMouseMove callback if provided
        if (callbacks.onMouseMove) {
            callbacks.onMouseMove(inputState.clientMousePosition);
        }
    });

    // Add mouse click event for shooting
    window.addEventListener('click', (event) => {
        // Skip game-world click events if inventory is open
        if (inputState.inventoryModifier) {
            return;
        }
        
        // Skip input processing if completely disabled
        if (inputState.inputDisabled) {
            return;
        }
        
        if (callbacks.onMouseClick) {
            callbacks.onMouseClick(event);
        }
    });
    
    // Add mouse down/up events for automatic weapons
    window.addEventListener('mousedown', (event) => {
        // Skip input processing if completely disabled or if inventory is open
        if (inputState.inputDisabled || inputState.inventoryModifier) {
            return;
        }
        
        inputState.mouseDown = true;
        if (callbacks.onMouseClick) {
            callbacks.onMouseClick(event);
        }
    });
    
    window.addEventListener('mouseup', (event) => {
        inputState.mouseDown = false;
        
        // Skip callback if input is disabled
        if (inputState.inputDisabled) {
            return;
        }
        
        // Call the onMouseUp callback if provided (even when inventory is open)
        if (callbacks.onMouseUp) {
            callbacks.onMouseUp(event);
        }
    });
}

// Set up window resize listener
function setupResizeListener(callback) {
    window.addEventListener('resize', callback);
}

// Export input functions
export {
    initializeInput,
    setupKeyboardListeners,
    setupMouseListeners,
    setupResizeListener,
    setInputDisabled
}; 