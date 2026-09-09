const express = require('express');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve the built client. `npm run build` at the repo root emits ./dist, which
// contains the bundled entry plus everything copied out of public/. Serving the
// repo root instead hands the browser raw sources: bare "three" imports fail to
// resolve and every /css and /models path 404s because those live under public/.
const clientDir = path.join(__dirname, '..', 'dist');
const clientBuilt = fs.existsSync(path.join(clientDir, 'index.html'));

if (clientBuilt) {
    app.use(express.static(clientDir));
} else {
    console.warn(
        `No client build found at ${clientDir}.\n` +
        'Run "npm install && npm run build" in the repo root. ' +
        'The multiplayer socket still works, so a Vite dev client can connect.'
    );
    app.get('/', (req, res) => {
        res.status(503).type('text/plain').send(
            'Client not built. Run "npm run build" in the repo root, then restart the server.'
        );
    });
}

// Health check for deployment platforms and uptime probes.
app.get('/healthz', (req, res) => {
    res.json({
        status: 'ok',
        clientBuilt,
        players: players.size,
        connections: wss.clients.size,
        uptimeSeconds: Math.round(process.uptime())
    });
});

const server = http.createServer(app);

// Cap inbound frames: position updates and chat are tiny, so anything larger is
// either a bug or an attempt to exhaust memory.
const wss = new WebSocket.Server({ server, maxPayload: 64 * 1024 });

// Store connected clients with their IDs
const clients = new Map();
let nextPlayerId = 1;

// Track clients by IP address to help identify duplicates
const ipConnections = new Map();

// Data structure to track all players' positions
const players = new Map();

const HEARTBEAT_INTERVAL_MS = Number(process.env.HEARTBEAT_INTERVAL_MS) || 30000;

/**
 * Project a player record into the shape clients are allowed to see.
 * The stored record carries server-only fields - most importantly `ip`, which
 * must never reach other players - so every outbound message goes through here.
 */
function publicPlayer(player) {
    return {
        id: player.id,
        position: player.position,
        rotation: player.rotation,
        name: player.name || `Player ${player.id}`,
        isFiring: player.isFiring || false,
        weaponType: player.weaponType || null,
        flashlightOn: player.flashlightOn,
        isDead: player.isDead || false
    };
}

