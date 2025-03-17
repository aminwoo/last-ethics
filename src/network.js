import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createPlayer, animatePlayerLegs } from './player.js';
import SoundManager from './sound.js';

// WebSocket connection and player tracking
let socket;
let playerId;
window.playerId = null; // Expose to global for chat functionality
let remotePlayers = new Map(); // Map of remote player IDs to their THREE.Group objects
let onPlayersUpdated = null; // Callback function when player list changes

// Debug helpers
let debugElement = null;
let showDetailedDebug = false;

// Chat message handling
let chatMessages = []; // Store recent chat messages
let onChatMessageReceived = null; // Callback when chat message is received
const MAX_CHAT_MESSAGES = 50; // Maximum number of chat messages to store

// Remote player SMG sound implementation
let remoteSmgSounds = new Map(); // Map of player IDs to their active SMG sound instances
let audioInitialized = false;

/**
 * Initialize audio context for remote player sounds
 * This should be called after user interaction to satisfy browser autoplay policies
 */
function initRemotePlayerAudio() {
    if (audioInitialized) return;
    
    // Create and play a silent sound to initialize audio context
    try {
        const silentSound = new Audio('./sounds/smg.mp3');
        silentSound.volume = 0.001; // Nearly silent
        
        // Attempt to play the sound
        const playPromise = silentSound.play();
        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // Successfully initialized audio
                    audioInitialized = true;
                    
                    // Stop the silent sound after a short time
                    setTimeout(() => {
                        silentSound.pause();
                        silentSound.currentTime = 0;
                    }, 100);
                })
                .catch(error => {
                    // Error handling
                });
        }
    } catch (error) {
        // Error handling
    }
}

// Add event listener for toggling detailed debug info
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') {
        showDetailedDebug = !showDetailedDebug;
        if (debugElement) {
            debugElement.style.maxHeight = showDetailedDebug ? '500px' : '250px';
        }
    }
});

/**
 * Create a debug display to show player positions
 */
function createDebugDisplay() {
    if (debugElement) return;
    
    debugElement = document.createElement('div');
    debugElement.id = 'network-debug';
    debugElement.style.position = 'absolute';
    debugElement.style.top = '40px';
    debugElement.style.right = '200px';
    debugElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    debugElement.style.color = '#00ff00';
    debugElement.style.padding = '10px';
    debugElement.style.borderRadius = '5px';
    debugElement.style.fontFamily = 'monospace';
    debugElement.style.fontSize = '12px';
    debugElement.style.zIndex = '1000';
    debugElement.style.maxWidth = '350px';
    debugElement.style.maxHeight = '250px';
    debugElement.style.overflow = 'auto';
    
    document.body.appendChild(debugElement);
}

/**
 * Update the debug display with current player information
 */
function updateDebugDisplay() {
    if (!debugElement) return;
    
    let html = '<strong>NETWORK DEBUG</strong> (Press M to toggle details)<br>';
    html += `Local Player ID: ${playerId || 'Not connected'}<br>`;
    html += `Connection Status: ${socket ? 
        (socket.readyState === WebSocket.OPEN ? 'Connected' : 'Not connected') : 
        'No socket'}<br>`;
    html += `Remote Players: ${remotePlayers.size}<br>`;
    
    if (showDetailedDebug) {
        // Show local player info if connected
        if (playerId && window.gameScene) {
            const localPlayer = window.gameScene.getObjectByName('player');
            if (localPlayer) {
                html += '<br><strong>LOCAL PLAYER:</strong><br>';
                html += `Position: x=${localPlayer.position.x.toFixed(1)}, ` +
                    `y=${localPlayer.position.y.toFixed(1)}, ` +
                    `z=${localPlayer.position.z.toFixed(1)}<br>`;
                html += `Rotation: y=${localPlayer.rotation.y.toFixed(2)}<br>`;
            }
        }
        
        // Show remote players info
        if (remotePlayers.size > 0) {
            html += '<br><strong>REMOTE PLAYERS:</strong><br>';
            remotePlayers.forEach((playerObj, id) => {
                html += `Player ${id}:<br>`;
                html += `- Position: x=${playerObj.position.x.toFixed(1)}, ` +
                    `y=${playerObj.position.y.toFixed(1)}, ` +
                    `z=${playerObj.position.z.toFixed(1)}<br>`;
                html += `- Rotation: y=${playerObj.rotation.y.toFixed(2)}<br>`;
                html += `- Visible: ${playerObj.visible}<br>`;
                html += `- Elements: ${playerObj.children.length}<br>`;
            });
            
            // Add server connection details
            html += '<br><strong>CONNECTION DETAILS:</strong><br>';
            html += `Socket state: ${socket ? socket.readyState : 'No socket'}<br>`;
            html += `Last message: ${new Date().toLocaleTimeString()}<br>`;
        } else {
            html += '<br>No remote players connected<br>';
        }
    }
    
    debugElement.innerHTML = html;
}

