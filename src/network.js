import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { createPlayer, animatePlayerLegs } from './player.js';

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

// Add event listener for toggling detailed debug info
document.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'm') {
        showDetailedDebug = !showDetailedDebug;
        console.log(`Debug details ${showDetailedDebug ? 'enabled' : 'disabled'}`);
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
    
    // Create debug display
    createDebugDisplay();
    
    // Use current host with different port for WebSocket
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname || 'localhost';
    const port = 3000; // Match the server port
    const wsUrl = `${protocol}//${host}:${port}`;
    
    console.log(`Attempting to connect to WebSocket server at: ${wsUrl}`);
    
    return new Promise((resolve, reject) => {
        try {
            socket = new WebSocket(wsUrl);
            
            socket.onopen = () => {
                console.log('Connected to game server successfully!');
                resolve();
                
                // Send an initial position update immediately after connection
                // This will trigger the server to make this player visible to others
                setTimeout(() => {
                    const playerObject = scene.getObjectByName('player');
                    if (playerObject) {
                        console.log('Sending initial position update');
                        sendPlayerUpdate(playerObject);
                    } else {
                        console.warn('Could not find player object for initial position update');
                    }
                }, 500);
            };
            
            socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };
            
            socket.onclose = (event) => {
                console.log(`Disconnected from game server. Code: ${event.code}, Reason: ${event.reason}`);
                // Try to reconnect after a delay if the connection was established before
                if (playerId) {
                    console.log('Will attempt to reconnect in 5 seconds...');
                    setTimeout(() => {
                        initializeNetworking(playerUpdatedCallback, scene)
                            .catch(err => console.error('Reconnection failed:', err));
                    }, 5000);
                }
            };
            
            socket.onmessage = (event) => {
                handleServerMessage(event.data, scene);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
            reject(error);
        }
    });
}

/**
 * Process messages received from the server
 * @param {string} messageData - JSON message data
 * @param {THREE.Scene} scene - The game scene
 */
function handleServerMessage(messageData, scene) {
    try {
        const message = JSON.parse(messageData);
        console.log(`Received message type: ${message.type}`, message);
        
        switch (message.type) {
            case 'init':
                // Store the assigned player ID
                playerId = message.id;
                window.playerId = playerId; // Set global ID for chat
                console.log(`Initialized as player ${playerId}`);
                console.log(`Server reports ${message.players.length} other players already connected`);
                
                // Add name tag to local player now that we have an ID
                const localPlayer = scene.getObjectByName('player');
                if (localPlayer && window.gameState && window.gameState.playerName) {
                    // Remove any existing name tag first
                    localPlayer.traverse((child) => {
                        if (child instanceof CSS2DObject && child.element.classList.contains('player-nametag')) {
                            localPlayer.remove(child);
                        }
                    });
                    
                    // Add new name tag
                    const nameTag = createPlayerNameTag(playerId, window.gameState.playerName, true);
                    localPlayer.add(nameTag);
                }
                
                // Create representations for existing players
                if (message.players && message.players.length > 0) {
                    console.log('Creating remote players from init message:', message.players);
                    message.players.forEach(player => {
                        if (player.id !== playerId) {
                            addRemotePlayer(player, scene);
                        }
                    });
                } else {
                    console.log('No existing players to add from init message');
                }
                
                // Send player name if we have one from the game state
                if (window.gameState && window.gameState.playerName) {
                    setPlayerName(window.gameState.playerName);
                }
                
                // Add welcome message to chat
                addChatMessage('system', 'System', 'Welcome to the game! Press T to chat.', Date.now(), true);
                break;
                
            // Handle chat messages
            case 'chat':
                addChatMessage(
                    message.playerId, 
                    message.playerName, 
                    message.message, 
                    message.timestamp,
                    message.isSystem
                );
                break;
                
            // Handle player name updates    
            case 'playerNameUpdate':
                // Update name in remote players list if needed
                console.log(`Player ${message.playerId} updated name to: ${message.name}`);
                
                // Update the player's name tag if they exist in our remote players list
                const playerToUpdate = remotePlayers.get(message.playerId);
                if (playerToUpdate) {
                    updatePlayerNameTag(playerToUpdate, message.name);
                }
                break;    
                
            case 'playerJoined':
                // Make sure we don't create a player for ourselves
                if (message.player.id === playerId) {
                    console.log(`Ignoring playerJoined for self (ID: ${playerId})`);
                    return;
                }
                
                console.log(`Player ${message.player.id} joined at position:`, message.player.position);
                addRemotePlayer(message.player, scene);
                break;
                
            case 'playerUpdate':
                // Make sure we don't update ourselves
                if (message.player.id === playerId) {
                    return;
                }
                
                updateRemotePlayer(message.player);
                break;
                
            case 'playerLeft':
                console.log(`Player ${message.id} left`);
                removeRemotePlayer(message.id, scene);
                break;
                
            default:
                console.log(`Unknown message type: ${message.type}`);
        }
        
        // Notify about player list changes if callback is set
        if (onPlayersUpdated) {
            const count = remotePlayers.size;
            console.log(`Updating player count display: ${count} remote players`);
            onPlayersUpdated(count);
        }
    } catch (error) {
        console.error('Error processing server message:', error);
        console.error('Raw message data:', messageData);
    }
}

