import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { BingoGame } from './game.js';
import { randomRoomId } from './helper.js';
import { fileURLToPath } from 'url';
import path from 'path';

const app = express();
const server = http.createServer(app);
const io = new Server();
io.listen(server);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "build")));
app.use(express.static("public"));

// SPA fallback so /game/:roomId works on refresh
app.get('/game/*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const ROOMS = {}
const SOCKET_ROOM_MAPPING = {}

const PLAYER_COLORS = [
    '#EF4444', '#F97316', '#F59E0B', '#10B981',
    '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'
];
const getRandomColor = () => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)];

const getNextConnectedIndex = (room, startIndex) => {
    const len = room.players.length;
    if (len === 0) return 0;
    if (room.players.every(p => !p.connected)) return startIndex % len;
    let idx = (startIndex + 1) % len;
    let attempts = 0;
    while ((!room.players[idx] || !room.players[idx].connected) && attempts < len) {
        idx = (idx + 1) % len;
        attempts++;
    }
    return idx;
};

const getConnectedCount = (room) => room.players.filter(p => p.connected).length;

const getWinners = ({ game, players }) => {
    const winners = [];
    players.forEach((player, index) => {
        if (!player.connected) return;
        const { bingo } = game.evaluateTable(player.board);
        if (bingo) {
            players[index].win += 1;
            winners.push(player);
        }
    })
    return winners;
}

const getUnplayedNumbers = (game) => {
    return Object.keys(game.USER_SELECTION).filter(n => !game.USER_SELECTION[n]);
};

const serializePlayer = (p) => ({
    name: p.name,
    win: p.win,
    id: p.id,
    playerId: p.playerId,
    connected: p.connected,
    color: p.color
});

const clearTurnTimer = (room) => {
    if (room.turnTimer) {
        clearTimeout(room.turnTimer);
        room.turnTimer = null;
    }
    room.turnDeadline = null;
};

const startTurnTimer = (room, roomId) => {
    clearTurnTimer(room);
    const TURN_DURATION = 30000; // 30 seconds
    room.turnDeadline = Date.now() + TURN_DURATION;
    room.turnTimer = setTimeout(() => {
        handleAutoRandomMove(roomId);
    }, TURN_DURATION);
};

const broadcastTurnState = (room, roomId, extra = {}) => {
    const currentPlayerObj = room.players[room.currentPlayer];
    io.to(roomId).emit('turn-state', {
        players: room.players.map(serializePlayer),
        selection: room.game.USER_SELECTION,
        currentPlayer: currentPlayerObj?.id || null,
        turnDeadline: room.turnDeadline,
        started: room.started,
        finished: room.finished,
        gameCount: room.gameCount,
        ...extra
    });
};

const handleAutoRandomMove = (roomId) => {
    const myRoom = ROOMS[roomId];
    if (!myRoom || myRoom.finished || !myRoom.started) return;

    const unplayed = getUnplayedNumbers(myRoom.game);
    if (unplayed.length === 0) return;

    const randomNumber = unplayed[Math.floor(Math.random() * unplayed.length)];
    const number = Number(randomNumber);

    const validPlay = myRoom.game.play(number);
    if (!validPlay) {
        // Number was somehow already played — just advance turn
        myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
        startTurnTimer(myRoom, roomId);
        io.to(roomId).emit('play-move', {
            players: myRoom.players.map(serializePlayer),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            lastMove: null,
            isRandom: true,
            turnDeadline: myRoom.turnDeadline
        });
        return;
    }

    const winners = getWinners(myRoom);
    clearTurnTimer(myRoom);

    if (winners.length > 0) {
        myRoom.finished = true;
        myRoom.gameCount += 1;
        return io.to(roomId).emit('game-over', {
            winners: winners.map(i => ({ id: i.id, name: i.name, win: i.win, playerId: i.playerId })),
            players: myRoom.players.map(serializePlayer),
            selection: myRoom.game.USER_SELECTION,
            gameCount: myRoom.gameCount,
            lastMove: number,
            isRandom: true
        });
    }

    myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
    startTurnTimer(myRoom, roomId);

    const payload = {
        players: myRoom.players.map(serializePlayer),
        selection: myRoom.game.USER_SELECTION,
        currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
        lastMove: number,
        isRandom: true,
        turnDeadline: myRoom.turnDeadline
    };
    io.to(roomId).emit('play-move', payload);
};