/**
 * Create a CSS2D name tag for a player
 * @param {string} playerId - The player's ID
 * @param {string} playerName - The player's name (optional)
 * @param {boolean} isLocal - Whether this is the local player
 * @returns {CSS2DObject} The name tag object
 */
function createPlayerNameTag(playerId, playerName = null, isLocal = false) {
    // Create the HTML element for the name tag
    const nameTagElement = document.createElement('div');
    nameTagElement.className = `player-nametag ${isLocal ? 'local' : 'remote'}`;
    
    // If we have a player name, use it, otherwise just show the ID
    const displayName = playerName || `Player ${playerId}`;
    nameTagElement.textContent = displayName;
    
    // Create the CSS2D object and position it above the player
    const nameTag = new CSS2DObject(nameTagElement);
    nameTag.position.set(0, 2.5, 0); // Position above player's head
    
    return nameTag;
}

/**
 * Create a flashlight for a remote player
 * @param {THREE.Object3D} playerObject - The remote player object
 * @param {THREE.Scene} scene - The game scene
 * @returns {Object} The flashlight object
 */
function createRemotePlayerFlashlight(playerObject, scene) {
    // Create a group to hold the flashlight and its target
    const flashlightGroup = new THREE.Group();
    
    // Create the flashlight target
    const flashlightTarget = new THREE.Object3D();
    flashlightTarget.position.set(0, 0, -5);
    flashlightGroup.add(flashlightTarget);
    scene.add(flashlightTarget); // Target needs to be in the scene for the spotlight to work
    
    // Create the flashlight with lower intensity than the main player
    const flashlight = new THREE.SpotLight(0xffffff, 40, 25, Math.PI / 8, 0.6, 1);
    flashlight.position.set(0, 1.5, 0);
    flashlight.target = flashlightTarget;
    flashlight.castShadow = true;
    
    // Configure shadows for lower quality (for performance)
    flashlight.shadow.mapSize.width = 512;
    flashlight.shadow.mapSize.height = 512;
    flashlight.shadow.camera.near = 0.5;
    flashlight.shadow.camera.far = 25;
    
    // Add the flashlight to the group
    flashlightGroup.add(flashlight);
    
    // Add a small point light at the flashlight position to create a glow effect
    const flashlightGlow = new THREE.PointLight(0xffffcc, 1.5, 2);
    flashlightGlow.position.copy(flashlight.position);
    flashlightGroup.add(flashlightGlow);
    
    // Add the group to the scene
    scene.add(flashlightGroup);
    
    return {
        group: flashlightGroup,
        light: flashlight,
        target: flashlightTarget,
        glow: flashlightGlow
    };
}

/**
 * Update a remote player's flashlight based on player position and rotation
 * @param {Object} flashlight - The flashlight object
 * @param {THREE.Vector3} playerPosition - The player's position
 * @param {THREE.Euler} playerRotation - The player's rotation
 */
function updateRemotePlayerFlashlight(flashlight, playerPosition, playerRotation) {
    // Update flashlight position to match player
    flashlight.group.position.copy(playerPosition);
    
    // Calculate forward direction based on player rotation
    // In this game, the forward direction is determined by the player's Y rotation (rotation around the Y axis)
    // Using Math.sin/cos to get the correct direction based on the Y rotation angle
    const direction = new THREE.Vector3(
        Math.sin(playerRotation.y), 
        0, 
        Math.cos(playerRotation.y)
    );
    
    // Position flashlight target in front of player based on direction
    const targetDistance = 10;
    flashlight.target.position.copy(playerPosition)
        .add(direction.clone().multiplyScalar(targetDistance));
    
    // Update flashlight and glow position relative to player
    flashlight.light.position.set(0, 1.5, 0);
    flashlight.glow.position.copy(flashlight.light.position);
}

/**
 * Initialize the WebSocket connection to the game server
 * @param {Function} playerUpdatedCallback - Callback when player list changes
 * @param {THREE.Scene} scene - The game scene to add remote players to
 * @returns {Promise} Resolves when connection is established
 */
function initializeNetworking(playerUpdatedCallback, scene) {
    onPlayersUpdated = playerUpdatedCallback;
    
    // Initialize audio for remote players
    initRemotePlayerAudio();
    
    // Create debug display
    createDebugDisplay();
    
    // Determine whether to use local or production WebSocket URL
    // Check if we're on localhost or a real domain
    const isLocalhost = 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '';
    
    let wsUrl;
    if (isLocalhost) {
        // Local development - use local WebSocket server
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = 'localhost';
        const port = 3000; // Match the local server port
        wsUrl = `${protocol}//${host}:${port}`;
    } else {
        // Production environment - use deployed server
        wsUrl = 'wss://last-ethics-server.onrender.com';
    }
    
    return new Promise((resolve, reject) => {
        try {
            socket = new WebSocket(wsUrl);
            
            socket.onopen = () => {
                resolve();
                
                // Send an initial position update immediately after connection
                // This will trigger the server to make this player visible to others
                const playerObject = scene.getObjectByName('player');
                if (playerObject) {
                    sendPlayerUpdate(playerObject);
                } else {
                    // No player object found, but continue with initialization
                }
            };
            
            socket.onerror = (error) => {
                reject(error);
            };
            
            socket.onclose = (event) => {
                // Try to reconnect after a delay if the connection was established before
                if (playerId) {
                    setTimeout(() => {
                        initializeNetworking(playerUpdatedCallback, scene)
                            .catch(() => {});
                    }, 5000);
                }
            };
            
            socket.onmessage = (event) => {
                handleServerMessage(event.data, scene);
            };
        } catch (error) {
            reject(error);
        }
    });
}