function sanitizeText(value, maxLength) {
    return value
        .slice(0, maxLength)
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function systemMessage(message) {
    broadcast({
        type: 'chat',
        playerId: 'system',
        playerName: 'System',
        message,
        timestamp: Date.now(),
        isSystem: true
    });
}

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

    // A malformed frame makes ws emit 'error' on the socket. Without a listener
    // that is an unhandled 'error' event, which takes the whole process down and
    // disconnects every other player, so each socket needs its own handler.
    ws.on('error', (error) => {
        console.error(`Socket error for player ${clients.get(ws) ?? 'unknown'}:`, error.message);
        ws.terminate();
    });

    // Liveness tracking: a client that drops off the network without a close
    // frame would otherwise linger in `players` forever as a motionless ghost.
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Assign a unique ID to the new client
    const playerId = nextPlayerId++;
    clients.set(ws, playerId);

    // Initialize player data with a flag to indicate it's a new player
    players.set(playerId, {
        id: playerId,
        position: { x: 10000, y: 10000, z: 10000 }, // Place far away until real position is received
        rotation: { x: 0, y: 0, z: 0 },
        isInitializing: true, // Flag to indicate player hasn't sent position yet
        ip: ip, // Server-only, never broadcast
        name: `Player ${playerId}`, // Default name
        isFiring: false,
        weaponType: null,
        flashlightOn: true,
        isDead: false
    });

    console.log(`Player ${playerId} connected. Total players: ${clients.size}`);

    ws.send(JSON.stringify({
        type: 'init',
        id: playerId,
        players: Array.from(players.values())
            .filter(p => !p.isInitializing)
            .map(publicPlayer)
    }));

    // Handle messages from the client
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const player = players.get(playerId);

            if (!player) {
                console.error(`Player ${playerId} not found in players map`);
                return;
            }

            // Handle different types of messages
            switch (data.type) {
                case 'update': {
                    // Update the player's position and rotation
                    if (!data.position || !data.rotation) {
                        console.warn(`Player ${playerId} sent incomplete update message:`, data);
                        break;
                    }

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

                        // Now that we have a real position, announce the player.
                        // Deferring the chat notice to here means it can use the
                        // name they set during the handshake rather than "Player N".
                        broadcastToOthers(ws, {
                            type: 'playerJoined',
                            player: publicPlayer(player)
                        });
                        systemMessage(`${player.name} joined the game`);
                    } else {
                        // Regular position update
                        broadcastToOthers(ws, {
                            type: 'playerUpdate',
                            player: publicPlayer(player)
                        });
                    }
                    break;
                }

                // Handle chat messages
                case 'chat': {
                    if (data.message && typeof data.message === 'string') {
                        // Broadcast chat message to all clients
                        broadcast({
                            type: 'chat',
                            playerId: playerId,
                            playerName: player.name || `Player ${playerId}`,
                            message: sanitizeText(data.message, 200),
                            timestamp: Date.now()
                        });
                    }
                    break;
                }

                // Handle player name updates
                case 'setName': {
                    if (data.name && typeof data.name === 'string') {
                        const sanitizedName = sanitizeText(data.name, 20);
                        player.name = sanitizedName;
                        console.log(`Player ${playerId} set name: ${sanitizedName}`);

                        // Broadcast name update to other players
                        broadcastToOthers(ws, {
                            type: 'playerNameUpdate',
                            playerId: playerId,
                            name: sanitizedName
                        });
                    }
                    break;
                }

                // Handle player death
                case 'playerDeath': {
                    if (player.isDead) break;
                    player.isDead = true;

                    console.log(`Player ${playerId} (${player.name}) has died`);

                    // Broadcast death to all other players
                    broadcastToOthers(ws, {
                        type: 'playerDied',
                        playerId: playerId,
                        playerName: player.name || `Player ${playerId}`
                    });

                    systemMessage(`${player.name || `Player ${playerId}`} has died`);
                    break;
                }

                // Handle respawn after a death or a restarted run. Peers drop the
                // player's model when they die, so without this they would only
                // reappear through the client's "unknown player" recovery path.
                case 'playerRespawn': {
                    if (!player.isDead) break;
                    player.isDead = false;

                    if (data.position) player.position = data.position;
                    if (data.rotation) player.rotation = data.rotation;
                    player.isFiring = false;

                    console.log(`Player ${playerId} (${player.name}) respawned`);

                    broadcastToOthers(ws, {
                        type: 'playerRespawned',
                        player: publicPlayer(player)
                    });
                    break;
                }

                default:
                    console.log(`Unknown message type from player ${playerId}: ${data.type}`);
            }
        } catch (error) {
            console.error(`Error processing message from player ${playerId}:`, error.message);
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        const disconnectedPlayerId = clients.get(ws);
        const disconnectedPlayer = players.get(disconnectedPlayerId);

        // Get player name before removing
        const playerName = disconnectedPlayer?.name || `Player ${disconnectedPlayerId}`;
        const announced = disconnectedPlayer ? !disconnectedPlayer.isInitializing : false;

        // Update IP connections count
        if (disconnectedPlayer) {
            const playerIp = disconnectedPlayer.ip;
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

        // Only announce players the others were ever told about - a connection
        // that dropped before its first position update is invisible to them.
        if (announced) {
            broadcast({
                type: 'playerLeft',
                id: disconnectedPlayerId
            });
            systemMessage(`${playerName} left the game`);
        }
    });
});

wss.on('error', (error) => {
    console.error('WebSocket server error:', error.message);
});

// Drop connections that stopped answering pings.
const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
        if (client.isAlive === false) {
            console.log(`Terminating unresponsive player ${clients.get(client) ?? 'unknown'}`);
            client.terminate();
            return;
        }
        client.isAlive = false;
        client.ping();
    });
}, HEARTBEAT_INTERVAL_MS);

wss.on('close', () => clearInterval(heartbeat));

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

// A failure to bind is fatal: staying alive with no listener would look healthy
// to a process manager while every player gets connection refused.
server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Set PORT to a free port and retry.`);
    } else {
        console.error('HTTP server error:', error.message);
    }
    process.exit(1);
});

// Start the server
server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    console.log(`Serving client from: ${clientBuilt ? clientDir : '(not built)'}`);
});

// Deployment platforms send SIGTERM on redeploy; close cleanly so players get a
// proper close frame and reconnect instead of hanging on a dead socket.
function shutdown(signal) {
    console.log(`${signal} received, shutting down`);
    clearInterval(heartbeat);
    wss.clients.forEach((client) => client.close(1001, 'Server shutting down'));
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