const joinRoom = (socket, roomId, player, isRejoin = false) => {
    socket.join(roomId);
    const myRoom = ROOMS[roomId];
    const existingIdx = myRoom.players.findIndex(p => p.playerId === player.playerId);

    if (isRejoin && existingIdx !== -1) {
        const existing = myRoom.players[existingIdx];
        existing.id = socket.id;
        existing.connected = true;
        existing.name = player.name;
        SOCKET_ROOM_MAPPING[socket.id] = roomId;

        socket.emit('rejoined', {
            roomId,
            players: myRoom.players.map(serializePlayer),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            gameCount: myRoom.gameCount,
            started: myRoom.started,
            finished: myRoom.finished,
            chatHistory: myRoom.chatHistory,
            myBoard: existing.board,
            ownerPlayerId: myRoom.ownerPlayerId,
            turnDeadline: myRoom.turnDeadline
        });

        socket.to(roomId).emit('player-rejoined', {
            players: myRoom.players.map(serializePlayer),
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            rejoinedPlayerId: existing.playerId
        });
    } else {
        const myBoard = myRoom.game.prepareBlankChart();
        const playerColor = player.color || getRandomColor();
        const newPlayer = {
            name: player.name,
            id: socket.id,
            playerId: player.playerId,
            win: 0,
            board: myBoard,
            connected: true,
            color: playerColor
        };
        myRoom.players.push(newPlayer);
        SOCKET_ROOM_MAPPING[socket.id] = roomId;

        socket.emit('my-board', { myBoard, roomId });
        io.to(roomId).emit('join-room', {
            roomId,
            players: myRoom.players.map(serializePlayer),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            gameCount: myRoom.gameCount,
            started: myRoom.started,
            ownerPlayerId: myRoom.ownerPlayerId,
            turnDeadline: myRoom.turnDeadline
        });
    }
}