/**
 * Process a message from the server
 * @param {string} messageData - The raw message data
 * @param {THREE.Scene} scene - The game scene
 */
function handleServerMessage(messageData, scene) {
    try {
        const message = JSON.parse(messageData);
        
        switch (message.type) {
            case 'init':
                // Store our player ID
                playerId = message.id;
                window.playerId = playerId; // Set global ID for chat
                
                // Add name tag to local player now that we have an ID
                const localPlayer = scene.getObjectByName('player');
                if (localPlayer) {
                    const nameTag = createPlayerNameTag(playerId, null, true);
                    localPlayer.add(nameTag);
                }
                
                // Create representations for existing players
                if (message.players && message.players.length > 0) {
                    message.players.forEach(player => {
                        if (player.id !== playerId) {
                            addRemotePlayer(player, scene);
                        }
                    });
                } 
                
                // Call the callback to update player UI
                if (onPlayersUpdated) {
                    onPlayersUpdated(remotePlayers.size);
                }
                break;
                
            case 'playerNameChanged':
                // Update the player's name tag
                if (message.playerId && message.name) {
                    // If it's our own name change confirmation, update local name tag
                    if (message.playerId === playerId) {
                        const localPlayer = scene.getObjectByName('player');
                        if (localPlayer) {
                            updatePlayerNameTag(localPlayer, message.name);
                        }
                    } else {
                        // Update a remote player's name tag
                        const remotePlayer = remotePlayers.get(message.playerId);
                        if (remotePlayer) {
                            updatePlayerNameTag(remotePlayer, message.name);
                        }
                    }
                }
                break;
                
            case 'playerJoined':
                // Skip if it's our own join message
                if (message.player && message.player.id === playerId) {
                    // This is just a confirmation of our own joining
                    break;
                }
                
                // Add the new player to our scene
                if (message.player) {
                    addRemotePlayer(message.player, scene);
                    
                    // Call the callback to update player UI
                    if (onPlayersUpdated) {
                        onPlayersUpdated(remotePlayers.size);
                    }
                }
                break;
                
            case 'playerLeft':
                if (message.id && message.id !== playerId) {
                    removeRemotePlayer(message.id, scene);
                    
                    // Call the callback to update player UI
                    if (onPlayersUpdated) {
                        onPlayersUpdated(remotePlayers.size);
                    }
                }
                break;
                
            case 'playerDied':
                handleRemotePlayerDeath(message.playerId, message.playerName, scene);
                break;
                
            case 'playerUpdates':
                // Handle bulk updates of all players
                if (Array.isArray(message.players)) {
                    message.players.forEach(playerData => {
                        if (playerData.id !== playerId) {
                            updateRemotePlayer(playerData);
                        }
                    });
                }
                break;
                
            case 'chat':
                // Handle incoming chat message
                addChatMessage(
                    message.playerId,
                    message.playerName,
                    message.message,
                    message.timestamp,
                    message.isSystem
                );
                break;
                
            default:
                // Unhandled message type
                break;
        }
        
        // Update player count in UI if callback exists
        if (message.playerCount !== undefined && onPlayersUpdated) {
            const count = message.playerCount;
            onPlayersUpdated(count);
        }
    } catch (error) {
        // Error in processing message
    }
}

/**
 * Add a new remote player to the scene
 * @param {Object} playerData - Player data from server
 * @param {THREE.Scene} scene - The game scene
 */
function addRemotePlayer(playerData, scene) {
    // Check if player already exists in our map
    if (remotePlayers.has(playerData.id)) {
        // Player already exists, just update their position
        updateRemotePlayerTransform(remotePlayers.get(playerData.id), playerData);
        return;
    }
    
    // Create new remote player
    const remotePlayer = createPlayer({
        isRemote: true,
        position: playerData.position || { x: 0, y: 0, z: 0 },
        rotation: playerData.rotation || { x: 0, y: 0, z: 0 },
        name: playerData.name || `Player ${playerData.id}`
    });
    
    // Set the player ID in userData for reference
    remotePlayer.userData.playerId = playerData.id;
    
    // Add a name tag to the remote player
    const nameTag = createPlayerNameTag(playerData.id, playerData.name);
    remotePlayer.add(nameTag);
    
    // Create a flashlight for the remote player
    const flashlight = createRemotePlayerFlashlight(remotePlayer, scene);
    remotePlayer.userData.flashlight = flashlight;
    
    // Add player to the map and scene
    remotePlayers.set(playerData.id, remotePlayer);
    scene.add(remotePlayer);
}

