// Game client for MMORPG
class GameClient {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.playerId = null;
        this.playerPosition = { x: 0, y: 0 };
        this.players = new Map(); // playerId -> player data
        this.avatars = new Map(); // avatarName -> avatar data
        this.avatarImages = new Map(); // avatarName -> loaded images
        
        // Viewport
        this.viewport = { x: 0, y: 0 };
        
        // WebSocket
        this.socket = null;
        
        // Movement state
        this.activeKeys = new Set();
        this.isMoving = false;
        this.movementInterval = null;
        
        // Proximity detection
        this.greetedPlayers = new Set();
        this.proximityThreshold = 100; // pixels
        this.playerProximityState = new Map(); // playerId -> 'near' or 'far'
        
        // UI elements
        this.connectionStatusEl = null;
        this.playerCountEl = null;
        this.playerPositionEl = null;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupUI();
        this.setupEventListeners();
        this.connectToServer();
    }
    
    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.draw();
        });
    }
    
    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            this.draw();
        };
        this.worldImage.src = 'world.jpg';
    }
    
    setupUI() {
        this.connectionStatusEl = document.getElementById('connectionStatus');
        this.playerCountEl = document.getElementById('playerCount');
        this.playerPositionEl = document.getElementById('playerPosition');
        
        // Initialize UI
        this.updateConnectionStatus(false);
        this.updatePlayerCount(0);
        this.updatePlayerPosition(0, 0);
    }
    
    updateConnectionStatus(connected) {
        if (this.connectionStatusEl) {
            this.connectionStatusEl.textContent = connected ? 'Connected' : 'Disconnected';
            this.connectionStatusEl.className = `status-value ${connected ? 'connected' : 'disconnected'}`;
        }
    }
    
    updatePlayerCount(count) {
        if (this.playerCountEl) {
            this.playerCountEl.textContent = count;
        }
    }
    
    updatePlayerPosition(x, y) {
        if (this.playerPositionEl) {
            this.playerPositionEl.textContent = `(${Math.round(x)}, ${Math.round(y)})`;
        }
    }
    
    draw() {
        if (!this.worldImage) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.viewport.x, this.viewport.y, this.canvas.width, this.canvas.height,  // source rectangle
            0, 0, this.canvas.width, this.canvas.height   // destination rectangle
        );
        
        // Draw all players
        this.drawPlayers();
        
        // Check for proximity greetings
        this.checkProximityGreetings();
    }
    
    drawPlayers() {
        for (const [playerId, player] of this.players) {
            this.drawPlayer(player);
        }
    }
    
    drawPlayer(player) {
        const avatar = this.avatars.get(player.avatar);
        if (!avatar) return;
        
        // Calculate screen position
        const screenX = player.x - this.viewport.x;
        const screenY = player.y - this.viewport.y;
        
        // Only draw if player is visible on screen
        if (screenX < -50 || screenX > this.canvas.width + 50 || 
            screenY < -50 || screenY > this.canvas.height + 50) {
            return;
        }
        
        // Get the appropriate frame based on direction and animation
        const direction = player.facing;
        const frameIndex = player.animationFrame || 0;
        const frameData = avatar.frames[direction];
        
        if (!frameData || !frameData[frameIndex]) return;
        
        // Load and draw avatar image
        this.loadAndDrawAvatar(frameData[frameIndex], screenX, screenY, direction === 'west');
        
        // Draw username
        this.drawUsername(player.username, screenX, screenY);
    }
    
    loadAndDrawAvatar(imageData, x, y, flipHorizontal = false) {
        // Check if image is already loaded
        if (this.avatarImages.has(imageData)) {
            const img = this.avatarImages.get(imageData);
            this.drawAvatarImage(img, x, y, flipHorizontal);
            return;
        }
        
        // Load new image
        const img = new Image();
        img.onload = () => {
            this.avatarImages.set(imageData, img);
            this.drawAvatarImage(img, x, y, flipHorizontal);
        };
        img.src = imageData;
    }
    
    drawAvatarImage(img, x, y, flipHorizontal) {
        const avatarSize = 32; // 32x32 pixel avatars
        const centerX = x - avatarSize / 2;
        const centerY = y - avatarSize;
        
        this.ctx.save();
        
        if (flipHorizontal) {
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(img, -centerX - avatarSize, centerY, avatarSize, avatarSize);
        } else {
            this.ctx.drawImage(img, centerX, centerY, avatarSize, avatarSize);
        }
        
        this.ctx.restore();
    }
    
    drawUsername(username, x, y) {
        this.ctx.save();
        this.ctx.fillStyle = 'white';
        this.ctx.strokeStyle = 'black';
        this.ctx.lineWidth = 2;
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        
        const textY = y - 40; // Above the avatar
        
        // Draw text stroke
        this.ctx.strokeText(username, x, textY);
        // Draw text fill
        this.ctx.fillText(username, x, textY);
        
        this.ctx.restore();
    }
    
    connectToServer() {
        try {
            this.socket = new WebSocket('wss://codepath-mmorg.onrender.com');
            
            this.socket.onopen = () => {
                console.log('Connected to game server');
                this.updateConnectionStatus(true);
                this.joinGame();
            };
            
            this.socket.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            };
            
            this.socket.onclose = () => {
                console.log('Disconnected from game server');
                this.updateConnectionStatus(false);
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }
    
    joinGame() {
        const message = {
            action: 'join_game',
            username: 'Roger'
        };
        
        this.socket.send(JSON.stringify(message));
    }
    
    handleMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                this.handleJoinGame(message);
                break;
            case 'players_moved':
                this.handlePlayersMoved(message);
                break;
            case 'player_joined':
                this.handlePlayerJoined(message);
                break;
            case 'player_left':
                this.handlePlayerLeft(message);
                break;
            default:
                console.log('Unknown message type:', message.action);
        }
    }
    
    handleJoinGame(message) {
        if (message.success) {
            this.playerId = message.playerId;
            
            // Store all players
            for (const [playerId, player] of Object.entries(message.players)) {
                this.players.set(playerId, player);
            }
            
            // Store all avatars
            for (const [avatarName, avatar] of Object.entries(message.avatars)) {
                this.avatars.set(avatarName, avatar);
            }
            
            // Set our position and update viewport
            const ourPlayer = this.players.get(this.playerId);
            if (ourPlayer) {
                this.playerPosition = { x: ourPlayer.x, y: ourPlayer.y };
                this.updateViewport();
                this.updatePlayerPosition(ourPlayer.x, ourPlayer.y);
            }
            
            // Update player count
            this.updatePlayerCount(this.players.size);
            
            console.log('Successfully joined game as', ourPlayer?.username);
            this.draw();
        } else {
            console.error('Failed to join game:', message.error);
        }
    }
    
    handlePlayersMoved(message) {
        for (const [playerId, player] of Object.entries(message.players)) {
            this.players.set(playerId, player);
            
            // Update our position if it's us
            if (playerId === this.playerId) {
                this.playerPosition = { x: player.x, y: player.y };
                this.updateViewport();
                this.updatePlayerPosition(player.x, player.y);
            }
        }
        this.updatePlayerCount(this.players.size);
        this.draw();
    }
    
    handlePlayerJoined(message) {
        this.players.set(message.player.id, message.player);
        this.avatars.set(message.avatar.name, message.avatar);
        this.updatePlayerCount(this.players.size);
        console.log('Player joined:', message.player.username);
        this.draw();
    }
    
    handlePlayerLeft(message) {
        this.players.delete(message.playerId);
        this.greetedPlayers.delete(message.playerId); // Remove from greeted list
        this.playerProximityState.delete(message.playerId); // Remove from proximity state
        this.updatePlayerCount(this.players.size);
        console.log('Player left:', message.playerId);
        this.draw();
    }
    
    updateViewport() {
        // Center the viewport on the player
        const centerX = this.playerPosition.x - this.canvas.width / 2;
        const centerY = this.playerPosition.y - this.canvas.height / 2;
        
        // Clamp viewport to world boundaries
        this.viewport.x = Math.max(0, Math.min(centerX, this.worldWidth - this.canvas.width));
        this.viewport.y = Math.max(0, Math.min(centerY, this.worldHeight - this.canvas.height));
    }
    
    setupEventListeners() {
        // Add click event for future click-to-move functionality
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            console.log(`Clicked at: ${x}, ${y}`);
        });
        
        // Add keyboard event listeners
        document.addEventListener('keydown', (event) => {
            this.handleKeyDown(event);
        });
        
        document.addEventListener('keyup', (event) => {
            this.handleKeyUp(event);
        });
        
        // Add Enter key listener for commands
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                this.handleEnterKey();
            }
        });
    }
    
    handleKeyDown(event) {
        // Prevent default behavior for arrow keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
            
            // Add key to active keys
            this.activeKeys.add(event.code);
            this.startContinuousMovement();
        }
    }
    
    handleKeyUp(event) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
            event.preventDefault();
            
            // Remove key from active keys
            this.activeKeys.delete(event.code);
            
            if (this.activeKeys.size === 0) {
                this.stopContinuousMovement();
            } else {
                // Update direction if other keys are still pressed
                this.startContinuousMovement();
            }
        }
    }
    
    startContinuousMovement() {
        // Clear any existing movement interval
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
        }
        
        // Determine primary direction
        const direction = this.getPrimaryDirection();
        if (direction && direction !== 'stop') {
            // Send immediate move command
            this.sendMoveCommand(direction);
            this.isMoving = true;
            
            // Set up continuous movement (no rate limiting)
            this.movementInterval = setInterval(() => {
                this.sendMoveCommand(direction);
            }, 50); // Send move command every 50ms for smooth movement
        }
    }
    
    stopContinuousMovement() {
        // Clear movement interval
        if (this.movementInterval) {
            clearInterval(this.movementInterval);
            this.movementInterval = null;
        }
        
        // Send stop command
        if (this.isMoving) {
            this.sendMoveCommand('stop');
            this.isMoving = false;
        }
    }
    
    getPrimaryDirection() {
        // Priority: Up > Down > Left > Right
        if (this.activeKeys.has('ArrowUp')) return 'up';
        if (this.activeKeys.has('ArrowDown')) return 'down';
        if (this.activeKeys.has('ArrowLeft')) return 'left';
        if (this.activeKeys.has('ArrowRight')) return 'right';
        return 'stop';
    }
    
    sendMoveCommand(direction) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message = {
            action: 'move',
            direction: direction
        };
        
        this.socket.send(JSON.stringify(message));
        console.log('Sent move command:', direction);
    }
    
    handleEnterKey() {
        // For now, just say hello
        this.sayHello();
    }
    
    sayHello() {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            console.log('Not connected to server');
            return;
        }
        
        // Send a simple hello message
        const message = {
            action: 'chat',
            message: 'Hello!'
        };
        
        this.socket.send(JSON.stringify(message));
        console.log('Said hello!');
        
        // Show a visual indicator
        this.showMessage('Roger: Hello World, thanks for playing!');
    }
    
    showMessage(text) {
        // Create a temporary message display
        const messageEl = document.createElement('div');
        messageEl.textContent = text;
        messageEl.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background-color: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: 'Courier New', monospace;
            font-size: 16px;
            z-index: 2000;
            pointer-events: none;
        `;
        
        document.body.appendChild(messageEl);
        
        // Remove after 2 seconds
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 2000);
    }
    
    checkProximityGreetings() {
        if (!this.playerId) return;
        
        const ourPlayer = this.players.get(this.playerId);
        if (!ourPlayer) return;
        
        // Check distance to all other players
        for (const [playerId, player] of this.players) {
            if (playerId === this.playerId) continue; // Skip ourselves
            
            const distance = this.calculateDistance(ourPlayer, player);
            const isNear = distance <= this.proximityThreshold;
            const currentState = this.playerProximityState.get(playerId) || 'far';
            
            // If just got close and haven't greeted this player yet
            if (isNear && currentState === 'far' && !this.greetedPlayers.has(playerId)) {
                this.askPlayerToGreet(player);
                this.greetedPlayers.add(playerId);
                this.playerProximityState.set(playerId, 'near');
            }
            // If just moved away from a player we were close to
            else if (!isNear && currentState === 'near') {
                this.askPlayerToSayGoodbye(player);
                this.playerProximityState.set(playerId, 'far');
            }
            // Update state if still near
            else if (isNear) {
                this.playerProximityState.set(playerId, 'near');
            }
            // Update state if still far
            else {
                this.playerProximityState.set(playerId, 'far');
            }
        }
    }
    
    calculateDistance(player1, player2) {
        const dx = player1.x - player2.x;
        const dy = player1.y - player2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    askPlayerToGreet(player) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Send message asking the other player to greet Roger
        const message = {
            action: 'chat',
            message: `hii! nice to meet you Roger`
        };
        
        this.socket.send(JSON.stringify(message));
        console.log(`${player.username} greeted Roger!`);
        
        // Show visual indicator
        this.showMessage(`${player.username}: hii! nice to meet you Roger`);
    }
    
    askPlayerToSayGoodbye(player) {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // Send message asking the other player to say goodbye to Roger
        const message = {
            action: 'chat',
            message: `bye Roger!`
        };
        
        this.socket.send(JSON.stringify(message));
        console.log(`${player.username} said goodbye to Roger!`);
        
        // Show visual indicator
        this.showMessage(`${player.username}: bye Roger!`);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});