/**
 * Create a visual representation of a remote player
 * @param {Object} playerData - Player data from server
 * @param {THREE.Scene} scene - The game scene
 */
function addRemotePlayer(playerData, scene) {
    if (remotePlayers.has(playerData.id)) {
        console.log(`Remote player ${playerData.id} already exists, not adding again`);
        return; // Player already exists
    }
    
    console.log(`Creating remote player ${playerData.id} at position:`, playerData.position);
    
    // Use the same player model creation function as the main player
    const remotePlayer = createPlayer();
    remotePlayer.name = `remote-player-${playerData.id}`; 
   
    // Add a CSS2D name tag above the player
    const nameTag = createPlayerNameTag(playerData.id, playerData.name, false);
    remotePlayer.add(nameTag);

    // Create flashlight for the remote player
    const flashlight = createRemotePlayerFlashlight(remotePlayer, scene);
    
    // Store the flashlight with the player
    remotePlayer.userData.flashlight = flashlight;

    // Set player position and rotation
    updateRemotePlayerTransform(remotePlayer, playerData);
    
    // Add to scene and tracking Map
    scene.add(remotePlayer);
    remotePlayers.set(playerData.id, remotePlayer);
    
    console.log(`Remote player ${playerData.id} added to scene at position:`, remotePlayer.position);
    console.log(`Current remote players: ${remotePlayers.size}`);
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
}

/**
 * Remove a remote player from the scene
 * @param {number} playerId - ID of the player to remove
 * @param {THREE.Scene} scene - The game scene
 */
function removeRemotePlayer(playerId, scene) {
    const remotePlayer = remotePlayers.get(playerId);
    if (remotePlayer) {
        // Also remove the flashlight and target if they exist
        if (remotePlayer.userData.flashlight) {
            scene.remove(remotePlayer.userData.flashlight.group);
            scene.remove(remotePlayer.userData.flashlight.target);
        }
        scene.remove(remotePlayer);
        remotePlayers.delete(playerId);
    }
}

/**
 * Send the local player's position and rotation to the server
 * @param {THREE.Object3D} playerObject - The local player object
 */
function sendPlayerUpdate(playerObject) {
    if (!socket) {
        console.warn('Cannot send player update: WebSocket not initialized');
        return;
    }
    
    if (socket.readyState !== WebSocket.OPEN) {
        console.warn(`Cannot send player update: WebSocket not open (state: ${socket.readyState})`);
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
        }
    };
    
    // Log position updates periodically (every ~3 seconds)
    if (playerId && Math.random() < 0.01) {
        console.log(`Sending position update for player ${playerId}:`, message.position);
    }
    
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
 * Clean up network resources
 */
function cleanupNetworking() {
    if (socket) {
        socket.close();
    }
    remotePlayers.clear();
}

/**
 * Update networking state
 */
function updateNetworking() {
    // Update debug display
    updateDebugDisplay();
    
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
 * Send a chat message to all connected players
 * @param {string} message - The message to send
 */
function sendChatMessage(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('Cannot send chat message: WebSocket not connected');
        return false;
    }
    
    if (!message || message.trim() === '') {
        return false;
    }
    
    // Limit message length
    const trimmedMessage = message.trim().slice(0, 200);
    
    socket.send(JSON.stringify({
        type: 'chat',
        message: trimmedMessage
    }));
    
    return true;
}

/**
 * Set the player's name
 * @param {string} name - The player's name
 */
function setPlayerName(name) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn('Cannot set player name: WebSocket not connected');
        return false;
    }
    
    if (!name || name.trim() === '') {
        return false;
    }
    
    socket.send(JSON.stringify({
        type: 'setName',
        name: name.trim()
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
        // Log periodic updates for debugging
        if (Math.random() < 0.01) {
            console.log(`Updating position for player ${playerData.id}:`, playerData.position);
        }
        
        updateRemotePlayerTransform(remotePlayer, playerData);
    } else {
        console.warn(`Received update for unknown player ${playerData.id}, adding them now`);
        // If we get an update for a player we don't know about, add them
        // This can happen if we missed the playerJoined message
        const scene = window.gameScene; // Make sure gameScene is set in main.js
        if (scene) {
            addRemotePlayer(playerData, scene);
        } else {
            console.error('Cannot add player - scene not available');
        }
    }
}

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
    updateRemotePlayerFlashlight
}; 