/**
 * Update the position, rotation, and animation of a remote player
 * @param {THREE.Object3D} playerObject - The remote player object
 * @param {Object} playerData - Updated player data from server
 */
function updateRemotePlayerTransform(playerObject, playerData) {
    // Store previous position to detect movement
    const prevPosition = playerObject.position.clone();
    
    // Update position
    if (playerData.position) {
        playerObject.position.set(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );
    }
    
    // Update rotation
    if (playerData.rotation) {
        playerObject.rotation.set(
            playerData.rotation.x,
            playerData.rotation.y,
            playerData.rotation.z
        );
    }
    
    // Update the player's flashlight if it exists
    if (playerObject.userData.flashlight) {
        updateRemotePlayerFlashlight(
            playerObject.userData.flashlight,
            playerObject.position,
            playerObject.rotation
        );
    }
    
    // Track whether player was previously firing
    const wasFiring = playerObject.userData.isFiring === true;
    const weaponType = playerObject.userData.weaponType;
    
    // Update firing state
    playerObject.userData.isFiring = playerData.isFiring;
    playerObject.userData.weaponType = playerData.weaponType;
    
    // Handle weapon firing
    if (playerData.isFiring) {
        // Create muzzle flash for remote player
        createRemotePlayerMuzzleFlash(playerObject, playerData.weaponType);
        
        // Play appropriate weapon sound
        playRemotePlayerWeaponSound(playerData.weaponType, playerData.id);
    } 
    // Check if player stopped firing an Assault Rifle
    else if (wasFiring && !playerData.isFiring && weaponType === 'Assault Rifle') {
        // Stop the remote SMG sound
        stopRemoteSmgSound(playerData.id);
    }
    
    // Check if player is moving by comparing positions
    const isMoving = prevPosition.distanceTo(playerObject.position) > 0.01;
    
    // Initialize userData if it doesn't exist yet (for animation state)
    if (!playerObject.userData.animationTime) {
        playerObject.userData.animationTime = 0;
        playerObject.userData.walkSpeed = 1.0;
    }
    
    // Animate the player based on movement
    // Using a small deltaTime value for smooth animation
    const deltaTime = 0.016; // ~60fps
    animatePlayerLegs(playerObject, isMoving, deltaTime, false);
    
    // Ensure stale sounds are cleaned up on every player transform update
    if (playerData.id) {
        // This is a critical spot where we need to ensure weapon sounds
        // are properly managed, especially for Assault Rifle
        cleanupStaleSounds();
    }
}

/**
 * Remove a remote player
 * @param {string} playerId - The ID of the player to remove
 * @param {THREE.Scene} scene - The game scene
 */
function removeRemotePlayer(playerId, scene) {
    if (!remotePlayers.has(playerId)) {
        return;
    }
    
    const playerObject = remotePlayers.get(playerId);
    
    // Stop any active SMG sound for this player
    stopRemoteSmgSound(playerId);
    
    // Find and explicitly dispose of all CSS2D objects (name tags)
    const css2DObjects = [];
    playerObject.traverse((child) => {
        if (child instanceof CSS2DObject) {
            css2DObjects.push(child);
            
            // Remove the HTML element from the DOM
            if (child.element && child.element.parentNode) {
                child.element.parentNode.removeChild(child.element);
            }
        }
    });
    
    // Remove CSS2D objects from parent before removing the player
    css2DObjects.forEach(obj => {
        if (obj.parent) {
            obj.parent.remove(obj);
        }
    });
    
    // Remove flashlight if it exists
    if (playerObject.userData.flashlight) {
        if (playerObject.userData.flashlight.group) {
            scene.remove(playerObject.userData.flashlight.group);
        }
        if (playerObject.userData.flashlight.target) {
            scene.remove(playerObject.userData.flashlight.target);
        }
    }
    
    // Remove player from scene
    scene.remove(playerObject);
    
    // Remove from tracking Map
    remotePlayers.delete(playerId);
}

/**
 * Send the local player's position and rotation to the server
 * @param {THREE.Object3D} playerObject - The local player object
 */
function sendPlayerUpdate(playerObject, isFiring = false, weaponType = null) {
    if (!socket) {
        return;
    }
    
    if (socket.readyState !== WebSocket.OPEN) {
        return;
    }
    
    const message = {
        type: 'update',
        position: {
            x: playerObject.position.x,
            y: playerObject.position.y,
            z: playerObject.position.z
        },
        rotation: {
            x: playerObject.rotation.x,
            y: playerObject.rotation.y,
            z: playerObject.rotation.z
        },
        isFiring: isFiring,
        weaponType: weaponType
    };
    
    socket.send(JSON.stringify(message));
}

/**
 * Get the number of connected remote players
 * @returns {number} The number of remote players
 */
function getRemotePlayerCount() {
    return remotePlayers.size;
}

