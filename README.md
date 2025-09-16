# Mini Multiplayer Online Role Playing Game

PLEASE CHECK RECORDING: [recording.mov](recording.mov)

Welcome to the world's simplest multiplayer game, where all you can do is hang out, and walk around!

In order to join the shared game server, build your own web client. Your web client is responsible for:

- Drawing the world map that the avatars walk around on
- Connecting to the game server
- Drawing all avatars on the map
- Sending move commands for your avatar
- Subscribing to the movements of all other players

Your web client will be a simple HTML and CSS file that you will open directly with your browser (no server required).

There is a provided 'world.jpg', but you can use any image that is 2048x2048.

![Animation of game demo](mmorpg.gif)

## WebSocket Messaging Protocol

### Connection

Establishing a websocket connection with the shared game server will give you the ability to send commands to the server, as well as receive messages that the server broadcasts. For example, the server periodically broadcasts an update on player positions that have moved.

- **URL**: `wss://codepath-mmorg.onrender.com`
- **Format**: JSON over WebSocket

### Message Types

#### 1. Join Game

The client should send the "join_game" message to the server upon startup. The server will respond with a unique player id, as well as information for all players, and all available avatar images.

Note: upon joining, it's optional to pass in an avatar. Avatars use 3 frames in each direction to animate walking.

**Client Request:**
```javascript
{
  "action": "join_game",
  "username": "PlayerName",
  "avatar": {
    "name": "my_avatar",
    "frames": {
      "north": ["data:image/png;base64,...", "data:image/png;base64,..."],
      "south": ["data:image/png;base64,...", "data:image/png;base64,..."],
      "east": ["data:image/png;base64,...", "data:image/png;base64,..."]
      // west direction uses flipped east frames
    }
  }
}
```

**Server Response (Success):**
```javascript
{
  "action": "join_game",
  "success": true,
  "playerId": "abc123def",
  "players": {
    "abc123def": {
      "id": "abc123def",
      "x": 2048,
      "y": 2048,
      "avatar": "my_avatar",
      "facing": "south",
      "isMoving": false,
      "username": "PlayerName",
      "animationFrame": 0
    },
    "def456ghi": {
      "id": "def456ghi",
      "x": 1500,
      "y": 3000,
      "avatar": "other_avatar",
      "facing": "north",
      "isMoving": true,
      "username": "OtherPlayer",
      "animationFrame": 2
    }
  },
  "avatars": {
    "my_avatar": {
      "name": "my_avatar",
      "frames": {
        "north": ["data:image/png;base64,...", "data:image/png;base64,..."],
        "south": ["data:image/png;base64,...", "data:image/png;base64,..."],
        "east": ["data:image/png;base64,...", "data:image/png;base64,..."]
      }
    },
    "other_avatar": {
      "name": "other_avatar",
      "frames": {
        "north": ["data:image/png;base64,...", "data:image/png;base64,..."],
        "south": ["data:image/png;base64,...", "data:image/png;base64,..."],
        "east": ["data:image/png;base64,...", "data:image/png;base64,..."]
      }
    }
  }
}
```

#### 2. Movement

**Client Request (Keyboard):**
```javascript
{ "action": "move", "direction": "up" | "down" | "left" | "right" }
```

**Client Request (Click-to-Move):**
```javascript
{ "action": "move", "x": 1500, "y": 2000 }
```

**Client Request (Stop):**
```javascript
{ "action": "stop" }
```

#### 3. Broadcast messages

**Player Joined:**
```javascript
{
  "action": "player_joined",
  "player": {
    "id": "abc123def",
    "x": 2048,
    "y": 2048,
    "avatar": "my_avatar",
    "facing": "south",
    "isMoving": false,
    "username": "PlayerName",
    "animationFrame": 0
  },
  "avatar": {
    "name": "my_avatar",
    "frames": {
      "north": ["data:image/png;base64,...", "data:image/png;base64,..."],
      "south": ["data:image/png;base64,...", "data:image/png;base64,..."],
      "east": ["data:image/png;base64,...", "data:image/png;base64,..."]
    }
  }
}
```

```javascript
{
  "action": "players_moved",
  "players": {
    "player_id_1": {
      "id": "player_id_1",
      "x": 2063,
      "y": 2048,
      "facing": "east",
      "isMoving": true,
      "username": "Player1",
      "animationFrame": 1
    },
    "player_id_2": {
      "id": "player_id_2", 
      "x": 1500,
      "y": 3000,
      "facing": "north",
      "isMoving": true,
      "username": "Player2",
      "animationFrame": 2
    }
  }
}
```

#### 3. Player Disconnect

```javascript
{
  "action": "player_left",
  "playerId": "abc123def"
}
```

### Error Handling

If any message (e.g., "join_game", "move", etc) fails, an error message will be returned with the action name and error message, as below.

`{ "action": "action_name", "success": false, "error": "message" }`

Example errors:
- `"Invalid avatar data"` - Malformed avatar upload
- `"Invalid direction"` - Unknown movement direction
- `"Invalid message format"` - Malformed JSON

### Avatar Rendering

- **West direction**: Flip east frames horizontally for west-facing players
- **Animation frames**: Use `animationFrame` (0-2) to select correct avatar frame

