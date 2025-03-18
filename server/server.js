const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files (client game) from the public directory
app.use(express.static(path.join(__dirname, '../')));

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

// Store connected clients with their IDs
const clients = new Map();
let nextPlayerId = 1;

// Track clients by IP address to help identify duplicates
const ipConnections = new Map();

// Data structure to track all players' positions
const players = new Map();

// WebSocket connection handler
wss.on('connection', (ws, req) => {
    // Get client IP address
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    console.log(`New connection from IP: ${ip}`);
    
    // Check if this IP already has connections and log them
    if (ipConnections.has(ip)) {
        const count = ipConnections.get(ip);
        console.log(`This IP already has ${count} connection(s)`);
        ipConnections.set(ip, count + 1);
    } else {
        ipConnections.set(ip, 1);
    }
    
    // Debug info about current connections
    console.log(`Total active connections: ${wss.clients.size}`);
    
    // Assign a unique ID to the new client
    const playerId = nextPlayerId++;
    clients.set(ws, playerId);
    
    // Initialize player data with a flag to indicate it's a new player
    players.set(playerId, {
        id: playerId,
        position: { x: 10000, y: 10000, z: 10000 }, // Place far away until real position is received
        rotation: { x: 0, y: 0, z: 0 },
        isInitializing: true, // Flag to indicate player hasn't sent position yet
        ip: ip, // Store the IP for debugging
        name: `Player ${playerId}`, // Default name
        isFiring: false,
        weaponType: null,
        flashlightOn: true
    });
    
    console.log(`Player ${playerId} connected. Total players: ${clients.size}`);
    
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        players: Array.from(players.values())
            .filter(p => !p.isInitializing)
            .map(p => ({ 
                id: p.id, 
                position: p.position, 
                rotation: p.rotation,
                name: p.name || `Player ${p.id}`,
                isFiring: p.isFiring || false,
                weaponType: p.weaponType || null,
                flashlightOn: p.flashlightOn
            }))
    }));
    
    broadcast({
        type: 'chat',
        playerId: 'system',
        playerName: 'System',
        message: `Player ${playerId} joined the game`,
        timestamp: Date.now(),
        isSystem: true
    });
    
    // Handle messages from the client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            
            // Handle different types of messages
            switch (data.type) {
                case 'update':
                    // Update the player's position and rotation
                    if (data.position && data.rotation) {
                        const player = players.get(playerId);
                        if (player) {
                            // First real position update - announce the player to others
                            const isFirstUpdate = player.isInitializing;
                                                        
                            // Update player data
                            player.position = data.position;
                            player.rotation = data.rotation;
                            
                            // Handle weapon firing data
                            player.isFiring = data.isFiring || false;
                            player.weaponType = data.weaponType || null;
                            
                            // Handle flashlight status 
                            player.flashlightOn = data.flashlightOn;
                        
                            
                            if (isFirstUpdate) {
                                // Remove initializing flag
                                player.isInitializing = false;
                                 
                                // Now that we have real position, broadcast that a new player has joined
                                broadcastToOthers(ws, {
                                    type: 'playerJoined',
                                    player: player
                                });
                            } else {
                                // Regular position update
                                broadcastToOthers(ws, {
                                    type: 'playerUpdate',
                                    player: player
                                });
                            }
                        } else {
                            console.error(`Player ${playerId} not found in players map`);
                        }
                    } else {
                        console.warn(`Player ${playerId} sent incomplete update message:`, data);
                    }
                    break;
                    
                // Handle chat messages
                case 'chat':
                    if (data.message && typeof data.message === 'string') {
                        // Get the player's name (default to player ID)
                        const player = players.get(playerId);
                        const playerName = player?.name || `Player ${playerId}`;
                        
                        // Sanitize message (prevent HTML injection)
                        const sanitizedMessage = data.message
                            .slice(0, 200) // Limit message length
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;');
                        
                        // Broadcast chat message to all clients
                        broadcast({
                            type: 'chat',
                            playerId: playerId,
                            playerName: playerName,
                            message: sanitizedMessage,
                            timestamp: Date.now()
                        });
                    }
                    break;
                    
                // Handle player name updates
                case 'setName':
                    if (data.name && typeof data.name === 'string') {
                        const player = players.get(playerId);
                        if (player) {
                            // Sanitize name
                            const sanitizedName = data.name
                                .slice(0, 20) // Limit name length
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;');
                                
                            // Update player name
                            player.name = sanitizedName;
                            console.log(`Player ${playerId} set name: ${sanitizedName}`);
                            
                            // Broadcast name update to other players
                            broadcastToOthers(ws, {
                                type: 'playerNameUpdate',
                                playerId: playerId,
                                name: sanitizedName
                            });
                        }
                    }
                    break;
                    
                // Handle player death
                case 'playerDeath':
                    const player = players.get(playerId);
                    if (player) {
                        // Mark the player as dead
                        player.isDead = true;
                        
                        console.log(`Player ${playerId} (${player.name}) has died`);
                        
                        // Broadcast death to all other players
                        broadcastToOthers(ws, {
                            type: 'playerDied',
                            playerId: playerId,
                            playerName: player.name || `Player ${playerId}`
                        });
                        
                        // Send system message about player death
                        broadcast({
                            type: 'chat',
                            playerId: 'system',
                            playerName: 'System',
                            message: `${player.name || `Player ${playerId}`} has died`,
                            timestamp: Date.now(),
                            isSystem: true
                        });
                    }
                    break;
                    
                default:
                    console.log(`Unknown message type from player ${playerId}: ${data.type}`);
            }
        } catch (error) {
            console.error(`Error processing message from player ${playerId}:`, error);
            console.error('Raw message:', message.toString());
        }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
        const disconnectedPlayerId = clients.get(ws);
        
        // Get player name before removing
        const playerName = players.has(disconnectedPlayerId) ? 
            players.get(disconnectedPlayerId).name || `Player ${disconnectedPlayerId}` : 
            `Player ${disconnectedPlayerId}`;
        
        // Update IP connections count
        if (players.has(disconnectedPlayerId)) {
            const playerIp = players.get(disconnectedPlayerId).ip;
            if (ipConnections.has(playerIp)) {
                const count = ipConnections.get(playerIp);
                if (count > 1) {
                    ipConnections.set(playerIp, count - 1);
                } else {
                    ipConnections.delete(playerIp);
                }
            }
        }
        
        clients.delete(ws);
        players.delete(disconnectedPlayerId);
        
        console.log(`Player ${disconnectedPlayerId} disconnected. Remaining players: ${clients.size}`);
        console.log(`Remaining active connections: ${wss.clients.size}`);
        
        // Notify all clients about the disconnection
        broadcast({
            type: 'playerLeft',
            id: disconnectedPlayerId
        });
        
        // System message for player disconnect
        broadcast({
            type: 'chat',
            playerId: 'system',
            playerName: 'System',
            message: `${playerName} left the game`,
            timestamp: Date.now(),
            isSystem: true
        });
    });
});

// Function to broadcast a message to all clients except the sender
function broadcastToOthers(sender, message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Function to broadcast a message to all connected clients
function broadcast(message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(messageStr);
        }
    });
}

// Start the server
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
}); 