/**
 * Get the map of remote players
 * @returns {Map} Map of remote player IDs to their THREE.Group objects
 */
function getRemotePlayers() {
    return remotePlayers;
}

/**
 * Clean up networking resources when shutting down
 */
function cleanupNetworking() {
    // Close socket if it exists
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
    
    // Reset variables
    socket = null;
    
    // Stop all remote player SMG sounds
    remoteSmgSounds.forEach((soundData, id) => {
        if (soundData.active) {
            stopRemoteSmgSound(id);
        }
    });
    
    // Clear the remote players map
    remotePlayers.clear();
    
    // Remove debug display if it exists
    if (debugElement && debugElement.parentNode) {
        debugElement.parentNode.removeChild(debugElement);
        debugElement = null;
    }
}

/**
 * Clean up any stale sound instances that haven't been updated recently
 * This helps prevent stuck sounds if we miss a player stopping firing
 */
function cleanupStaleSounds() {
    const now = Date.now();
    const STALE_THRESHOLD = 300; // Reduced from 500ms to 300ms for more aggressive cleanup
    
    remoteSmgSounds.forEach((soundData, playerId) => {
        if (soundData.active && (now - soundData.lastUpdated > STALE_THRESHOLD)) {
            stopRemoteSmgSound(playerId);
        }
    });
}

/**
 * Update networking state
 */
function updateNetworking() {
    // Update debug display
    updateDebugDisplay();
    
    // Cleanup any stale sound instances
    cleanupStaleSounds();
    
    // Update animations for remote players
    const deltaTime = 0.016; // ~60fps
    remotePlayers.forEach((playerObject) => {
        // If the player has been marked as moving, continue animation
        if (playerObject.userData.isWalking) {
            animatePlayerLegs(playerObject, true, deltaTime, false);
        }
    });
}

/**
 * Send a chat message to all players
 * @param {string} message - The chat message text
 * @returns {boolean} - Success status
 */
function sendChatMessage(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    
    socket.send(JSON.stringify({
        type: 'chat',
        message: message
    }));
    
    return true;
}

/**
 * Set the player's display name
 * @param {string} name - The name to set
 * @returns {boolean} - Success status
 */
function setPlayerName(name) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    
    // Trim and limit name length
    const trimmedName = name.trim().substring(0, 20);
    
    socket.send(JSON.stringify({
        type: 'setName',
        name: trimmedName
    }));
    
    return true;
}

/**
 * Get all recent chat messages
 * @returns {Array} Array of chat messages
 */
function getChatMessages() {
    return [...chatMessages];
}

/**
 * Set callback for when a chat message is received
 * @param {Function} callback - Function to call when a chat message is received
 */
function setChatMessageCallback(callback) {
    onChatMessageReceived = callback;
}

/**
 * Add a chat message to the chat history
 * @param {string} playerId - ID of the player who sent the message
 * @param {string} playerName - Name of the player who sent the message
 * @param {string} message - The message text
 * @param {number} timestamp - When the message was sent
 * @param {boolean} isSystem - Whether this is a system message
 */
function addChatMessage(playerId, playerName, message, timestamp, isSystem = false) {
    // Create a chat message object
    const chatMessage = {
        id: Date.now() + Math.random().toString(36).substr(2, 9), // Unique ID
        playerId,
        playerName,
        message,
        timestamp: timestamp || Date.now(),
        isSystem,
        isSelf: String(playerId) === String(window.playerId) // Whether this message was sent by the local player
    };
    
    // Add message to chat history
    chatMessages.push(chatMessage);
    
    // Limit chat message history size
    if (chatMessages.length > MAX_CHAT_MESSAGES) {
        chatMessages.shift(); // Remove oldest message
    }
    
    // Call callback if set
    if (onChatMessageReceived) {
        onChatMessageReceived(chatMessage);
    }
}

/**
 * Update a player's name tag
 * @param {THREE.Object3D} playerObject - The player object
 * @param {string} newName - The new name to display
 */
function updatePlayerNameTag(playerObject, newName) {
    // Find the CSS2DObject in the player's children
    playerObject.traverse((child) => {
        if (child instanceof CSS2DObject) {
            // Update the HTML element's text content
            const nameTagElement = child.element;
            if (nameTagElement && nameTagElement.classList.contains('player-nametag')) {
                nameTagElement.textContent = newName;
            }
        }
    });
}

/**
 * Update the position and rotation of a remote player
 * @param {Object} playerData - Updated player data from server
 */
function updateRemotePlayer(playerData) {
    const remotePlayer = remotePlayers.get(playerData.id);
    if (remotePlayer) {
        updateRemotePlayerTransform(remotePlayer, playerData);
    } else {
        // If we get an update for a player we don't know about, add them
        // This can happen if we missed the playerJoined message
        const scene = window.gameScene; // Make sure gameScene is set in main.js
        if (scene) {
            addRemotePlayer(playerData, scene);
        }
    }
    
    // Check for stale sounds with each player update
    // This ensures we stop sounds quickly if a player stops firing but we miss the event
    cleanupStaleSounds();
}