io.on('connection', (socket) => {
    socket.on('createRoom', (player) => {
        const roomId = randomRoomId();
        if (ROOMS[roomId]) {
            return socket.emit("error", {
                message: "Something went wrong while creating room, please try again."
            })
        }
        if (player.maxPlayers && player.maxPlayers < 2) {
            return socket.emit("error", {
                message: "At least 2 players are required"
            })
        }

        const game = new BingoGame({ size: player.maxPlayers });

        ROOMS[roomId] = {
            game,
            players: [],
            min: 2,
            max: player.maxPlayers || 5,
            owner: socket.id,
            ownerPlayerId: player.playerId,
            started: false,
            currentPlayer: 0,
            finished: false,
            gameCount: 0,
            chatHistory: [],
            turnTimer: null,
            turnDeadline: null
        }

        joinRoom(socket, roomId, player, false);
    })

    socket.on('joinRoom', (player) => {
        const roomId = player.roomId?.toString().trim();
        if (!roomId || !ROOMS[roomId]) {
            return socket.emit('error', { message: "Room does not exist" });
        }
        const myRoom = ROOMS[roomId];
        const existingPlayer = myRoom.players.find(p => p.playerId === player.playerId);

        if (existingPlayer) {
            // Always allow same playerId to rejoin — old socket will disconnect/clean up on its own
            return joinRoom(socket, roomId, player, true);
        }

        if (myRoom.started) {
            return socket.emit('error', { message: "Game has already been started" })
        }
        if (getConnectedCount(myRoom) >= myRoom.max) {
            return socket.emit('error', { message: "Room is full" })
        }

        joinRoom(socket, roomId, player, false);
    })

    socket.on('playMove', (number) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) {
            return socket.emit('error', { message: "Room not found, please join again" })
        }
        if (myRoom.finished) {
            return socket.emit('error', { message: 'Game already finished' });
        }
        if (!myRoom.started) {
            return socket.emit('error', { message: "The game has not started yet" })
        }

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || !me.connected) {
            return socket.emit('error', { message: 'Not in game' });
        }

        const currentPlayerObj = myRoom.players[myRoom.currentPlayer];
        if (!currentPlayerObj || currentPlayerObj.id !== socket.id) {
            return socket.emit('error', { message: 'Wait for your turn please' })
        }
        if (myRoom.game.USER_SELECTION[number]) {
            return socket.emit('error', { message: 'Number already played' });
        }
        const validPlay = myRoom.game.play(number);
        if (!validPlay) {
            return socket.emit('error', { message: 'You can not undo the already played move' })
        }

        const winners = getWinners(myRoom);
        clearTurnTimer(myRoom);

        if (winners.length > 0) {
            myRoom.finished = true;
            myRoom.gameCount += 1;
            return io.to(roomId).emit('game-over', {
                winners: winners.map(i => ({ id: i.id, name: i.name, win: i.win, playerId: i.playerId })),
                players: myRoom.players.map(serializePlayer),
                selection: myRoom.game.USER_SELECTION,
                gameCount: myRoom.gameCount,
                lastMove: number,
                isRandom: false
            })
        }
        myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
        startTurnTimer(myRoom, roomId);

        const payload = {
            players: myRoom.players.map(serializePlayer),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            lastMove: number,
            isRandom: false,
            turnDeadline: myRoom.turnDeadline
        }
        io.to(roomId).emit('play-move', payload)
    })

    socket.on('playRandom', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom || myRoom.finished || !myRoom.started) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;
        const currentPlayerObj = myRoom.players[myRoom.currentPlayer];
        if (!currentPlayerObj || currentPlayerObj.playerId !== me.playerId) return;

        handleAutoRandomMove(roomId);
    });

    socket.on('kickPlayer', ({ targetPlayerId }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can kick players" });
        }

        const targetIdx = myRoom.players.findIndex(p => p.playerId === targetPlayerId);
        if (targetIdx === -1) return;
        const target = myRoom.players[targetIdx];
        if (target.connected) {
            return socket.emit('error', { message: "Can only kick disconnected players" });
        }

        // Remove player
        myRoom.players.splice(targetIdx, 1);

        // Adjust currentPlayer index if needed
        if (targetIdx < myRoom.currentPlayer) {
            myRoom.currentPlayer -= 1;
        }
        if (myRoom.currentPlayer >= myRoom.players.length) {
            myRoom.currentPlayer = 0;
        }

        if (myRoom.players.length === 0) {
            delete ROOMS[roomId];
            return;
        }

        io.to(roomId).emit('player-kicked', {
            kickedName: target.name,
            kickedPlayerId: target.playerId,
            players: myRoom.players.map(serializePlayer),
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id || null,
            selection: myRoom.game.USER_SELECTION,
            ownerPlayerId: myRoom.ownerPlayerId
        });
    });

    socket.on('playStart', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (myRoom.started) {
            return socket.emit('error', { message: 'Game already started' });
        }

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can start the game" })
        }
        if (getConnectedCount(myRoom) < 2) {
            return socket.emit('error', { message: "At least 2 players are required to play" });
        }

        myRoom.currentPlayer = myRoom.players.findIndex(p => p.playerId === myRoom.ownerPlayerId);
        if (!myRoom.players[myRoom.currentPlayer]?.connected) {
            myRoom.currentPlayer = myRoom.players.findIndex(p => p.connected);
        }

        myRoom.started = true;
        startTurnTimer(myRoom, roomId);

        io.to(roomId).emit('play-started', {
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            started: true,
            turnDeadline: myRoom.turnDeadline
        })
    })

    socket.on('playRestart', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me || me.playerId !== myRoom.ownerPlayerId) {
            return socket.emit('error', { message: "Only owner can restart the game" })
        }

        if (getConnectedCount(myRoom) < 2) {
            return socket.emit('error', { message: "At least 2 players are required to play" });
        }

        clearTurnTimer(myRoom);
        myRoom.currentPlayer = getNextConnectedIndex(myRoom, myRoom.currentPlayer);
        myRoom.finished = false;
        myRoom.game.restart();
        myRoom.gameCount += 1;

        myRoom.players.forEach((player) => {
            const board = myRoom.game.prepareBlankChart();
            player.board = board;
            if (player.connected) {
                io.to(player.id).emit('play-restart', {
                    myBoard: board,
                    selection: myRoom.game.USER_SELECTION,
                    currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
                    gameCount: myRoom.gameCount
                })
            }
        });
        startTurnTimer(myRoom, roomId);
    })

    socket.on('chat:message', ({ text }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;

        const message = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            playerId: me.playerId,
            name: me.name,
            text: String(text).trim().slice(0, 300),
            timestamp: Date.now()
        };

        myRoom.chatHistory.push(message);
        if (myRoom.chatHistory.length > 50) myRoom.chatHistory.shift();

        io.to(roomId).emit('chat:message', message);
    });

    socket.on('reaction', ({ emoji, targetPlayerId }) => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];
        if (!myRoom) return;

        const me = myRoom.players.find(p => p.id === socket.id);
        if (!me) return;
        if (!emoji || emoji.length > 2) return;

        io.to(roomId).emit('reaction', {
            emoji,
            fromPlayerId: me.playerId,
            fromName: me.name,
            targetPlayerId: targetPlayerId || null,
            timestamp: Date.now()
        });
    });

    socket.on('disconnect', () => {
        const roomId = SOCKET_ROOM_MAPPING[socket.id];
        const myRoom = ROOMS[roomId];

        if (!myRoom) {
            return;
        }

        const leftIndex = myRoom.players.findIndex(p => p.id === socket.id);
        if (leftIndex === -1) return;

        const leftPlayer = myRoom.players[leftIndex];
        leftPlayer.connected = false;
        delete SOCKET_ROOM_MAPPING[socket.id];

        const connectedCount = getConnectedCount(myRoom);
        if (connectedCount === 0) {
            clearTurnTimer(myRoom);
            delete ROOMS[roomId];
            return;
        }

        // Handle owner change
        if (leftPlayer.playerId === myRoom.ownerPlayerId) {
            const newOwner = myRoom.players.find(p => p.connected);
            if (newOwner) {
                myRoom.owner = newOwner.id;
                myRoom.ownerPlayerId = newOwner.playerId;
            }
        }

        // Handle turn — skip disconnected player
        if (leftIndex === myRoom.currentPlayer) {
            clearTurnTimer(myRoom);
            myRoom.currentPlayer = getNextConnectedIndex(myRoom, leftIndex);
            if (myRoom.started && !myRoom.finished && myRoom.players[myRoom.currentPlayer]?.connected) {
                startTurnTimer(myRoom, roomId);
            }
        }

        const payload = {
            leftPlayerName: leftPlayer.name,
            leftPlayerId: leftPlayer.playerId,
            players: myRoom.players.map(serializePlayer),
            selection: myRoom.game.USER_SELECTION,
            currentPlayer: myRoom.players[myRoom.currentPlayer]?.id,
            owner: myRoom.owner,
            ownerPlayerId: myRoom.ownerPlayerId,
            turnDeadline: myRoom.turnDeadline
        };

        io.to(roomId).emit('player-left', payload);
    })
})

server.listen(3004, console.log(`Server started on port: 3004`))
