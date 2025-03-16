# Game Multiplayer Server

This directory contains the server implementation for the multiplayer functionality of the top-down shooter game. The server handles player connections and relays position and rotation data between connected clients.

## How It Works

The server uses WebSockets to establish real-time bidirectional communication between clients. It:

1. Assigns a unique ID to each player who connects
2. Notifies other players when a new player joins
3. Relays player position and rotation updates to all other connected players
4. Notifies all players when someone disconnects

## Setup Instructions

### 1. Install Dependencies

Navigate to the server directory and install dependencies:

```bash
cd server
npm install
```

### 2. Start the Server

Start the server with:

```bash
npm start
```

Or for development (with auto-restart on file changes):

```bash
npm run dev
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## Client-Server Communication Protocol

The server and client communicate using JSON messages. Each message has a `type` field that determines how the message is processed.

### Message Types from Client to Server:

1. `update` - Sends player position and rotation updates:
   ```json
   {
     "type": "update",
     "position": { "x": 0, "y": 0, "z": 0 },
     "rotation": { "x": 0, "y": 0, "z": 0 }
   }
   ```

### Message Types from Server to Client:

1. `init` - Initial setup on connection with player ID and existing players:
   ```json
   {
     "type": "init",
     "id": 1,
     "players": [{ "id": 2, "position": {...}, "rotation": {...} }, ...]
   }
   ```

2. `playerJoined` - Notification when a new player connects:
   ```json
   {
     "type": "playerJoined",
     "player": { "id": 2, "position": {...}, "rotation": {...} }
   }
   ```

3. `playerUpdate` - Updates when another player moves:
   ```json
   {
     "type": "playerUpdate",
     "player": { "id": 2, "position": {...}, "rotation": {...} }
   }
   ```

4. `playerLeft` - Notification when a player disconnects:
   ```json
   {
     "type": "playerLeft",
     "id": 2
   }
   ```

## Extending Functionality

To extend the server with more features:

1. Add new message types in the server.js file
2. Implement the corresponding handlers in both the server and client code
3. If needed, update the data structures to store additional state

Potential extensions include:
- Implementing player chat
- Syncing game state (enemies, bullets, etc.)
- Adding authentication/persistence
- Supporting different game modes 