/**
 * Calculates the gun barrel position and direction for a remote player
 * @param {THREE.Object3D} playerObject - The remote player object
 * @param {string} weaponType - The type of weapon
 * @returns {Object} Object containing gunTip position and direction vector
 */
function calculateRemotePlayerGunPosition(playerObject, weaponType) {
    let weaponObj = null;
    let gunTip = new THREE.Vector3();
    let direction = new THREE.Vector3(0, 0, 1);
    
    // Traverse the player object to find the weapon and barrel
    playerObject.traverse((child) => {
        // Look for weapons based on name
        if (child.name) {
            const lowerName = child.name.toLowerCase();
            
            if ((weaponType === 'Pistol' && lowerName.includes('pistol')) ||
                (weaponType === 'Shotgun' && lowerName.includes('shotgun')) ||
                (weaponType === 'Assault Rifle' && lowerName.includes('assault')) ||
                (weaponType === 'Sniper Rifle' && lowerName.includes('sniper'))) {
                
                weaponObj = child;
            }
            
            // Look specifically for barrel objects
            if (lowerName.includes('barrel')) {
                // If we find a specific barrel that matches the weapon type, use it directly
                if ((weaponType === 'Pistol' && lowerName.includes('pistol')) ||
                    (weaponType === 'Shotgun' && lowerName.includes('shotgun')) ||
                    (weaponType === 'Assault Rifle' && lowerName.includes('assault')) ||
                    (weaponType === 'Sniper Rifle' && lowerName.includes('sniper'))) {
                    
                    // Get the world position of the barrel
                    child.getWorldPosition(gunTip);
                    
                    // Get barrel direction
                    direction.set(0, 0, 1).applyQuaternion(child.getWorldQuaternion(new THREE.Quaternion()));
                    
                    // We found the exact barrel, no need to continue searching
                    return;
                }
            }
        }
    });
    
    // If we found a weapon object but not a specific barrel
    if (weaponObj && gunTip.length() === 0) {
        // Look for barrel within the weapon
        let barrel = null;
        weaponObj.traverse((child) => {
            if (child.name && child.name.includes('Barrel')) {
                barrel = child;
            }
        });
        
        if (barrel) {
            // Get the world position of the barrel tip
            barrel.getWorldPosition(gunTip);
            
            // Get barrel direction
            direction.set(0, 0, 1).applyQuaternion(barrel.getWorldQuaternion(new THREE.Quaternion()));
        } else {
            // If no barrel found, use weapon object position
            weaponObj.getWorldPosition(gunTip);
            
            // Get weapon direction
            direction.set(0, 0, 1).applyQuaternion(weaponObj.getWorldQuaternion(new THREE.Quaternion()));
        }
    }
    
    // Fallback if we couldn't find any weapon or barrel
    if (gunTip.length() === 0) {
        // Calculate direction from player rotation
        direction.set(0, 0, 1).applyQuaternion(playerObject.quaternion);
        
        // Estimate gun position based on player position
        gunTip.copy(playerObject.position);
        gunTip.y += 1.5; // Adjust for player height
        
        // Move forward and to the right to approximate gun position
        gunTip.add(direction.clone().multiplyScalar(1.2));
        
        const rightVector = new THREE.Vector3(1, 0, 0);
        rightVector.applyQuaternion(playerObject.quaternion);
        gunTip.add(rightVector.multiplyScalar(0.3));
    }

    direction.y = 0; 
    direction.normalize();
    
    return { gunTip, direction };
}

/**
 * Creates a muzzle flash effect for a remote player
 * @param {THREE.Object3D} playerObject - The remote player object
 * @param {string} weaponType - The type of weapon being fired
 */
function createRemotePlayerMuzzleFlash(playerObject, weaponType) {
    const scene = window.gameScene;
    if (!scene) return;
    
    // Get the exact gun position and direction
    const { gunTip, direction } = calculateRemotePlayerGunPosition(playerObject, weaponType);
    
    // Create a point light for muzzle flash
    const flashLight = new THREE.PointLight(0xffff00, 2, 10);
    
    // Position the flash at the gun tip
    flashLight.position.copy(gunTip);
    
    // Customize based on weapon type
    switch(weaponType) {
        case 'Shotgun':
            flashLight.color.set(0xff8800); // Orange
            flashLight.intensity = 3;
            flashLight.distance = 12;
            break;
        case 'Assault Rifle':
            flashLight.color.set(0xff4400); // Orange-red
            flashLight.intensity = 2.5;
            flashLight.distance = 8;
            break;
        case 'Sniper Rifle':
            flashLight.color.set(0xffffaa); // Bright yellow
            flashLight.intensity = 4;
            flashLight.distance = 15;
            break;
        default: // Pistol or default
            flashLight.color.set(0xffff00); // Yellow
            flashLight.intensity = 2;
            flashLight.distance = 6;
    }
    
    // Add the flash light to the scene
    scene.add(flashLight);
    
    // Remove after a short time
    setTimeout(() => {
        scene.remove(flashLight);
    }, 100); // Flash lasts for 100ms
    
    // Create bullets for remote player
    createRemotePlayerBullets(scene, playerObject, weaponType);
}

/**
 * Creates bullets for a remote player when they fire
 * @param {THREE.Scene} scene - The game scene
 * @param {THREE.Object3D} playerObject - The remote player object
 * @param {string} weaponType - The type of weapon being fired
 */
function createRemotePlayerBullets(scene, playerObject, weaponType) {
    // Get weapon properties based on weapon type
    let bulletColor, bulletsPerShot, bulletSpread, bulletSpeed;
    
    switch(weaponType) {
        case 'Shotgun':
            bulletColor = 0xff8800; // Orange
            bulletsPerShot = 8;
            bulletSpread = 0.2;
            bulletSpeed = 0.4;
            break;
        case 'Assault Rifle':
            bulletColor = 0xff0000; // Red
            bulletsPerShot = 1;
            bulletSpread = 0.05;
            bulletSpeed = 0.6;
            break;
        case 'Sniper Rifle':
            bulletColor = 0x00ffff; // Cyan
            bulletsPerShot = 1;
            bulletSpread = 0.01;
            bulletSpeed = 1.3;
            break;
        default: // Pistol or default
            bulletColor = 0xffff00; // Yellow
            bulletsPerShot = 1;
            bulletSpread = 0.15;
            bulletSpeed = 1.5;
    }
    
    // Get the exact gun position and direction
    const { gunTip, direction } = calculateRemotePlayerGunPosition(playerObject, weaponType);
    
    // Get the bullet model from weapons.js or create a simple one if not available
    let bulletMesh;
    if (window.getBulletModel && window.getBulletModel()) {
        bulletMesh = window.getBulletModel().clone();
    } else {
        // Create a simple bullet if the model isn't available
        const bulletGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8);
        bulletGeometry.rotateX(Math.PI / 2);  // Rotate to point forward
        const bulletMaterial = new THREE.MeshStandardMaterial({ 
            color: bulletColor,
            emissive: bulletColor,
            emissiveIntensity: 0.8,
            metalness: 0.8,
            roughness: 0.2
        });
        bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial);
    }
    
    // Fire multiple bullets based on weapon type
    for (let i = 0; i < bulletsPerShot; i++) {
        // Clone the bullet for this shot
        const bullet = bulletMesh.clone();
        bullet.position.copy(gunTip);
        
        // Calculate direction with spread
        let bulletDirection = direction.clone();
        
        // Apply spread based on weapon type
        if (weaponType === "Shotgun") {
            // Add spread pattern for shotgun
            const angle = (i / bulletsPerShot) * Math.PI * 2;
            const radius = 0.1; // Initial spread radius
            
            // Calculate spread offset perpendicular to direction
            const perpX = new THREE.Vector3().crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
            const perpY = new THREE.Vector3().crossVectors(direction, perpX).normalize();
            
            bullet.position.add(perpX.multiplyScalar(Math.cos(angle) * radius));
            bullet.position.add(perpY.multiplyScalar(Math.sin(angle) * radius));
            
            // Add conical spread
            const spreadAngle = bulletSpread * (1 - (i / bulletsPerShot));
            bulletDirection.x += (Math.random() - 0.5) * spreadAngle;
            bulletDirection.y += (Math.random() - 0.5) * spreadAngle * 0.5;
            bulletDirection.z += (Math.random() - 0.5) * spreadAngle;
        } else {
            // Add random spread for other weapons
            bulletDirection.x += (Math.random() - 0.5) * bulletSpread;
            bulletDirection.y += (Math.random() - 0.5) * bulletSpread;
            bulletDirection.z += (Math.random() - 0.5) * bulletSpread;
        }
        bulletDirection.normalize();
        
        // Set bullet orientation to face the direction
        bullet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), bulletDirection);
        
        // Create trail for the bullet
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: bulletColor,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
        });
        
        // Create trail points
        const trailLength = 20;
        const trailPositions = new Float32Array(trailLength * 3);
        
        // Initialize all trail positions to bullet's starting position
        for (let j = 0; j < trailLength; j++) {
            trailPositions[j * 3] = bullet.position.x;
            trailPositions[j * 3 + 1] = bullet.position.y;
            trailPositions[j * 3 + 2] = bullet.position.z;
        }
        
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        scene.add(trail);
        
        // Add bullet light
        const bulletLight = new THREE.PointLight(bulletColor, 0.5, 2);
        bulletLight.position.copy(bullet.position);
        scene.add(bulletLight);
        
        // Add bullet to scene
        scene.add(bullet);
        
        // Calculate velocity
        const velocity = bulletDirection.clone().multiplyScalar(
            weaponType === "Shotgun" ? bulletSpeed * (0.7 + Math.random() * 0.3) : bulletSpeed
        );
        
        // Store the bullet data for animation
        if (window.addRemoteBullet) {
            window.addRemoteBullet({
                mesh: bullet,
                light: bulletLight,
                trail: trail,
                trailPositions: trailPositions,
                direction: bulletDirection,
                velocity: velocity,
                speed: bulletSpeed,
                createdAt: Date.now(),
                maxDistance: 50,
                distance: 0
            });
        } else {
            // If the global addRemoteBullet function isn't available, add a simple self-cleanup
            // This bullet won't be animated properly but will at least be removed
            setTimeout(() => {
                scene.remove(bullet);
                scene.remove(trail);
                scene.remove(bulletLight);
            }, 1500);
        }
    }
}

/**
 * Plays weapon sounds for remote players with distance-based volume
 * @param {string} weaponType - The type of weapon being fired
 * @param {string} playerId - The ID of the remote player
 */
function playRemotePlayerWeaponSound(weaponType, playerId) {
    if (!playerId) {
        return;
    }
    
    // Play appropriate weapon sound at reduced volume for remote players
    switch(weaponType) {
        case 'Shotgun':
            if (SoundManager.playShotgunShot) {
                SoundManager.playShotgunShot(0.5); // 50% volume
            }
            break;
        case 'Sniper Rifle':
            if (SoundManager.playPistolShot) {
                SoundManager.playPistolShot(0.5);
            }
            break;
        default: // Pistol or default
            if (SoundManager.playPistolShot) {
                SoundManager.playPistolShot(0.5);
            }
    }
}

/**
 * Send a notification to all players that the local player has died
 */
function sendPlayerDeathEvent() {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    
    socket.send(JSON.stringify({
        type: 'playerDeath'
    }));
    
    return true;
}

/**
 * Handle a remote player death event
 * @param {string} deadPlayerId - The ID of the player who died
 * @param {string} playerName - The name of the player who died
 * @param {THREE.Scene} scene - The game scene
 */
function handleRemotePlayerDeath(deadPlayerId, playerName, scene) {
    // Get the player object if available
    const playerObject = remotePlayers.get(deadPlayerId);
    
    if (playerObject) {
        // Create death effect at player position
        createPlayerDeathEffect(playerObject.position, scene);
        
        // Remove the player from the scene
        removeRemotePlayer(deadPlayerId, scene);
    }
}

/**
 * Create visual effect for player death
 * @param {THREE.Vector3} position - Position where the player died
 * @param {THREE.Scene} scene - The game scene
 */
function createPlayerDeathEffect(position, scene) {
    // Create particle effect
    const particleCount = 50;
    const particles = new THREE.Group();
    
    // Create particles in different colors
    const colors = [0xff0000, 0xdd0000, 0xaa0000]; // Different shades of red
    
    for (let i = 0; i < particleCount; i++) {
        const size = 0.1 + Math.random() * 0.3;
        const geometry = new THREE.SphereGeometry(size, 4, 4);
        const material = new THREE.MeshBasicMaterial({
            color: colors[Math.floor(Math.random() * colors.length)],
            transparent: true,
            opacity: 0.8
        });
        
        const particle = new THREE.Mesh(geometry, material);
        
        // Position slightly above ground
        particle.position.set(
            position.x + (Math.random() * 2 - 1) * 2,
            position.y + 1 + Math.random() * 2,
            position.z + (Math.random() * 2 - 1) * 2
        );
        
        // Add random velocity
        particle.userData.velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 0.3,
            Math.random() * 0.4,
            (Math.random() - 0.5) * 0.3
        );
        
        particles.add(particle);
    }
    
    // Add particles to scene
    scene.add(particles);
    
    // Animate particles
    const startTime = Date.now();
    const duration = 2000; // 2 seconds
    
    function animateParticles() {
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime > duration) {
            // Animation complete, remove particles
            scene.remove(particles);
            return;
        }
        
        // Update particle positions based on velocity and gravity
        particles.children.forEach(particle => {
            particle.position.add(particle.userData.velocity);
            particle.userData.velocity.y -= 0.01; // Gravity
            
            // Fade out over time
            const opacity = 0.8 * (1 - elapsedTime / duration);
            particle.material.opacity = opacity;
        });
        
        // Continue animation
        requestAnimationFrame(animateParticles);
    }
    
    // Start animation
    animateParticles();
    
    // Add a flash of light at the death position
    const flash = new THREE.PointLight(0xff4444, 5, 10);
    flash.position.copy(position);
    flash.position.y += 1;
    scene.add(flash);
    
    // Remove the flash after a short time
    setTimeout(() => {
        scene.remove(flash);
    }, 300);
}

// Export networking functions
export {
    initializeNetworking,
    sendPlayerUpdate,
    getRemotePlayerCount,
    getRemotePlayers,
    cleanupNetworking,
    updateNetworking,
    setPlayerName,
    getChatMessages,
    setChatMessageCallback,
    sendChatMessage,
    createPlayerNameTag,
    createRemotePlayerFlashlight,
    updateRemotePlayerFlashlight,
    sendPlayerDeathEvent,
    initRemotePlayerAudio
}; 